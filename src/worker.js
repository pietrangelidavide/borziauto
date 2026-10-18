/* AutoProfit · Worker di Cloudflare
   Risponde solo a /api/* e /foto/*; pagine, stili e immagini del sito li serve la cartella public/ senza passare di qui.
     /api/recensioni   recensioni di Google Maps della sede (Places API)
     /api/auto, /foto  auto e foto pubblicate dal gestionale (archivio online, vedi archivio.js)
     /api/visite       prenotazione delle visite da parte dei clienti (vedi visite.js)
     /api/admin/*      area riservata del gestionale (password), compresi i prezzi di mercato da feed autorizzato

   Per attivarlo servono due valori (vedi README, «Recensioni di Google»):
     GOOGLE_PLACE_ID   Place ID della scheda Google (non è segreto: sta in wrangler.jsonc)
     GOOGLE_PLACES_KEY chiave API di Google Cloud, con «Places API (New)» attiva (segreta: si aggiunge da Cloudflare)
   Finché mancano, risponde 503 e il sito usa data/recensioni.json. */

import { admin, autoPubbliche, serviFoto, json as jsonA } from "./archivio.js";
import { visite } from "./visite.js";

const API = "https://places.googleapis.com/v1/places/";
const CAMPI = "displayName,rating,userRatingCount,googleMapsUri,reviews";
const MAX_RECENSIONI = 5;                       // Google non ne restituisce più di 5

let memo = { fino: 0, corpo: "" };              // copia in memoria dello stesso isolate (serve anche su *.workers.dev, dove la Cache API non lavora)

const json = (corpo, stato = 200, cache = "no-store") =>
  new Response(typeof corpo === "string" ? corpo : JSON.stringify(corpo), {
    status: stato,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": cache, "x-content-type-options": "nosniff" },
  });

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url), p = url.pathname;
    if (p === "/api/recensioni") return recensioni(request, env, ctx, url);
    if (p === "/api/auto" && (request.method === "GET" || request.method === "HEAD")) return autoPubbliche(env);
    if (p === "/api/visite" || p.startsWith("/api/visite/")) return visite(request, env, ctx, url);
    if (p.startsWith("/api/admin/")) return admin(request, env, ctx, url);
    if (p.startsWith("/foto/") && (request.method === "GET" || request.method === "HEAD")) return serviFoto(request, env, ctx, url);
    if (p.startsWith("/api/")) return jsonA({ errore: "non_trovato" }, 404);
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("Not found", { status: 404 });
  },
};

async function recensioni(request, env, ctx, url) {
  if (request.method !== "GET" && request.method !== "HEAD") return json({ errore: "metodo_non_consentito" }, 405);

  const id = String(env.GOOGLE_PLACE_ID || "").trim();
  const chiave = String(env.GOOGLE_PLACES_KEY || "").trim();
  if (!id || !chiave) return json({ errore: "non_configurato" }, 503);
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(id)) return json({ errore: "place_id_non_valido" }, 503);

  // Google chiede di non conservare a lungo i suoi dati: si tengono poche ore (CACHE_ORE, da 1 a 24, predefinito 6).
  const ore = Math.min(24, Math.max(1, parseInt(env.CACHE_ORE, 10) || 6));
  const ttl = ore * 3600;
  const cacheControl = `public, max-age=${Math.min(ttl, 3600)}, s-maxage=${ttl}`;

  const ora = Date.now();
  if (memo.corpo && memo.fino > ora) return json(memo.corpo, 200, cacheControl);

  const cache = typeof caches !== "undefined" ? caches.default : null;
  const cacheKey = new Request(url.origin + "/api/recensioni?v=1");
  if (cache) {
    try {
      const hit = await cache.match(cacheKey);
      if (hit) return new Response(hit.body, { status: 200, headers: hit.headers });
    } catch (e) { /* la cache non è indispensabile */ }
  }

  let risposta;
  try {
    risposta = await fetch(`${API}${encodeURIComponent(id)}?languageCode=it&regionCode=IT`, {
      headers: { "X-Goog-Api-Key": chiave, "X-Goog-FieldMask": CAMPI, accept: "application/json" },
      signal: AbortSignal.timeout(6000),
    });
  } catch (e) {
    return json({ errore: "google_non_raggiungibile" }, 502);
  }
  if (!risposta.ok) return json({ errore: "google", stato: risposta.status }, 502);   // il corpo di Google non si inoltra: potrebbe citare la chiave

  let dati;
  try { dati = await risposta.json(); } catch (e) { return json({ errore: "risposta_non_valida" }, 502); }

  const corpo = JSON.stringify(normalizza(dati, id, ora));
  memo = { corpo, fino: ora + ttl * 1000 };
  const finale = json(corpo, 200, cacheControl);
  if (cache) ctx && ctx.waitUntil && ctx.waitUntil(cache.put(cacheKey, finale.clone()).catch(() => {}));
  return finale;
}

const https = (u) => (/^https:\/\//i.test(String(u || "")) ? String(u) : "");

export function normalizza(d, id, ora = Date.now()) {
  const lista = (Array.isArray(d.reviews) ? d.reviews : [])
    .map((r) => ({
      autore: String((r.authorAttribution && r.authorAttribution.displayName) || "").slice(0, 80) || "Cliente",
      profilo: https(r.authorAttribution && r.authorAttribution.uri),
      foto: https(r.authorAttribution && r.authorAttribution.photoUri),
      stelle: Math.max(1, Math.min(5, Math.round(Number(r.rating) || 0))),
      quando: String(r.relativePublishTimeDescription || "").slice(0, 60),
      testo: String((r.text && r.text.text) || (r.originalText && r.originalText.text) || "").trim(),
    }))
    .filter((r) => r.testo)
    .slice(0, MAX_RECENSIONI);
  return {
    fonte: "google",
    aggiornato: new Date(ora).toISOString(),
    luogo: String((d.displayName && d.displayName.text) || ""),
    voto: Number(d.rating) || 0,
    totale: Number(d.userRatingCount) || 0,
    mappa: https(d.googleMapsUri),
    tutte: `https://search.google.com/local/reviews?placeid=${encodeURIComponent(id)}`,
    scrivi: `https://search.google.com/local/writereview?placeid=${encodeURIComponent(id)}`,
    recensioni: lista,
  };
}
