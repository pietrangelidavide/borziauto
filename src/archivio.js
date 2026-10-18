/* AutoProfit · archivio online (database D1 di Cloudflare).
   Qui vivono le auto, i contatti del CRM e le foto caricate dal gestionale, così il titolare le gestisce anche dal telefono.
   - /api/auto                 pubblico: le auto del sito (solo campi pubblici)
   - /foto/<nome>              pubblico: le foto
   - /api/admin/*              riservato: dietro password (cookie di sessione)
   Servono: il database D1 (binding DB) e il segreto GESTIONALE_PASSWORD (almeno 10 caratteri). */

import { mercato, manutenzione } from "./visite.js";

const ENC = new TextEncoder();
const GIORNI_SESSIONE = 30;
const MAX_FOTO = 900 * 1024;               // byte; la riga del database ha un tetto di ~2 MB e la foto va in base64
const MAX_CORPO = 2 * 1024 * 1024;
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const NOME_FOTO = /^[a-z0-9][a-z0-9._-]{2,90}\.(?:jpe?g|png|webp)$/;

export const PUBBLICI = ["id", "stato", "marca", "modello", "allestimento", "anno", "km", "alimentazione", "cambio", "cv", "colore", "carrozzeria", "prezzo", "data_vendita", "foto", "descrizione", "autoscout_url", "demo"];
const NUMERICI = new Set(["anno", "km", "cv", "prezzo"]);

export const json = (corpo, stato = 200, extra = {}) =>
  new Response(typeof corpo === "string" ? corpo : JSON.stringify(corpo), {
    status: stato,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", ...extra },
  });

/* ---------- database ---------- */
let pronto = null;
export function db(env) {
  if (!env.DB) return null;
  if (!pronto || pronto.db !== env.DB) {
    pronto = {
      db: env.DB,
      p: env.DB.batch([
        env.DB.prepare("CREATE TABLE IF NOT EXISTS docs (tipo TEXT NOT NULL, id TEXT NOT NULL, dati TEXT NOT NULL, agg INTEGER NOT NULL, PRIMARY KEY (tipo, id))"),
        env.DB.prepare("CREATE TABLE IF NOT EXISTS foto (nome TEXT PRIMARY KEY, tipo TEXT NOT NULL, dati TEXT NOT NULL, creato INTEGER NOT NULL)"),
        env.DB.prepare("CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)"),
        env.DB.prepare("CREATE TABLE IF NOT EXISTS tentativi (ip TEXT NOT NULL, t INTEGER NOT NULL)"),
        env.DB.prepare("CREATE TABLE IF NOT EXISTS prenotazioni_ip (ip TEXT NOT NULL, t INTEGER NOT NULL)"),
      ]),
    };
  }
  return pronto.p.then(() => env.DB, (e) => { pronto = null; throw e; });
}
const meta = async (D, k) => { const r = await D.prepare("SELECT v FROM meta WHERE k=?").bind(k).first(); return r ? r.v : null; };
const parse = (s, d) => { try { return JSON.parse(s); } catch (e) { return d; } };

/* ---------- password e sessione ---------- */
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const daB64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const chiaviCache = new Map();
async function chiave(pw) {
  if (!chiaviCache.has(pw)) chiaviCache.set(pw, crypto.subtle.importKey("raw", ENC.encode("autoprofit|" + pw), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]));
  return chiaviCache.get(pw);
}
async function impronta(testo) { return new Uint8Array(await crypto.subtle.digest("SHA-256", ENC.encode(testo))); }
async function uguali(a, b) {                           // confronto a tempo costante, su impronte
  const x = await impronta(a), y = await impronta(b);
  let d = 0; for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}
export const passwordOk = (env) => typeof env.GESTIONALE_PASSWORD === "string" && env.GESTIONALE_PASSWORD.length >= 10;

