/* AutoProfit · prenotazione delle visite (lato server) e fonte dei prezzi di mercato.
   - GET  /api/visite?da=…&a=…      pubblico: SOLO gli orari già presi (data, ora, durata), mai nomi o contatti
   - POST /api/visite               pubblico: il cliente prenota; il Worker rifà tutti i controlli (orari, ferie, preavviso, posti, privacy)
   - POST /api/visite/annulla       pubblico: il cliente annulla con il codice ricevuto alla prenotazione
   - GET  /api/admin/mercato        riservato: prezzi di mercato da un feed autorizzato (MERCATO_URL), vedi README
   Le regole (orari, durata, ferie, conservazione dei dati) si leggono da /garage.json, lo stesso file che usa il sito. */

import { db, json } from "./archivio.js";
import V from "../public/js/visite-core.js";
import M from "../public/gestionale/mercato.js";

const ENC = new TextEncoder();
const CODICE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const sha = async (t) => hex(await crypto.subtle.digest("SHA-256", ENC.encode(t)));
const casuale = (n, alfabeto) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return [...a].map((b) => alfabeto[b % alfabeto.length]).join(""); };
const ID36 = "0123456789abcdefghijklmnopqrstuvwxyz";
const parse = (s, d) => { try { return JSON.parse(s); } catch (e) { return d; } };

/* ---------- regole del garage (garage.json), tenute a mente 5 minuti ---------- */
let memoCfg = { fino: 0, cfg: null, origine: "", assets: null };
export async function leggiConfig(env, url, ora = Date.now()) {
  if (memoCfg.cfg && memoCfg.fino > ora && memoCfg.origine === url.origin && memoCfg.assets === env.ASSETS) return memoCfg.cfg;
  let cfg = null;
  try {
    if (env.ASSETS) { const r = await env.ASSETS.fetch(new Request(url.origin + "/garage.json")); if (r.ok) cfg = await r.json(); }
  } catch (e) { /* senza file non ci sono orari: le prenotazioni restano chiuse */ }
  memoCfg = { fino: ora + 5 * 60 * 1000, cfg, origine: url.origin, assets: env.ASSETS };
  return cfg;
}
export const azzeraConfig = () => { memoCfg = { fino: 0, cfg: null, origine: "", assets: null }; };
const fuso = (cfg) => (cfg && cfg.fuso) || "Europe/Rome";

/* ---------- lettura delle visite ---------- */
async function attive(D, da, a) {
  const r = await D.prepare("SELECT dati FROM docs WHERE tipo='visite' AND json_extract(dati,'$.data') >= ?1 AND json_extract(dati,'$.data') <= ?2").bind(da, a).all();
  return (r.results || []).map((x) => parse(x.dati, null)).filter((v) => v && V.ATTIVE.includes(v.stato));
}

/* conservazione: le visite più vecchie del periodo indicato in garage.json (privacy.conservazione.visite_mesi, 12 se manca) si cancellano */
export async function pulisciVecchie(D, cfg, oggi) {
  const mesi = +(((cfg && cfg.privacy) || {}).conservazione || {}).visite_mesi || 12;
  const lim = V.piu(oggi, -Math.round(mesi * 30.4));
  const r = await D.prepare("DELETE FROM docs WHERE tipo='visite' AND json_extract(dati,'$.data') < ?1 AND json_extract(dati,'$.data') != ''").bind(lim).run();
  return (r && r.meta && r.meta.changes) || 0;
}

/* da chiamare ogni tanto (a ogni apertura del gestionale): applica il periodo di conservazione dei dati */
export async function manutenzione(env, D, url, ora = Date.now()) {
  const cfg = await leggiConfig(env, url, ora);
  if (!cfg) return 0;
  return pulisciVecchie(D, cfg, V.adesso(fuso(cfg), new Date(ora)).data);
}

/* ---------- limite di richieste (per IP, senza conservare l'IP in chiaro: si tiene un'impronta valida un giorno) ---------- */
async function limite(D, env, request, ora, max) {
  const ip = request.headers.get("cf-connecting-ip") || "?";
  const giorno = new Date(ora).toISOString().slice(0, 10);
  const imp = (await sha("visite|" + ip + "|" + giorno + "|" + String(env.SALE_IP || env.GESTIONALE_PASSWORD || ""))).slice(0, 24);       // con un sale segreto: senza di esso l'impronta non si risale all'IP provando tutti gli indirizzi
  await D.prepare("DELETE FROM prenotazioni_ip WHERE t < ?").bind(ora - 2 * 3600 * 1000).run();
  const mio = await D.prepare("SELECT COUNT(*) AS n FROM prenotazioni_ip WHERE ip=? AND t>=?").bind(imp, ora - 3600 * 1000).first();
  const tutti = await D.prepare("SELECT COUNT(*) AS n FROM prenotazioni_ip WHERE t>=?").bind(ora - 3600 * 1000).first();
  if ((mio && mio.n >= max) || (tutti && tutti.n >= 120)) return null;
  await D.prepare("INSERT INTO prenotazioni_ip(ip, t) VALUES(?, ?)").bind(imp, ora).run();
  return imp;
}

