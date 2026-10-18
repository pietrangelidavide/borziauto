/* AutoProfit · da dove arrivano i prezzi di mercato.
   La stima parte da un elenco di annunci di auto simili (prezzo, km, anno). Questo modulo li procura da una «fonte»:
     - feed      un servizio autorizzato (accordo con un portale o dati su licenza), letto dal Worker: /api/admin/mercato
     - esempio   prezzi GENERATI dal programma, solo per la demo: non vengono da nessun portale e sono sempre dichiarati come tali
     - manuale   annunci incollati o importati dal dealer (sempre disponibile)
   AutoScout24 non offre un accesso pubblico ai prezzi e le sue condizioni B2B (art. 3.8) vietano di leggerne la banca dati con
   programmi di terzi e di copiarne i contenuti: per questo la fonte «feed» esiste solo se c'è un accordo o una licenza.
   Funzioni pure e senza interfaccia: provate con _work/t_mercato.mjs. */
(function (radice) {
  "use strict";
  const M = {};
  const norm = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/\s+/g, " ");

  /* ---------- generatore di esempio ---------- */
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = (seme) => () => { seme |= 0; seme = (seme + 0x6d2b79f5) | 0; let t = Math.imul(seme ^ (seme >>> 15), 1 | seme); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  /* prezzo di listino medio (€) di un modello, solo per generare dati di esempio plausibili */
  const LISTINO = {
    "fiat|panda": 15500, "fiat|500": 18500, "fiat|tipo": 21000, "lancia|ypsilon": 17500, "jeep|renegade": 27500, "jeep|compass": 34000,
    "alfa romeo|giulietta": 29000, "alfa romeo|stelvio": 49000, "renault|clio": 18500, "renault|captur": 24500, "peugeot|208": 20000, "peugeot|3008": 37000,
    "citroen|c3": 17500, "ford|fiesta": 18500, "ford|puma": 25000, "toyota|yaris": 19500, "toyota|c-hr": 32000, "opel|corsa": 18500, "dacia|sandero": 14000,
    "dacia|duster": 20000, "volkswagen|polo": 20000, "volkswagen|golf": 28500, "volkswagen|t-roc": 31000, "volkswagen|tiguan": 39000, "skoda|octavia": 30000,
    "seat|leon": 25500, "hyundai|i20": 18500, "kia|sportage": 34000, "nissan|qashqai": 31000, "mazda|cx-5": 34000, "volvo|xc40": 41000, "tesla|model 3": 46000,
    "bmw|serie 1": 33000, "bmw|serie 3": 46000, "bmw|x1": 41000, "audi|a3": 33000, "audi|q3": 41000, "mercedes-benz|classe a": 35000, "mercedes-benz|gla": 41000,
    "mini|cooper": 25000, "mini|countryman": 31000, "mini|clubman": 29000, "smart|forfour": 18500, "smart|fortwo": 15500,
    "audi|a1": 25000, "audi|a4": 46000, "audi|a4 avant": 45000, "audi|a5": 55000, "audi|a6": 62000, "audi|q2": 31000, "audi|q5": 52000,
    "bmw|serie 2": 36000, "bmw|serie 5": 62000, "bmw|x2": 45000, "bmw|x3": 55000, "bmw|x5": 85000,
    "mercedes-benz|cla": 42000, "mercedes-benz|classe b": 38000, "mercedes-benz|classe c": 52000, "mercedes-benz|classe e": 66000, "mercedes-benz|glb": 48000, "mercedes-benz|glc": 62000,
    "volkswagen|passat": 38000, "volkswagen|up": 14000, "volkswagen|taigo": 26000, "fiat|500x": 27000, "fiat|500l": 24000, "fiat|panda cross": 19000,
    "alfa romeo|giulia": 46000, "alfa romeo|tonale": 40000, "jeep|avenger": 26000, "ford|focus": 26000, "ford|kuga": 38000, "opel|astra": 27000, "opel|mokka": 28000,
    "peugeot|2008": 28000, "peugeot|308": 28000, "renault|megane": 27000, "toyota|corolla": 28000, "toyota|rav4": 42000, "hyundai|tucson": 36000, "kia|ceed": 25000, "kia|picanto": 15000,
    "suzuki|swift": 19000, "suzuki|vitara": 28000, "citroen|c4": 26000, "citroen|c3 aircross": 24000, "seat|ibiza": 19500, "seat|arona": 24000, "skoda|fabia": 19000, "skoda|kamiq": 25000,
  };
  const ANNO_OGGI = () => new Date().getFullYear();
  /* listino di un modello: esatto; altrimenti il modello più vicino della stessa marca («a4 avant» → «a4»); altrimenti la media della marca; altrimenti un valore medio */
  const listinoDi = (marca, modello) => {
    const ma = norm(marca), mo = norm(modello), esatto = LISTINO[ma + "|" + mo];
    if (esatto != null) return { valore: esatto, noto: true };
    const stessa = Object.keys(LISTINO).filter((k) => k.split("|")[0] === ma).map((k) => [k.split("|")[1], LISTINO[k]]);
    const vicino = stessa.filter(([m]) => mo.startsWith(m + " ") || m.startsWith(mo + " ")).sort((a, b) => b[0].length - a[0].length)[0];
    if (vicino) return { valore: vicino[1], noto: true };
    if (stessa.length) return { valore: Math.round(stessa.reduce((t, x) => t + x[1], 0) / stessa.length / 500) * 500, noto: false };
    return { valore: 15000 + (hash(ma + "|" + mo) % 20000), noto: false };
  };
  M.listinoNoto = (marca, modello) => listinoDi(marca, modello).noto;

  /* annunci inventati ma coerenti: il prezzo scende con l'età e con i km, c'è un po' di casualità; stesso modello → stessi annunci */
  M.genera = function ({ marca, modello, anno, km }, opz) {
    const o = opz || {}, oggi = o.anno || ANNO_OGGI(), n = o.n || 40, chiave = norm(marca) + "|" + norm(modello);
    const { valore: listino, noto } = listinoDi(marca, modello);
    const r = rng(hash(chiave + "|" + (anno || "")));
    const centro = Math.min(oggi, anno || oggi - 4), scarti = [-2, -1, -1, -1, 0, 0, 0, 0, 1, 1, 1, 2], out = [];
    for (let i = 0; i < n; i++) {
      const a = Math.min(oggi, centro + scarti[Math.floor(r() * scarti.length)]), eta = Math.max(0, oggi - a);
      const kmAtteso = 4000 + eta * 13500, k = Math.round((kmAtteso * (0.55 + r() * 0.95)) / 100) * 100;
      const base = listino * (0.35 + 0.65 * Math.exp(-0.12 * eta)), corr = (kmAtteso - k) * 0.065 * (listino / 25000);
      const p = Math.round(((base + corr) * (0.94 + r() * 0.12)) / 100) * 100 - 100;          // prezzi «tondi meno 100», come negli annunci
      if (p > 1500) out.push({ prezzo: p, km: k, anno: a });
    }
    return { annunci: out, modelloNoto: noto };
  };

  /* ---------- fonti ---------- */
  const FONTE = {
    esempio: { id: "esempio", nome: "Dati di esempio", reale: false, nota: "Prezzi generati dal programma per la demo: non vengono da nessun portale e non vanno usati per decidere." },
    feed: { id: "feed", nome: "Feed autorizzato", reale: true, nota: "" },
    manuale: { id: "manuale", nome: "Annunci inseriti da te", reale: true, nota: "" },
  };
  M.FONTE = FONTE;

  const messaggio = (stato) => ({
    401: "Per leggere i prezzi di mercato devi essere collegato.",
    501: "La fonte dei prezzi di mercato non è collegata.", 503: "La fonte dei prezzi di mercato non è collegata.",
    502: "La fonte dei prezzi di mercato non risponde: riprova tra poco.", 429: "Troppe richieste alla fonte dei prezzi: riprova tra poco.",
  }[stato] || "La fonte dei prezzi di mercato ha dato un errore (" + stato + ").");

  /* Cerca gli annunci simili. cfg = { fonte: "auto" | "esempio" | "feed" | "manuale", urlFeed }.
     Restituisce { annunci, fonte, errore? }: con errore (o fonte manuale) annunci è vuoto e si lavora con quelli inseriti a mano. */
  M.cerca = async function (auto, cfg, ambiente) {
    cfg = cfg || {}; ambiente = ambiente || {};
    const f = cfg.fonte || "auto";
    if (!auto || !auto.marca) return { annunci: [], fonte: FONTE.manuale };
    if (f === "manuale") return { annunci: [], fonte: FONTE.manuale };
    if (f === "esempio") {
      const g = M.genera(auto, { anno: ambiente.anno });
      return { annunci: g.annunci, fonte: Object.assign({}, FONTE.esempio, { aggiornato: ambiente.oggi || "", nota: FONTE.esempio.nota + (g.modelloNoto ? "" : " Modello fuori tabella: valori ancora più indicativi.") }) };
    }
    // feed (o auto: si prova il feed solo se il gestionale è collegato al server)
    if (f === "auto" && !ambiente.online) return { annunci: [], fonte: FONTE.manuale };
    const qs = new URLSearchParams({ marca: auto.marca, modello: auto.modello || "" });
    if (auto.anno) qs.set("anno", auto.anno);
    if (auto.km) qs.set("km", auto.km);
    let r;
    try { r = await (ambiente.fetch || fetch)((cfg.urlFeed || "../api/admin/mercato") + "?" + qs, { credentials: "same-origin", cache: "no-store" }); }
    catch (e) { return { annunci: [], fonte: FONTE.manuale, errore: "Nessuna connessione alla fonte dei prezzi.", codice: "rete" }; }
    if (!r.ok) return { annunci: [], fonte: FONTE.manuale, errore: f === "auto" && (r.status === 501 || r.status === 503 || r.status === 404) ? "" : messaggio(r.status), codice: r.status };
    let j = null; try { j = await r.json(); } catch (e) {}
    const ann = M.pulisci(j && j.annunci);
    if (!ann.length) return { annunci: [], fonte: FONTE.manuale, errore: "La fonte non ha trovato annunci per questo modello.", codice: "vuoto" };
    return { annunci: ann, fonte: Object.assign({}, FONTE.feed, { nome: String((j && j.fonte) || FONTE.feed.nome).slice(0, 60), aggiornato: String((j && j.aggiornato) || "").slice(0, 10) }) };
  };

  /* tiene solo annunci con prezzo sensato; km e anno possono mancare */
  M.pulisci = function (lista) {
    return (Array.isArray(lista) ? lista : []).map((x) => ({ prezzo: Math.round(+x.prezzo), km: x.km == null || x.km === "" ? null : Math.round(+x.km), anno: x.anno == null || x.anno === "" ? null : Math.round(+x.anno) }))
      .filter((x) => isFinite(x.prezzo) && x.prezzo >= 500 && x.prezzo <= 500000 && (x.km == null || (isFinite(x.km) && x.km >= 0 && x.km < 1000000)) && (x.anno == null || (x.anno >= 1980 && x.anno <= 2100))).slice(0, 400);
  };

  if (typeof module !== "undefined" && module.exports) module.exports = M;
  else { const GT = (radice.GT = radice.GT || {}); GT.Mercato = M; }
})(typeof window !== "undefined" ? window : globalThis);