async function creaToken(env, ora) {
  const exp = Math.floor(ora / 1000) + GIORNI_SESSIONE * 86400;
  const sig = await crypto.subtle.sign("HMAC", await chiave(env.GESTIONALE_PASSWORD), ENC.encode("sessione." + exp));
  return `${exp}.${b64u(sig)}`;
}
async function tokenValido(env, token, ora) {
  const m = /^(\d{9,12})\.([A-Za-z0-9_-]{20,64})$/.exec(token || "");
  if (!m || +m[1] < Math.floor(ora / 1000)) return false;
  try { return await crypto.subtle.verify("HMAC", await chiave(env.GESTIONALE_PASSWORD), daB64u(m[2]), ENC.encode("sessione." + m[1])); } catch (e) { return false; }
}
const cookieSessione = (request) => { const m = /(?:^|;\s*)tg_sess=([^;]+)/.exec(request.headers.get("cookie") || ""); return m ? m[1] : ""; };
export const autenticato = (request, env, ora = Date.now()) => tokenValido(env, cookieSessione(request), ora);
const attributi = (url, extra) => `Path=/api; HttpOnly; SameSite=Strict${url.protocol === "https:" ? "; Secure" : ""}; ${extra}`;

/* ---------- foto ---------- */
function aB64(u8) { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
function daB64(b) { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
function tipoImmagine(u) {
  if (u.length > 12 && u[0] === 0xff && u[1] === 0xd8 && u[2] === 0xff) return "image/jpeg";
  if (u.length > 12 && u[0] === 0x89 && u[1] === 0x50 && u[2] === 0x4e && u[3] === 0x47) return "image/png";
  if (u.length > 12 && u[0] === 0x52 && u[1] === 0x49 && u[2] === 0x46 && u[3] === 0x46 && u[8] === 0x57 && u[9] === 0x45 && u[10] === 0x42 && u[11] === 0x50) return "image/webp";
  return "";
}
const https = (u) => (/^https:\/\//i.test(String(u || "")) ? String(u) : "");
export function urlFoto(nome) {
  nome = String(nome || "").trim();
  if (https(nome)) return nome;
  return NOME_FOTO.test(nome) ? "/foto/" + nome : "";
}
const elencoFoto = (s) => String(s || "").split("|").map((x) => x.trim()).filter(Boolean);

/* ---------- dati pubblici ---------- */
export function pubblico(d) {
  const o = {};
  for (const k of PUBBLICI) {
    let v = d[k];
    if (v === undefined) continue;
    if (NUMERICI.has(k)) v = v == null || v === "" || !isFinite(+v) ? null : +v;
    else if (k === "demo") v = !!v;
    else v = v == null ? "" : String(v).slice(0, k === "descrizione" ? 4000 : 300);
    o[k] = v;
  }
  o.stato = d.stato === "venduta" ? "venduta" : "disponibile";
  if (o.stato === "venduta") o.prezzo = null;
  o.foto = elencoFoto(d.foto).map(urlFoto).filter(Boolean).join("|");
  if (o.autoscout_url && !https(o.autoscout_url)) o.autoscout_url = "";
  return o;
}

export async function autoPubbliche(env) {
  let D = null;
  try { D = await db(env); } catch (e) { /* database non pronto */ }
  if (!D) return json({ errore: "non_configurato" }, 503);
  if ((await meta(D, "inizializzato")) !== "1") return json({ errore: "non_inizializzato" }, 404);
  const r = await D.prepare("SELECT dati, agg FROM docs WHERE tipo='auto' ORDER BY id").all();
  let agg = 0;
  const auto = (r.results || []).map((x) => { agg = Math.max(agg, x.agg); return parse(x.dati, null); })
    .filter((d) => d && d.preparazione !== true && ID.test(String(d.id)) && d.marca && d.modello).map(pubblico);
  const t = parse(await meta(D, "titolare"), {}) || {};
  const corpo = { versione: 1, fonte: "server", aggiornato: agg ? new Date(agg).toISOString() : "", auto,
    sito: { titolare: { nome: String(t.nome || "").slice(0, 80), foto: elencoFoto(t.foto).map(urlFoto).filter(Boolean).slice(0, 2) } } };
  return json(corpo, 200, { "cache-control": "public, max-age=20, s-maxage=20, stale-while-revalidate=60" });
}

export async function serviFoto(request, env, ctx, url) {
  let nome = "";
  try { nome = decodeURIComponent(url.pathname.slice("/foto/".length)); } catch (e) { /* nome non valido */ }
  if (!NOME_FOTO.test(nome)) return new Response("Not found", { status: 404 });
  const cache = typeof caches !== "undefined" ? caches.default : null;
  if (cache) { try { const hit = await cache.match(request); if (hit) return hit; } catch (e) {} }
  let risposta = null, D = null;
  try { D = await db(env); } catch (e) { /* senza database restano le foto della cartella del sito */ }
  if (D) {
    const r = await D.prepare("SELECT tipo, dati FROM foto WHERE nome=?").bind(nome).first();
    if (r) risposta = new Response(request.method === "HEAD" ? null : daB64(r.dati), { headers: { "content-type": r.tipo, "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" } });
  }
  if (!risposta && env.ASSETS) {          // foto pubblicate a mano nella cartella del sito (img/auto)
    const a = await env.ASSETS.fetch(new Request(url.origin + "/img/auto/" + nome));
    if (a.ok) return a;
  }
  if (!risposta) return new Response("Not found", { status: 404 });
  if (cache && request.method === "GET" && ctx && ctx.waitUntil) ctx.waitUntil(cache.put(request, risposta.clone()).catch(() => {}));
  return risposta;
}

/* ---------- area riservata ---------- */
export async function admin(request, env, ctx, url, ora = Date.now()) {
  const azione = url.pathname.slice("/api/admin/".length);
  let D = null;
  try { D = await db(env); } catch (e) { /* database non pronto */ }
  if (!D || !passwordOk(env)) return json({ configurato: false, motivo: !D ? "database" : "password" }, 503);

  if (azione === "stato" && request.method === "GET") return json({ configurato: true, autenticato: await autenticato(request, env, ora) });

  if (request.method !== "GET") {                                             // difesa da richieste da altri siti
    const o = request.headers.get("origin");
    if (o && o !== url.origin) return json({ errore: "origine_non_valida" }, 403);
  }
  if (azione === "login" && request.method === "POST") return login(request, env, D, url, ora);
  if (azione === "logout" && request.method === "POST") return json({ ok: true }, 200, { "set-cookie": `tg_sess=; ${attributi(url, "Max-Age=0")}` });

  if (!(await autenticato(request, env, ora))) return json({ errore: "non_autorizzato" }, 401);

  if (azione === "mercato") return mercato(request, env, ctx, url, ora);

  if (azione === "dati" && request.method === "GET") {
    try { await manutenzione(env, D, url, ora); } catch (e) { /* la pulizia dei dati vecchi non deve bloccare l'accesso */ }
    const r = await D.prepare("SELECT tipo, dati FROM docs").all();
    const out = { auto: [], contatti: [], storico: [], visite: [] };
    for (const x of r.results || []) { const d = parse(x.dati, null); if (d && out[x.tipo]) out[x.tipo].push(d); }
    return json({ inizializzato: (await meta(D, "inizializzato")) === "1", auto: out.auto, contatti: out.contatti, storico: out.storico, visite: out.visite,
      impostazioni: { titolare: parse(await meta(D, "titolare"), { nome: "", foto: "" }), flotta: parse(await meta(D, "flotta"), {}) || {} }, ora });
  }
  if (azione === "sync" && request.method === "POST") return sync(request, D, ora);
  if (azione.startsWith("foto/") && request.method === "PUT") return caricaFoto(request, D, decodeURIComponent(azione.slice(5)), ora);
  return json({ errore: "non_trovato" }, 404);
}

async function login(request, env, D, url, ora) {
  const ip = request.headers.get("cf-connecting-ip") || "?";
  const finestra = ora - 15 * 60 * 1000;
  await D.prepare("DELETE FROM tentativi WHERE t < ?").bind(finestra).run();
  const mio = await D.prepare("SELECT COUNT(*) AS n FROM tentativi WHERE ip=? AND t>=?").bind(ip, finestra).first();
  const tutti = await D.prepare("SELECT COUNT(*) AS n FROM tentativi WHERE t>=?").bind(finestra).first();
  if ((mio && mio.n >= 8) || (tutti && tutti.n >= 60)) return json({ errore: "troppi_tentativi", messaggio: "Troppi tentativi. Riprova tra 15 minuti." }, 429, { "retry-after": "900" });
  let corpo = null;
  try { const t = await request.text(); if (t.length < 2000) corpo = JSON.parse(t); } catch (e) {}
  const pw = corpo && typeof corpo.password === "string" ? corpo.password : "";
  if (!pw || !(await uguali(pw, env.GESTIONALE_PASSWORD))) {
    await D.prepare("INSERT INTO tentativi(ip, t) VALUES(?, ?)").bind(ip, ora).run();
    return json({ errore: "password_errata", messaggio: "Password non corretta." }, 401);
  }
  await D.prepare("DELETE FROM tentativi WHERE ip=?").bind(ip).run();
  const token = await creaToken(env, ora);
  return json({ ok: true }, 200, { "set-cookie": `tg_sess=${token}; ${attributi(url, "Max-Age=" + GIORNI_SESSIONE * 86400)}` });
}

/* sync: { auto:{set:[…],del:[id…]}, contatti:{set,del}, storico:{set,del}, visite:{set,del}, impostazioni:{titolare:{nome,foto}, flotta:{…}}, inizializza:true } */
const TIPI = ["auto", "contatti", "storico", "visite"];
/* impostazioni della flotta: solo numeri, sì/no e testi brevi, al massimo 24 voci */
function scrub(o) {
  const out = {}; let n = 0;
  for (const k of Object.keys(o)) {
    if (n >= 24 || !/^[a-z_]{1,30}$/.test(k)) continue;
    const v = o[k];
    if (typeof v === "number" && isFinite(v)) out[k] = v;
    else if (typeof v === "boolean") out[k] = v;
    else if (typeof v === "string") out[k] = v.slice(0, 80);
    else continue;
    n++;
  }
  return out;
}
function blocco(b, nome) {
  const out = { set: [], del: [] };
  if (!b) return out;
  if (Array.isArray(b.set)) for (const d of b.set) {
    if (!d || typeof d !== "object" || typeof d.id !== "string" || !ID.test(d.id)) throw new Error(`${nome}: documento senza id valido`);
    const j = JSON.stringify(d);
    if (j.length > 40000) throw new Error(`${nome}: documento troppo grande (${d.id})`);
    out.set.push(d);
  }
  if (Array.isArray(b.del)) for (const id of b.del) { if (typeof id !== "string" || !ID.test(id)) throw new Error(`${nome}: id da eliminare non valido`); out.del.push(id); }
  if (out.set.length > 5000 || out.del.length > 5000) throw new Error(`${nome}: troppi documenti in una volta`);
  return out;
}
async function sync(request, D, ora) {
  const len = +request.headers.get("content-length") || 0;
  if (len > MAX_CORPO) return json({ errore: "troppo_grande" }, 413);
  let corpo;
  try { const t = await request.text(); if (t.length > MAX_CORPO) return json({ errore: "troppo_grande" }, 413); corpo = JSON.parse(t); } catch (e) { return json({ errore: "json_non_valido" }, 400); }
  if (!corpo || typeof corpo !== "object") return json({ errore: "json_non_valido" }, 400);
  let blocchi;
  try { blocchi = TIPI.map((tipo) => [tipo, blocco(corpo[tipo], tipo)]); } catch (e) { return json({ errore: "dati_non_validi", messaggio: e.message }, 400); }
  const a = blocchi[0][1];
  const st = [];
  const upsert = D.prepare("INSERT INTO docs(tipo, id, dati, agg) SELECT ?1, json_extract(value, '$.id'), value, ?2 FROM json_each(?3) WHERE true ON CONFLICT(tipo, id) DO UPDATE SET dati=excluded.dati, agg=excluded.agg");
  const elimina = D.prepare("DELETE FROM docs WHERE tipo=?1 AND id IN (SELECT value FROM json_each(?2))");
  for (const [tipo, b] of blocchi) {
    if (b.set.length) st.push(upsert.bind(tipo, ora, JSON.stringify(b.set)));
    if (b.del.length) st.push(elimina.bind(tipo, JSON.stringify(b.del)));
  }
  const t = corpo.impostazioni && corpo.impostazioni.titolare;
  if (t && typeof t === "object") {
    const doc = { nome: String(t.nome || "").trim().slice(0, 80), foto: elencoFoto(t.foto).filter((x) => NOME_FOTO.test(x) || https(x)).slice(0, 2).join("|") };
    st.push(D.prepare("INSERT INTO meta(k, v) VALUES('titolare', ?1) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(JSON.stringify(doc)));
  }
  const f = corpo.impostazioni && corpo.impostazioni.flotta;
  if (f && typeof f === "object" && !Array.isArray(f)) st.push(D.prepare("INSERT INTO meta(k, v) VALUES('flotta', ?1) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(JSON.stringify(scrub(f))));
  if (corpo.inizializza) st.push(D.prepare("INSERT INTO meta(k, v) VALUES('inizializzato', '1') ON CONFLICT(k) DO UPDATE SET v='1'"));
  if (st.length) await D.batch(st);
  if (a.set.length || a.del.length || t) await pulisciFoto(D, ora);
  return json({ ok: true, ora });
}

/* toglie dall'archivio le foto che nessuna auto usa più (e che sono state caricate da più di un giorno) */
export async function pulisciFoto(D, ora) {
  const usate = new Set();
  const r = await D.prepare("SELECT json_extract(dati, '$.foto') AS f FROM docs WHERE tipo='auto'").all();
  (r.results || []).forEach((x) => elencoFoto(x.f).forEach((n) => usate.add(n)));
  elencoFoto((parse(await meta(D, "titolare"), {}) || {}).foto).forEach((n) => usate.add(n));
  const tutte = await D.prepare("SELECT nome FROM foto WHERE creato < ?").bind(ora - 86400000).all();
  const via = (tutte.results || []).map((x) => x.nome).filter((n) => !usate.has(n));
  if (via.length) await D.prepare("DELETE FROM foto WHERE nome IN (SELECT value FROM json_each(?))").bind(JSON.stringify(via)).run();
  return via.length;
}

async function caricaFoto(request, D, nome, ora) {
  if (!NOME_FOTO.test(nome)) return json({ errore: "nome_non_valido", messaggio: "Nome del file non valido." }, 400);
  if ((+request.headers.get("content-length") || 0) > MAX_FOTO + 1024) return json({ errore: "foto_troppo_grande", messaggio: "La foto è troppo pesante (max 900 KB dopo il ridimensionamento)." }, 413);
  const buf = new Uint8Array(await request.arrayBuffer());
  if (buf.length > MAX_FOTO) return json({ errore: "foto_troppo_grande", messaggio: "La foto è troppo pesante (max 900 KB dopo il ridimensionamento)." }, 413);
  const tipo = tipoImmagine(buf);
  if (!tipo) return json({ errore: "non_immagine", messaggio: "Il file non è un’immagine JPG, PNG o WebP." }, 415);
  await D.prepare("INSERT INTO foto(nome, tipo, dati, creato) VALUES(?1, ?2, ?3, ?4) ON CONFLICT(nome) DO UPDATE SET tipo=excluded.tipo, dati=excluded.dati, creato=excluded.creato").bind(nome, tipo, aB64(buf), ora).run();
  return json({ ok: true, nome, url: "/foto/" + nome });
}