async function corpoJson(request, max) {
  const len = +request.headers.get("content-length") || 0;
  if (len > max) return null;
  try { const t = await request.text(); if (t.length > max) return null; const j = JSON.parse(t); return j && typeof j === "object" && !Array.isArray(j) ? j : null; } catch (e) { return null; }
}
const origineOk = (request, url) => { const o = request.headers.get("origin"); return !o || o === url.origin; };

/* ---------- /api/visite ---------- */
export async function visite(request, env, ctx, url, ora = Date.now()) {
  const sotto = url.pathname.slice("/api/visite".length);
  let D = null;
  try { D = await db(env); } catch (e) { /* database non pronto */ }
  if (!D) return json({ errore: "non_configurato" }, 503);
  const cfg = await leggiConfig(env, url, ora);
  if (!cfg || !cfg.orari) return json({ errore: "non_configurato", messaggio: "Le prenotazioni non sono attive." }, 503);
  if (cfg.moduli && cfg.moduli.visite === false) return json({ errore: "non_attivo" }, 404);
  const adesso = V.adesso(fuso(cfg), new Date(ora));

  if (sotto === "" && (request.method === "GET" || request.method === "HEAD")) {
    const r = V.regole(cfg);
    const da = V.dataValida(url.searchParams.get("da")) ? url.searchParams.get("da") : adesso.data;
    let a = V.dataValida(url.searchParams.get("a")) ? url.searchParams.get("a") : V.piu(da, r.giorniMax);
    if (V.giorniTra(da, a) > 62) a = V.piu(da, 62);
    const lista = await attive(D, da, a);
    return json({ attivo: true, ora: adesso, occupate: lista.map((v) => ({ data: v.data, ora: v.ora, durata: v.durata || r.durata })) }, 200, { "cache-control": "no-store" });
  }
  if (request.method !== "POST") return json({ errore: "metodo_non_consentito" }, 405);
  if (!origineOk(request, url)) return json({ errore: "origine_non_valida" }, 403);

  if (sotto === "/annulla") return annulla(request, env, D, ora, adesso, cfg);
  if (sotto !== "") return json({ errore: "non_trovato" }, 404);

  const corpo = await corpoJson(request, 8000);
  if (!corpo) return json({ errore: "json_non_valido" }, 400);
  if (typeof corpo.sito === "string" && corpo.sito.trim()) return json({ ok: true, id: "x", stato: "richiesta" });         // campo-trappola per i programmi automatici: finge di riuscire
  if (!(await limite(D, env, request, ora, 5))) return json({ errore: "troppe_richieste", messaggio: "Hai fatto troppe richieste: riprova tra un’ora o chiamaci." }, 429, { "retry-after": "3600" });

  const r = V.regole(cfg), ini = adesso.data, fine = V.piu(ini, r.giorniMax + 1);
  const occ = await attive(D, ini, fine);
  const val = V.valida(cfg, corpo, occ, adesso);
  if (!val.ok) {
    const soloOccupato = Object.keys(val.errori).length === 1 && val.errori.orario && /preso/.test(val.errori.orario);
    return json({ errore: soloOccupato ? "orario_occupato" : "dati_non_validi", errori: val.errori, messaggio: Object.values(val.errori)[0] }, soloOccupato ? 409 : 422);
  }

  const id = "v" + ora.toString(36) + casuale(5, ID36), codice = casuale(8, CODICE);
  const iso = new Date(ora).toISOString();
  const doc = V.norm({
    id, ...val.valori, durata: r.durata, stato: "richiesta", origine: "vetrina", creato: iso, aggiornato: iso,
    consenso: { privacy: true, marketing: corpo.consenso_marketing === true, versione: V.VERSIONE_PRIVACY, data: iso }, codice_hash: await sha("codice|" + id + "|" + codice),
  });
  await D.prepare("INSERT INTO docs(tipo, id, dati, agg) VALUES('visite', ?1, ?2, ?3)").bind(id, JSON.stringify(doc), ora).run();

  // due persone possono scegliere lo stesso orario nello stesso istante: dopo l'inserimento si ricontrolla e vince chi è stato scritto per primo (ordine di inserimento nel database)
  const righe = await D.prepare("SELECT id, dati FROM docs WHERE tipo='visite' AND json_extract(dati,'$.data')=?1 ORDER BY rowid").bind(doc.data).all();
  const sovr = (righe.results || []).map((x) => ({ id: x.id, v: parse(x.dati, null) })).filter((x) => x.v && V.ATTIVE.includes(x.v.stato) && V.min(x.v.ora) != null && V.min(x.v.ora) < V.min(doc.ora) + doc.durata && V.min(doc.ora) < V.min(x.v.ora) + (x.v.durata || r.durata));
  if (!sovr.slice(0, r.posti).some((x) => x.id === id)) {
    await D.prepare("DELETE FROM docs WHERE tipo='visite' AND id=?").bind(id).run();
    return json({ errore: "orario_occupato", messaggio: "Quell’orario è appena stato preso: scegline un altro." }, 409);
  }
  if (ctx && ctx.waitUntil) ctx.waitUntil(pulisciVecchie(D, cfg, adesso.data).catch(() => {})); else await pulisciVecchie(D, cfg, adesso.data).catch(() => {});
  return json({ ok: true, id, codice, data: doc.data, ora: doc.ora, durata: doc.durata, stato: doc.stato }, 201);
}

