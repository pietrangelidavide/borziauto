/* Borzi Auto · «Vendi la tua auto» (lato server)
   - GET  /api/vendi     pubblico: dice se il modulo è attivo e quante foto servono
   - POST /api/vendi     pubblico: il cliente invia i dati dell'auto e le foto (multipart: «dati» = JSON, «foto» = file JPEG, da 4 a 10)
   Il Worker rifà tutti i controlli (campi, numero e peso delle foto, formato JPEG, consenso privacy, limite di richieste per IP).
   Le richieste finiscono nell'archivio come documenti «richieste»; le foto in una tabella a parte, leggibile solo dal gestionale
   (GET /api/admin/richiesta-foto/<nome>, vedi archivio.js). Provato con _work/t_richieste.mjs. */

import { db, json, aB64, nomeFotoRichiesta } from "./archivio.js";
import { leggiConfig, limite } from "./visite.js";
import R from "../public/js/richieste-core.js";
import V from "../public/js/visite-core.js";

const MAX_CORPO = 9 * 1024 * 1024;
const ID36 = "0123456789abcdefghijklmnopqrstuvwxyz";
const casuale = (n) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map((b) => ID36[b % ID36.length]).join(""); };
const origineOk = (request, url) => { const o = request.headers.get("origin"); return !o || o === url.origin; };
const fuso = (cfg) => (cfg && cfg.fuso) || "Europe/Rome";

function jpeg(u) { return u.length > 12 && u[0] === 0xff && u[1] === 0xd8 && u[2] === 0xff; }

export async function vendi(request, env, ctx, url, ora = Date.now()) {
  let D = null;
  try { D = await db(env); } catch (e) { /* database non pronto */ }
  if (!D) return json({ errore: "non_configurato" }, 503);
  const cfg = await leggiConfig(env, url, ora);
  if (!cfg) return json({ errore: "non_configurato" }, 503);
  if (!(cfg.moduli && cfg.moduli.vendi === true)) return json({ errore: "non_attivo" }, 404);           // si accende solo se il garage lo dichiara in garage.json › moduli › vendi

  if (request.method === "GET" || request.method === "HEAD") return json({ attivo: true, foto: { min: R.FOTO_MIN, max: R.FOTO_MAX, byte: R.FOTO_BYTE } });
  if (request.method !== "POST") return json({ errore: "metodo_non_consentito" }, 405);
  if (!origineOk(request, url)) return json({ errore: "origine_non_valida" }, 403);
  if ((+request.headers.get("content-length") || 0) > MAX_CORPO) return json({ errore: "troppo_grande", messaggio: "Le foto sono troppo pesanti: provane meno o più piccole." }, 413);

  let form;
  try { form = await request.formData(); } catch (e) { return json({ errore: "dati_non_validi", messaggio: "Richiesta non valida." }, 400); }
  let dati = null;
  try { const t = form.get("dati"); if (typeof t === "string" && t.length < 12000) dati = JSON.parse(t); } catch (e) { /* JSON non valido */ }
  if (!dati || typeof dati !== "object" || Array.isArray(dati)) return json({ errore: "dati_non_validi", messaggio: "Richiesta non valida." }, 400);
  if (typeof dati.sito === "string" && dati.sito.trim()) return json({ ok: true, id: "x" }, 201);              // campo-trappola per i programmi automatici: finge di riuscire

  const file = form.getAll("foto").filter((f) => f && typeof f === "object" && typeof f.arrayBuffer === "function");
  if (file.length > R.FOTO_MAX) return json({ errore: "dati_non_validi", errori: { foto: `Al massimo ${R.FOTO_MAX} foto.` }, messaggio: `Al massimo ${R.FOTO_MAX} foto.` }, 422);
  if (!(await limite(D, env, request, ora, 3, "vendi"))) return json({ errore: "troppe_richieste", messaggio: "Hai inviato troppe richieste: riprova tra un’ora o chiamaci." }, 429, { "retry-after": "3600" });

  const val = R.valida(dati, file.length, new Date(ora).getUTCFullYear());
  if (!val.ok) return json({ errore: "dati_non_validi", errori: val.errori, messaggio: Object.values(val.errori)[0] }, 422);

  const id = "r" + ora.toString(36) + casuale(5), iso = new Date(ora).toISOString(), nomi = [], righe = [];
  for (let i = 0; i < file.length; i++) {
    if (file[i].size > R.FOTO_BYTE) return json({ errore: "foto_troppo_grande", errori: { foto: `La foto ${i + 1} è troppo pesante.` }, messaggio: `La foto ${i + 1} è troppo pesante: provane una più piccola.` }, 413);
    const buf = new Uint8Array(await file[i].arrayBuffer());
    if (!jpeg(buf)) return json({ errore: "non_immagine", errori: { foto: `La foto ${i + 1} non è un’immagine JPEG.` }, messaggio: `La foto ${i + 1} non è un’immagine valida.` }, 415);
    const nome = nomeFotoRichiesta(id, i + 1);
    nomi.push(nome);
    righe.push(D.prepare("INSERT INTO foto_richieste(nome, rid, dati, creato) VALUES(?1, ?2, ?3, ?4)").bind(nome, id, aB64(buf), ora));
  }
  const doc = R.norm(Object.assign({}, val.valori, {
    id, stato: "nuova", origine: "vetrina", creato: iso, aggiornato: iso, foto: nomi.join("|"),
    consenso: { privacy: true, marketing: dati.consenso_marketing === true, versione: R.VERSIONE_PRIVACY, data: iso },
  }));
  await D.batch([...righe, D.prepare("INSERT INTO docs(tipo, id, dati, agg) VALUES('richieste', ?1, ?2, ?3)").bind(id, JSON.stringify(doc), ora)]);
  return json({ ok: true, id }, 201);
}