async function annulla(request, env, D, ora, adesso, cfg) {
  const corpo = await corpoJson(request, 1000);
  const id = corpo && typeof corpo.id === "string" ? corpo.id : "", codice = corpo && typeof corpo.codice === "string" ? corpo.codice.trim().toUpperCase() : "";
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id) || !/^[A-Z0-9]{8}$/.test(codice)) return json({ errore: "dati_non_validi", messaggio: "Codice non valido." }, 422);
  if (!(await limite(D, env, request, ora, 10))) return json({ errore: "troppe_richieste", messaggio: "Troppi tentativi: riprova tra un’ora." }, 429);
  const r = await D.prepare("SELECT dati FROM docs WHERE tipo='visite' AND id=?").bind(id).first();
  const v = r ? parse(r.dati, null) : null;
  if (!v || !v.codice_hash || v.codice_hash !== (await sha("codice|" + id + "|" + codice))) return json({ errore: "codice_errato", messaggio: "Il codice non corrisponde a nessuna prenotazione." }, 404);
  if (!V.ATTIVE.includes(v.stato)) return json({ ok: true, stato: v.stato });
  v.stato = "annullata"; v.aggiornato = new Date(ora).toISOString();
  await D.prepare("UPDATE docs SET dati=?1, agg=?2 WHERE tipo='visite' AND id=?3").bind(JSON.stringify(v), ora, id).run();
  return json({ ok: true, stato: "annullata" });
}

/* ---------- prezzi di mercato da un feed autorizzato ---------- */
const memoMercato = new Map();
export async function mercato(request, env, ctx, url, ora = Date.now()) {
  if (request.method !== "GET") return json({ errore: "metodo_non_consentito" }, 405);
  const base = String(env.MERCATO_URL || "").trim();
  if (!/^https:\/\/[^\s]+$/i.test(base)) return json({ errore: "non_configurato", messaggio: "La fonte dei prezzi di mercato non è collegata." }, 501);
  const q = url.searchParams, marca = String(q.get("marca") || "").trim().slice(0, 60), modello = String(q.get("modello") || "").trim().slice(0, 80);
  const anno = Math.round(+q.get("anno")) || 0, km = Math.round(+q.get("km")) || 0;
  if (!marca) return json({ errore: "dati_non_validi", messaggio: "Manca la marca." }, 422);
  const chiave = [marca.toLowerCase(), modello.toLowerCase(), anno].join("|");
  const ore = Math.min(48, Math.max(1, parseInt(env.MERCATO_CACHE_ORE, 10) || 12));
  const hit = memoMercato.get(chiave);
  if (hit && hit.fino > ora) return json(hit.corpo, 200, { "cache-control": "private, max-age=600" });
  const p = new URLSearchParams({ marca, modello }); if (anno) p.set("anno", anno); if (km) p.set("km", km);
  let r;
  try {
    r = await fetch(base + (base.includes("?") ? "&" : "?") + p, { headers: { accept: "application/json", ...(env.MERCATO_KEY ? { authorization: "Bearer " + env.MERCATO_KEY } : {}) }, signal: AbortSignal.timeout(8000) });
  } catch (e) { return json({ errore: "fonte_non_raggiungibile", messaggio: "La fonte dei prezzi non risponde." }, 502); }
  if (!r.ok) return json({ errore: "fonte", stato: r.status }, 502);          // il corpo del fornitore non si inoltra: potrebbe citare la chiave
  let j = null; try { j = await r.json(); } catch (e) {}
  const annunci = M.pulisci(j && j.annunci);
  const corpo = { fonte: String((j && j.fonte) || env.MERCATO_NOME || "Feed autorizzato").slice(0, 60), aggiornato: String((j && j.aggiornato) || new Date(ora).toISOString()).slice(0, 10), annunci };
  if (annunci.length) memoMercato.set(chiave, { fino: ora + ore * 3600 * 1000, corpo });
  return json(corpo, 200, { "cache-control": "private, max-age=600" });
}
