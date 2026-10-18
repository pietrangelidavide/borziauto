/* AutoProfit · calcoli del gestionale: stima del prezzo e previsioni per la flotta.
   Qui dentro non c'è interfaccia: sono funzioni pure, provate con _work/t_calcoli.mjs.
   Tutto parte da dati che hai tu: gli annunci che incolli o importi, le tue vendite, il tuo storico. */
(function (radice) {
  "use strict";
  const C = {};
  const norm = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  C.norm = norm;

  /* ---------- statistiche ---------- */
  const ordina = (a) => a.slice().sort((x, y) => x - y);
  const quantile = (s, q) => {                                   // s già ordinato
    if (!s.length) return null;
    const p = (s.length - 1) * Math.min(1, Math.max(0, q)), i = Math.floor(p), f = p - i;
    return i + 1 < s.length ? s[i] + (s[i + 1] - s[i]) * f : s[i];
  };
  const somma = (a) => a.reduce((x, y) => x + y, 0);
  const media = (a) => (a.length ? somma(a) / a.length : null);
  const mediana = (a) => quantile(ordina(a), 0.5);
  const limita = (x, a, b) => Math.min(b, Math.max(a, x));
  C.stat = { quantile, media, mediana, ordina };

  /* ---------- numeri e date (stesse regole del gestionale) ---------- */
  C.numero = function (v) {
    if (v == null || v === "") return null;
    if (typeof v === "number") return isFinite(v) ? v : null;
    let s = String(v).replace(/[^\d.,\-]/g, "");
    if (!/\d/.test(s)) return null;
    const lp = s.lastIndexOf("."), lc = s.lastIndexOf(","), last = Math.max(lp, lc);
    if (last >= 0) {
      const dec = s.length - last - 1;
      if (dec === 3) s = s.replace(/[.,]/g, "");
      else s = s.slice(0, last).replace(/[.,]/g, "") + "." + s.slice(last + 1);
    }
    const n = parseFloat(s);
    return isFinite(n) ? n : null;
  };
  C.dataIso = function (v) {
    if (v == null || v === "") return "";
    const s = String(v).trim();
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/.exec(s);
    if (m) { const y = m[3].length === 2 ? "20" + m[3] : m[3]; return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; }
    m = /^(\d{1,2})[\/.\-](\d{4})$/.exec(s);
    if (m) return `${m[2]}-${m[1].padStart(2, "0")}-01`;
    if (/^\d{5}(\.\d+)?$/.test(s) && +s > 30000 && +s < 70000) return new Date(Date.UTC(1899, 11, 30) + Math.floor(+s) * 864e5).toISOString().slice(0, 10);
    return null;                                                  // non riconosciuta
  };
  const ms = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  const giorniTra = (a, b) => Math.round((ms(b) - ms(a)) / 864e5);
  const aggiungiGiorni = (iso, n) => new Date(ms(iso) + n * 864e5).toISOString().slice(0, 10);
  const mese = (iso) => iso.slice(0, 7);
  const aggiungiMesi = (m, n) => { const t = +m.slice(0, 4) * 12 + (+m.slice(5, 7) - 1) + n; return Math.floor(t / 12) + "-" + String((t % 12) + 1).padStart(2, "0"); };
  const diffMesi = (a, b) => (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7));
  const iso = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v);
  C.date = { giorniTra, aggiungiGiorni, mese, aggiungiMesi, diffMesi };
  const arrotonda = (x, passo) => Math.round(x / passo) * passo;

  /* =====================================================================
     1. ANNUNCI DI MERCATO (incollati dalla ricerca di AutoScout24 o importati)
     ===================================================================== */
  const PREZZO_RE = /(?:€|eur\.?)\s*(\d{1,3}(?:[.\s']\d{3})+|\d{3,7})|(\d{1,3}(?:[.\s']\d{3})+|\d{3,7})\s*(?:€|eur\b)/i;
  const KM_RE = /(\d{1,3}(?:[.\s']\d{3})+|\d{1,7})\s*km\b/i;
  const MESEANNO_RE = /\b(0?[1-9]|1[0-2])\s*[\/.\-]\s*((?:19[89]|20[0-3])\d)\b/;
  const ANNO_RE = /\b((?:19[89]|20[0-3])\d)\b/;
  const cifre = (t) => +String(t).replace(/[.\s']/g, "");
  const annoMax = () => new Date().getFullYear() + 1;
  const valido = (r) => {
    if (r.prezzo != null && (r.prezzo < 300 || r.prezzo > 500000)) r.prezzo = null;
    if (r.km != null && (r.km < 0 || r.km > 1000000)) r.km = null;
    if (r.anno != null && (r.anno < 1980 || r.anno > annoMax())) r.anno = null;
    return r;
  };

  /* Legge il testo copiato dalla pagina dei risultati (o scritto a mano, una riga per annuncio).
     Un nuovo annuncio inizia a ogni prezzo con il simbolo €; km e anno si legano all'ultimo prezzo.
     Le righe fatte di soli numeri valgono come «prezzo km anno». */
  C.leggiAnnunci = function (testo) {
    const out = [];
    let cur = null;
    const chiudi = () => { if (cur && cur.prezzo != null) out.push(cur); cur = null; };
    String(testo || "").replace(/[  ]/g, " ").split(/\r?\n/).forEach((r0) => {
      let r = r0.trim();
      if (!r) return;
      // righe di soli numeri: prezzo, km, anno
      const soli = r.split(/[\s;\t|]+/).filter(Boolean);
      if (soli.length >= 1 && soli.length <= 3 && soli.every((t) => /^[\d.,]+$/.test(t)) && !/€|km/i.test(r) && r.length > 3) {
        chiudi();
        const n = soli.map(C.numero);
        const rec = { prezzo: null, km: null, anno: null };
        n.forEach((v, i) => { if (v == null) return; if (v >= 1980 && v <= annoMax() && (i === n.length - 1 || i === 2) && n.length > 1) rec.anno = v; else if (rec.prezzo == null) rec.prezzo = v; else if (rec.km == null) rec.km = v; });
        if (n.length === 1 && n[0] >= 1980 && n[0] <= annoMax()) return;
        if (valido(rec).prezzo != null) out.push(rec);
        return;
      }
      const rata = /\b(mese|mensil|rata|anticipo|tan\b|taeg|\/m\b)/i.test(r);
      let p = null, k = null, y = null;
      if (!rata) { const m = PREZZO_RE.exec(r); if (m) { p = cifre(m[1] || m[2]); r = r.replace(m[0], " "); } }
      { const m = KM_RE.exec(r); if (m) { k = cifre(m[1]); r = r.replace(m[0], " "); } }
      { const m = MESEANNO_RE.exec(r); if (m) { y = +m[2]; r = r.replace(m[0], " "); } else { const a = ANNO_RE.exec(r); if (a && /(immatr|anno|reg|\b)/i.test(r) && (k != null || p != null || r.trim().length < 18 || /immatr|anno/i.test(r))) y = +a[1]; } }
      if (p != null) { chiudi(); cur = { prezzo: p, km: null, anno: null }; }
      if (cur) { if (k != null && cur.km == null) cur.km = k; if (y != null && cur.anno == null) cur.anno = y; }
    });
    chiudi();
    return out.map(valido).filter((r) => r.prezzo != null);
  };

  /* Da una tabella (CSV/Excel già letto in righe): intestazioni prezzo, km, anno/immatricolazione. */
  C.annunciDaTabella = function (righe) {
    const hn = (h) => norm(h).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const A = { prezzo: ["prezzo", "prezzo_richiesto", "price", "importo", "prezzo_annuncio"], km: ["km", "chilometri", "chilometraggio", "kilometri"], anno: ["anno", "immatricolazione", "anno_immatricolazione", "data_immatricolazione", "first_registration", "year"] };
    const hi = righe.slice(0, 10).findIndex((r) => r.some((c) => A.prezzo.includes(hn(c))));
    if (hi < 0) return [];
    const col = {};
    righe[hi].forEach((c, i) => { for (const k in A) if (A[k].includes(hn(c)) && col[k] == null) col[k] = i; });
    const out = [];
    for (let i = hi + 1; i < righe.length; i++) {
      const r = righe[i] || [];
      const rec = valido({ prezzo: C.numero(r[col.prezzo]), km: col.km != null ? C.numero(r[col.km]) : null, anno: col.anno != null ? C.annoDa(r[col.anno]) : null });
      if (rec.prezzo != null) out.push(rec);
    }
    return out;
  };
  C.annoDa = function (v) {
    if (v == null || v === "") return null;
    const m = /(?:^|[^\d])((?:19|20)\d{2})(?:[^\d]|$)/.exec(String(v));
    if (m) return +m[1];
    const n = C.numero(v);
    return n && n >= 1950 && n <= 2100 ? Math.round(n) : null;
  };

  /* Indirizzo della ricerca su AutoScout24 già filtrata per marca, modello e anno.
     (Formato degli indirizzi osservato sul sito; se AutoScout24 lo cambia, il link apre comunque la ricerca generica.) */
  const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  C.linkRicerca = function ({ marca, modello, anno, km }) {
    const m = slug(marca), mo = slug(modello);
    if (!m) return "https://www.autoscout24.it/lst";
    const q = ["atype=C", "cy=I", "sort=standard", "desc=0"];
    if (anno) { q.push("fregfrom=" + (anno - 1), "fregto=" + (anno + 1)); }
    if (km) q.push("kmto=" + Math.ceil((km * 1.5) / 5000) * 5000);
    return "https://www.autoscout24.it/lst/" + m + (mo ? "/" + mo : "") + "?" + q.join("&");
  };

  /* =====================================================================
     2. STIMA DEL PREZZO
     ===================================================================== */
  C.APPROCCI = [
    { id: "fretta", nome: "Vendere in fretta", q: 0.25, breve: "Prezzo tra i più bassi del mercato" },
    { id: "equilibrato", nome: "Equilibrato", q: 0.5, breve: "Nella media del mercato" },
    { id: "margine", nome: "Margine massimo", q: 0.75, breve: "Prezzo tra i più alti, serve più tempo" },
  ];
  /* regola pratica: più si sta in alto sul mercato, più ci si mette a vendere (0,6× in basso, 1× nella media, 1,4× in alto) */
  C.fattoreGiorni = (q) => limita(0.6 + 1.6 * (q - 0.25), 0.4, 2.2);

  /* comps: [{prezzo, km, anno, fonte?}]; esclusi: indici da non usare. Restituisce statistiche e annunci con il loro stato. */
  C.stimaMercato = function ({ anno, km, comps, esclusi, tolleranzaAnni }) {
    const escl = new Set(esclusi || []);
    const tutti = (comps || []).map((c, i) => ({ i, prezzo: c.prezzo, km: c.km == null ? null : c.km, anno: c.anno == null ? null : c.anno, fonte: c.fonte || "" })).filter((c) => c.prezzo > 0);
    const note = [];
    let t = tolleranzaAnni == null ? 1 : tolleranzaAnni;
    const nellaFinestra = (tol) => tutti.filter((c) => !anno || c.anno == null || Math.abs(c.anno - anno) <= tol);
    let fin = nellaFinestra(t);
    if (anno && fin.filter((c) => !escl.has(c.i)).length < 6 && t < 2) { const f2 = nellaFinestra(2); if (f2.length > fin.length) { t = 2; fin = f2; note.push("Pochi annunci dell’anno giusto: ho allargato a ±2 anni."); } }
    const dentro = new Set(fin.map((c) => c.i));
    // correzione per i chilometri: retta prezzo~km sugli annunci della finestra (solo se ce ne sono abbastanza)
    const base = fin.filter((c) => !escl.has(c.i) && c.km != null);
    let pendenza = 0;
    if (km != null && base.length >= 6) {
      const mx = media(base.map((c) => c.km));
      if (Math.sqrt(media(base.map((c) => (c.km - mx) ** 2))) >= 4000) {
        // pendenza di Theil-Sen (mediana delle pendenze tra coppie di annunci): non si lascia spostare dai prezzi anomali
        let P = base; if (P.length > 120) { const passo = Math.ceil(P.length / 120); P = P.filter((_, i) => i % passo === 0); }
        const sl = [];
        for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { const dx = P[j].km - P[i].km; if (Math.abs(dx) >= 1500) sl.push((P[j].prezzo - P[i].prezzo) / dx); }
        const b = sl.length >= 10 ? mediana(sl) : 0;
        if (b < -0.005) pendenza = Math.max(b, -0.3);
      }
    }
    const corretto = (c) => (pendenza && km != null && c.km != null ? c.prezzo + limita(pendenza * (km - c.km), -0.25 * c.prezzo, 0.25 * c.prezzo) : c.prezzo);
    let lista = tutti.map((c) => ({ ...c, corretto: Math.round(corretto(c)), usata: dentro.has(c.i) && !escl.has(c.i), motivo: !dentro.has(c.i) ? "anno diverso" : escl.has(c.i) ? "escluso da te" : "" }));
    // prezzi anomali (regola dei quartili): solo se gli annunci sono almeno 8
    const attivi = lista.filter((c) => c.usata);
    if (attivi.length >= 8) {
      const s = ordina(attivi.map((c) => c.corretto)), q1 = quantile(s, 0.25), q3 = quantile(s, 0.75), d = q3 - q1;
      lista.forEach((c) => { if (c.usata && (c.corretto < q1 - 1.5 * d || c.corretto > q3 + 1.5 * d)) { c.usata = false; c.motivo = "prezzo anomalo"; } });
    }
    const prezzi = ordina(lista.filter((c) => c.usata).map((c) => c.corretto));
    const n = prezzi.length;
    const affidabilita = n >= 12 ? "alta" : n >= 6 ? "media" : n >= 3 ? "bassa" : "insufficiente";
    if (affidabilita === "bassa") note.push("Meno di 6 annunci: la stima è solo indicativa.");
    if (n >= 3 && km != null && !pendenza) note.push(base.length >= 6 ? "I chilometri degli annunci sono simili ai tuoi: nessuna correzione." : "Per correggere in base ai chilometri servono almeno 6 annunci con i km.");
    if (n >= 3 && pendenza) note.push(`Prezzi corretti per i chilometri (circa ${(-pendenza).toFixed(2).replace(".", ",")} € in meno per ogni km in più).`);
    const stat = n ? { n, min: prezzi[0], p10: quantile(prezzi, 0.1), p25: quantile(prezzi, 0.25), mediana: quantile(prezzi, 0.5), p75: quantile(prezzi, 0.75), p90: quantile(prezzi, 0.9), max: prezzi[n - 1], media: media(prezzi) } : null;
    return {
      n, totali: tutti.length, tolleranza: t, pendenza, affidabilita, note, stat, comps: lista,
      prezzoA: (q) => (n >= 3 ? quantile(prezzi, q) : null),
      quotaPiuCari: (p) => (n ? prezzi.filter((x) => x > p).length / n : null),      // quota di annunci più cari di p
    };
  };

  /* costi dell'auto: acquisto, costi extra già sostenuti, lavori ancora da fare (check-list), costi di vendita */
  C.lavoriDaFare = (a) => ((a && a.checklist && a.checklist.voci) || []).filter((v) => v.s === "da_fare").reduce((t, v) => t + (+v.costo || 0), 0);
  C.costiAuto = function (a, imp) {
    imp = imp || {};
    const c = {
      acquisto: a && a.costo_acquisto != null ? +a.costo_acquisto : null, extra: +(a && a.costi_extra) || 0, lavori: C.lavoriDaFare(a), vendita: +imp.costi_vendita || 0,
    };
    c.diretti = (c.acquisto || 0) + c.extra + c.lavori + c.vendita;
    c.acquistoNoto = c.acquisto != null;
    return c;
  };

  /* prezzo e guadagno per una posizione sul mercato (q = 0,25 fretta … 0,75 margine) */
  C.piano = function ({ mercato, q, costi, giorniBase, costoGiorno, trattativa, margineMin, passo }) {
    const grezzo = mercato ? mercato.prezzoA(q) : null;
    if (grezzo == null) return null;
    const prezzo = arrotonda(grezzo, passo || 100);
    const tr = trattativa == null ? 0.03 : trattativa;
    const chiuso = Math.round(prezzo * (1 - tr));
    const giorni = giorniBase != null ? Math.max(1, Math.round(giorniBase * C.fattoreGiorni(q))) : null;
    const giacenza = giorni != null ? giorni * (costoGiorno || 0) : 0;
    const tot = costi.diretti + giacenza;
    const guadagnoListino = prezzo - tot, guadagno = chiuso - tot;
    return {
      q, prezzo, chiuso, giorni, giacenza, costiTotali: tot, guadagnoListino, guadagno,
      margineSuCosti: tot > 0 ? guadagno / tot : null, guadagnoGiorno: giorni ? guadagno / giorni : null,
      sottoCosti: guadagno < 0, sottoMinimo: margineMin != null && guadagno < margineMin,
      piuEconomicoDi: mercato.quotaPiuCari(prezzo),
    };
  };

  /* prezzo sotto il quale non conviene scendere: costi + guadagno minimo voluto, dopo la trattativa */
  C.prezzoMinimo = ({ costi, margineMin, trattativa, passo }) => arrotonda((costi.diretti + (margineMin || 0)) / (1 - (trattativa == null ? 0.03 : trattativa)), passo || 100);

  /* ---------- QUANTO PAGARE ----------
     Al contrario del prezzo di vendita: dal prezzo a cui pensi di rivendere (secondo l'approccio scelto) si tolgono la trattativa,
     i lavori, i costi di vendita e quelli di tenere l'auto in garage, e il guadagno minimo che vuoi. Quello che resta è il massimo da pagare.
     «Apertura» e «obiettivo» lasciano più margine del minimo (2× e 1,5×): sono una regola pratica, modificabile in C.REGOLE_ACQUISTO. */
  C.REGOLE_ACQUISTO = { apertura: 2, obiettivo: 1.5 };
  C.pagare = function ({ mercato, q, costi, giorniBase, costoGiorno, trattativa, margineMin, richiesta, passo }) {
    if (!mercato) return null;
    const c = costi || {}, altri = (c.extra || 0) + (c.lavori || 0) + (c.vendita || 0);
    const p = C.piano({ mercato, q, costi: { diretti: altri, acquisto: 0, acquistoNoto: true }, giorniBase, costoGiorno, trattativa, margineMin, passo });
    if (!p) return null;
    const pas = passo || 100, mm = margineMin || 0;
    const unita = mm > 0 ? mm : Math.max(500, arrotonda(p.chiuso * 0.05, 100));
    const giu = (x) => Math.max(0, Math.floor(x / pas) * pas);
    const lordo = p.guadagno;                                  // quanto resta dopo trattativa, altri costi e giacenza, prima di pagare l'auto
    const massimo = giu(lordo - mm), obiettivo = Math.min(massimo, giu(lordo - unita * C.REGOLE_ACQUISTO.obiettivo)), apertura = Math.min(obiettivo, giu(lordo - unita * C.REGOLE_ACQUISTO.apertura));
    const r = {
      q, prezzoVendita: p.prezzo, chiuso: p.chiuso, giorni: p.giorni, giacenza: p.giacenza, altriCosti: altri, costiConGiacenza: p.costiTotali,
      lordo, margineMin: mm, massimo, obiettivo, apertura, nonConviene: lordo - mm <= 0, richiesta: richiesta == null ? null : richiesta,
    };
    if (richiesta != null && isFinite(richiesta)) {
      r.margineRichiesta = lordo - richiesta;
      r.verdetto = richiesta <= obiettivo ? "ottimo" : richiesta <= massimo ? "trattabile" : "caro";
      r.scontoNecessario = Math.max(0, richiesta - massimo);
      r.scontoPercento = richiesta > 0 ? r.scontoNecessario / richiesta : 0;
    }
    return r;
  };

  /* =====================================================================
     3. STORICO E PREVISIONI PER LA FLOTTA
     ===================================================================== */
  /* riga dello storico (CSV) → record pulito; null se non si capisce la data di vendita */
  C.normalizzaStorico = function (r) {
    const dv = C.dataIso(r.data_vendita), da = r.data_acquisto ? C.dataIso(r.data_acquisto) : "";
    if (!dv) return null;
    const out = {
      id: String(r.id || "").trim(), marca: String(r.marca || "").trim(), modello: String(r.modello || "").trim(), anno: r.anno != null && r.anno !== "" ? C.annoDa(r.anno) : null,
      km: C.numero(r.km), alimentazione: String(r.alimentazione || "").trim(), carrozzeria: String(r.carrozzeria || "").trim(), targa: String(r.targa || "").trim().toUpperCase(),
      data_acquisto: da || "", data_vendita: dv, costo_acquisto: C.numero(r.costo_acquisto), costi_extra: C.numero(r.costi_extra), prezzo_vendita: C.numero(r.prezzo_vendita),
    };
    const g = C.numero(r.giorni);
    if (!out.data_acquisto && g != null && g >= 0 && g < 1500) out.data_acquisto = aggiungiGiorni(dv, -Math.round(g));
    return out;
  };

  /* identifica una vendita: la targa, oppure marca, modello, anno, km, data e prezzo */
  C.chiaveStorico = (r) => (r.targa ? "t|" + r.targa : [norm(r.marca), norm(r.modello), r.anno || "", r.km || "", r.data_vendita, r.prezzo_vendita || ""].join("|"));

  /* storia completa = auto vendute nel gestionale + righe dello storico importato (senza doppioni) */
  C.storia = function (auto, storico) {
    const righe = [];
    (auto || []).forEach((a) => { if (a.stato === "venduta" && iso(a.data_vendita)) righe.push({ id: a.id, marca: a.marca, modello: a.modello, anno: a.anno, km: a.km, alimentazione: a.alimentazione, carrozzeria: a.carrozzeria, targa: a.targa, data_acquisto: a.data_acquisto, data_vendita: a.data_vendita, costo_acquisto: a.costo_acquisto, costi_extra: a.costi_extra, prezzo_vendita: a.prezzo_vendita, fonte: "gestionale" }); });
    (storico || []).forEach((s) => { if (iso(s.data_vendita)) righe.push({ ...s, fonte: "storico" }); });
    const viste = new Set(), out = [];
    righe.forEach((r) => {
      const chiave = C.chiaveStorico(r);
      if (viste.has(chiave)) return;
      viste.add(chiave);
      const g = iso(r.data_acquisto) && iso(r.data_vendita) ? giorniTra(r.data_acquisto, r.data_vendita) : null;
      const costo = r.costo_acquisto != null ? r.costo_acquisto + (r.costi_extra || 0) : null;
      out.push({ ...r, giorni: g != null && g >= 0 && g < 1500 ? g : null, costo, margine: costo != null && r.prezzo_vendita != null ? r.prezzo_vendita - costo : null });
    });
    return out.sort((a, b) => (a.data_vendita < b.data_vendita ? -1 : 1));
  };

  C.giacenza = function (storia) {
    const d = ordina((storia || []).filter((r) => r.giorni != null).map((r) => r.giorni));
    if (!d.length) return { n: 0, durate: [], mediana: null, media: null, p25: null, p75: null, p90: null };
    return { n: d.length, durate: d, mediana: quantile(d, 0.5), media: media(d), p25: quantile(d, 0.25), p75: quantile(d, 0.75), p90: quantile(d, 0.9) };
  };

  /* vendite per mese negli ultimi `mesi` mesi (l'ultimo è il mese in corso, parziale) */
  C.venditeMensili = function (storia, oggi, mesi) {
    mesi = mesi || 24;
    const fine = mese(oggi), via = {};
    (storia || []).forEach((r) => { const m = mese(r.data_vendita); via[m] = (via[m] || 0) + 1; });
    const out = [];
    for (let i = mesi - 1; i >= 0; i--) { const m = aggiungiMesi(fine, -i); out.push({ mese: m, n: via[m] || 0, parziale: m === fine }); }
    return out;
  };

  /* indice stagionale per mese (1 = mese normale). Serve almeno un anno di storico; con poco storico si resta vicino a 1. */
  C.stagionalita = function (storia, oggi) {
    const neutra = { indici: Array(12).fill(1), affidabile: false, mesiDati: 0 };
    if (!storia || storia.length < 12) return neutra;
    const fine = aggiungiMesi(mese(oggi), -1);                        // ultimo mese completo
    const primo = mese(storia[0].data_vendita);
    const mesiDati = diffMesi(primo, fine) + 1;
    if (mesiDati < 12) return { ...neutra, mesiDati };
    const cont = Array(12).fill(0), occ = Array(12).fill(0);
    for (let i = 0; i < mesiDati; i++) occ[+aggiungiMesi(primo, i).slice(5, 7) - 1]++;
    storia.forEach((r) => { const m = mese(r.data_vendita); if (m >= primo && m <= fine) cont[+m.slice(5, 7) - 1]++; });
    const tot = somma(cont) / mesiDati;
    if (!(tot > 0)) return { ...neutra, mesiDati };
    const lambda = (m) => occ[m] / (occ[m] + 1);
    const indici = cont.map((c, m) => { const raw = c / occ[m] / tot; return 1 + lambda(m) * (raw - 1); });
    return { indici, affidabile: mesiDati >= 18, mesiDati };
  };

  /* vendite al mese «normali» (ultimi 12 mesi completi, o quelli disponibili) */
  C.ritmoMensile = function (storia, oggi) {
    if (!storia || !storia.length) return null;
    const fine = aggiungiMesi(mese(oggi), -1), primo = mese(storia[0].data_vendita);
    const mesiDati = diffMesi(primo, fine) + 1;
    if (mesiDati < 2) return null;
    const k = Math.min(12, mesiDati), da = aggiungiMesi(fine, -(k - 1));
    return storia.filter((r) => mese(r.data_vendita) >= da && mese(r.data_vendita) <= fine).length / k;
  };

  /* probabilità che un'auto ferma da `eta` giorni si venda entro altri `orizzonte` giorni, dalle durate dello storico.
     Con poche durate si passa gradualmente a un modello senza memoria (tempo medio di giacenza). */
  C.probVendita = function (eta, orizzonte, g) {
    if (orizzonte <= 0) return 0;
    const memoria = g.media ? 1 - Math.exp(-orizzonte / g.media) : null;
    const dopo = g.durate.filter((x) => x > eta);
    const emp = dopo.length ? dopo.filter((x) => x <= eta + orizzonte).length / dopo.length : null;
    if (emp == null) return memoria == null ? null : memoria;
    const w = Math.min(1, dopo.length / 10);
    return memoria == null ? emp : w * emp + (1 - w) * memoria;
  };
  const cdf = (t, g) => (t <= 0 ? 0 : C.probVendita(0, t, g));        // auto nuova in vendita

  C.etaGiorni = (a, oggi) => (iso(a.data_acquisto) ? Math.max(0, giorniTra(a.data_acquisto, oggi)) : null);

  /* Previsione: quante auto escono, quante ne servono per tenere il garage pieno e quando comprarle.
     opzioni: posti, ritardoIngresso (giorni tra acquisto e auto in vendita), obiettivo (0-1),
     giorniPreparazione (per le auto ancora in preparazione), settimane, maxIngressi (auto che riesci a comprare al massimo ogni settimana).
     Due metodi: «durate» (probabilità di vendita di ogni auto dallo storico dei giorni in garage, serve qualche decina di vendite)
     oppure «ritmo» (vendite al mese, con meno storico). */
  C.previsione = function ({ auto, storia, oggi, posti, ritardoIngresso, obiettivo, giorniPreparazione, settimane, maxIngressi }) {
    const W = settimane || 12, ritardo = ritardoIngresso == null ? 14 : ritardoIngresso, prep = giorniPreparazione == null ? 7 : giorniPreparazione;
    const g = C.giacenza(storia), ritmo = C.ritmoMensile(storia, oggi), stag = C.stagionalita(storia, oggi);
    const inGarage = (auto || []).filter((a) => a.stato === "disponibile");
    const attuali = inGarage.length;
    const metodo = g.n >= 8 ? "durate" : ritmo != null && ritmo > 0 ? "ritmo" : null;
    const out = { metodo, posti: posti || 0, attuali, giacenza: g, ritmo, stagionalita: stag, settimane: [], senzaStorico: metodo == null, senzaPosti: !posti, senzaData: 0, affidabilita: "nessuna" };
    out.affidabilita = !metodo ? "nessuna" : storia.length >= 40 && stag.affidabile ? "buona" : storia.length >= 15 ? "media" : "bassa";
    if (!metodo) return out;

    const inizio = (w) => aggiungiGiorni(oggi, 7 * w);
    const idx = (w) => (stag.affidabile ? stag.indici[+mese(aggiungiGiorni(oggi, 7 * w - 3)).slice(5, 7) - 1] : 1);
    const esistenti = inGarage.map((a) => {
      let eta = C.etaGiorni(a, oggi);
      if (eta == null) { eta = 0; out.senzaData++; }
      return { eta, inPrep: a.preparazione === true };
    });
    const P = (a, giorni) => (a.inPrep ? (giorni <= prep ? 0 : C.probVendita(0, giorni - prep, g)) : C.probVendita(a.eta, giorni, g));
    const bersaglio = posti ? Math.max(0, Math.round(posti * (obiettivo == null ? 1 : obiettivo))) : null;
    const ritmoSett = (w) => (ritmo * idx(w) * 7) / 30.4;
    let occ = attuali, occSenza = attuali;
    const ingressi = Array(W + 1).fill(0);
    const usciteAttuali = [];
    for (let w = 1; w <= W; w++) {
      let uEsist, uNuove = 0;
      if (metodo === "durate") {
        uEsist = esistenti.reduce((t, a) => t + (P(a, 7 * w) - P(a, 7 * (w - 1))), 0) * idx(w);
        for (let e = 1; e < w; e++) if (ingressi[e]) uNuove += ingressi[e] * (cdf(7 * (w - e), g) - cdf(7 * (w - e - 1), g)) * idx(w);
        uEsist = Math.min(Math.max(0, uEsist), occSenza);
      } else {
        uEsist = Math.min(ritmoSett(w), occSenza);
        uNuove = Math.max(0, Math.min(ritmoSett(w), occ) - uEsist);
      }
      usciteAttuali.push(uEsist);
      const uscite = Math.min(occ, uEsist + uNuove);
      const dopo = occ - uscite;
      const arrivoPossibile = 7 * w >= ritardo;                 // prima del tempo di acquisto non può arrivare nulla
      const entrano = bersaglio != null && arrivoPossibile ? Math.min(maxIngressi > 0 ? maxIngressi : Infinity, Math.max(0, Math.round(bersaglio - dopo))) : 0;
      ingressi[w] = entrano;
      occSenza -= uEsist;
      occ = Math.min(posti || Infinity, dopo + entrano);
      const acq = aggiungiGiorni(inizio(w), -ritardo);
      out.settimane.push({ n: w, inizio: inizio(w), uscite, ingressi: entrano, occSenza, occCon: occ, acquistaEntro: acq < oggi ? oggi : acq, urgente: entrano > 0 && acq <= aggiungiGiorni(oggi, 7) });
    }
    out.uscite30 = somma(out.settimane.slice(0, 4).map((s) => s.uscite)) * (30 / 28);
    out.usciteAttuali30 = somma(usciteAttuali.slice(0, 4)) * (30 / 28);          // solo dalle auto già in garage
    out.uscite90 = somma(out.settimane.map((s) => s.uscite)) * (90 / (7 * W));
    out.ingressiTot = somma(out.settimane.map((s) => s.ingressi));
    out.daComprareSubito = somma(out.settimane.filter((s) => s.urgente).map((s) => s.ingressi));
    out.minimo = out.settimane.reduce((m, s) => Math.min(m, s.occCon), Infinity);
    return out;
  };

  /* rendimento per tipo di auto: giorni in garage e margine, per capire su cosa puntare */
  C.fascia = (p) => (p == null ? "" : p < 10000 ? "sotto 10.000 €" : p < 15000 ? "10-15.000 €" : p < 20000 ? "15-20.000 €" : p < 30000 ? "20-30.000 €" : "oltre 30.000 €");
  C.segmenti = function (storia, campo, minimo) {
    minimo = minimo || 3;
    const chiave = (r) => (campo === "fascia" ? C.fascia(r.prezzo_vendita) : campo === "marca_modello" ? [r.marca, r.modello].filter(Boolean).join(" ") : r[campo]) || "";
    const gruppi = {};
    (storia || []).forEach((r) => { const k = String(chiave(r)).trim(); if (!k) return; const key = norm(k); (gruppi[key] = gruppi[key] || { nome: k, righe: [] }).righe.push(r); });
    const out = Object.values(gruppi).map(({ nome, righe }) => {
      const gg = righe.filter((r) => r.giorni != null).map((r) => r.giorni), mm = righe.filter((r) => r.margine != null), cc = righe.filter((r) => r.costo != null && r.costo > 0);
      const giorniMedi = gg.length ? media(gg) : null, margineMedio = mm.length ? media(mm.map((r) => r.margine)) : null;
      const costoMedio = cc.length ? media(cc.map((r) => r.costo)) : null;
      return { nome, n: righe.length, giorniMedi, margineMedio, costoMedio,
        margineGiorno: giorniMedi != null && margineMedio != null ? margineMedio / Math.max(giorniMedi, 7) : null,
        rendimentoAnnuo: giorniMedi != null && margineMedio != null && costoMedio ? (margineMedio / costoMedio) * (365 / Math.max(giorniMedi, 7)) : null,
        pochiDati: righe.length < minimo };
    });
    return out.sort((a, b) => (a.pochiDati - b.pochiDati) || ((b.margineGiorno == null ? -1e9 : b.margineGiorno) - (a.margineGiorno == null ? -1e9 : a.margineGiorno)) || b.n - a.n);
  };

  /* auto ferme da troppo: oltre il tempo in cui si vende il 75% delle auto (o 60 giorni se lo storico è scarso) */
  C.daSpingere = function (auto, storia, oggi, imp) {
    const g = C.giacenza(storia), soglia = g.n >= 8 ? Math.max(30, Math.round(g.p75)) : 60;
    return (auto || []).filter((a) => a.stato === "disponibile" && a.preparazione !== true).map((a) => {
      const eta = C.etaGiorni(a, oggi);
      if (eta == null || eta < soglia) return null;
      const c = C.costiAuto(a, imp);
      const dopo = (r) => (a.prezzo != null && c.acquistoNoto ? Math.round(a.prezzo * (1 - r) - c.diretti) : null);
      return { id: a.id, eta, soglia, vsMediana: g.mediana ? eta / g.mediana : null, prezzo: a.prezzo, margine: dopo(0), ribassi: [0.03, 0.05, 0.08].map((r) => ({ r, prezzo: a.prezzo != null ? arrotonda(a.prezzo * (1 - r), 100) : null, margine: dopo(r) })) };
    }).filter(Boolean).sort((x, y) => y.eta - x.eta);
  };

  /* margine medio per auto-giorno in garage, dallo storico */
  C.margineGiorno = function (storia) {
    const r = (storia || []).filter((x) => x.margine != null && x.giorni != null);
    if (r.length < 3) return null;
    return somma(r.map((x) => x.margine)) / Math.max(1, somma(r.map((x) => Math.max(x.giorni, 7))));
  };

  /* colonne del file CSV dello storico */
  C.COLONNE_STORICO = [
    ["data_vendita", "Data vendita"], ["data_acquisto", "Data acquisto"], ["marca", "Marca"], ["modello", "Modello"], ["anno", "Anno"], ["km", "Km"],
    ["alimentazione", "Alimentazione"], ["carrozzeria", "Carrozzeria"], ["targa", "Targa"], ["costo_acquisto", "Costo acquisto"], ["costi_extra", "Costi extra"], ["prezzo_vendita", "Prezzo vendita"],
  ];
  C.ALIAS_STORICO = {
    data_vendita: ["data_vendita", "data_di_vendita", "venduta_il", "venduto_il", "data_uscita", "uscita", "data_consegna", "vendita"],
    data_acquisto: ["data_acquisto", "data_di_acquisto", "acquistata_il", "data_ingresso", "ingresso", "data_entrata", "entrata", "acquisto_il"],
    marca: ["marca", "brand", "make"], modello: ["modello", "model"], anno: ["anno", "immatricolazione", "anno_immatricolazione"], km: ["km", "chilometri", "chilometraggio"],
    alimentazione: ["alimentazione", "carburante", "fuel"], carrozzeria: ["carrozzeria", "tipo", "segmento"], targa: ["targa", "plate"],
    costo_acquisto: ["costo_acquisto", "costo_di_acquisto", "prezzo_acquisto", "prezzo_di_acquisto", "costo", "acquisto"], costi_extra: ["costi_extra", "ricondizionamento", "spese", "costi_aggiuntivi", "extra"],
    prezzo_vendita: ["prezzo_vendita", "prezzo_di_vendita", "venduta_a", "incasso", "prezzo_finale", "prezzo"], giorni: ["giorni", "giorni_in_stock", "giorni_stock", "giacenza", "giorni_giacenza"], id: ["id", "codice"],
  };
  /* righe di un foglio (prima riga o prime righe = intestazioni) → record dello storico */
  C.storicoDaTabella = function (righe) {
    const hn = (h) => norm(h).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const capisce = (c) => Object.keys(C.ALIAS_STORICO).find((k) => C.ALIAS_STORICO[k].includes(hn(c)));
    const hi = righe.slice(0, 12).findIndex((r) => r.filter((c) => capisce(c)).length >= 2 && r.some((c) => capisce(c) === "data_vendita"));
    if (hi < 0) return { righe: [], scartate: righe.length ? ["Non trovo la riga con le intestazioni: serve almeno la colonna «Data vendita»."] : [], colonne: [] };
    const col = {};
    righe[hi].forEach((c, i) => { const k = capisce(c); if (k && col[k] == null) col[k] = i; });
    const out = [], scartate = [];
    for (let i = hi + 1; i < righe.length; i++) {
      const r = righe[i] || [];
      if (r.every((c) => String(c == null ? "" : c).trim() === "")) continue;
      const raw = {};
      for (const k in col) raw[k] = r[col[k]];
      if (String(raw.id || "").toLowerCase() === "esempio") continue;
      const rec = C.normalizzaStorico(raw);
      if (!rec) { scartate.push(`Riga ${i + 1}: data di vendita mancante o non riconosciuta (usa 15/10/2026).`); continue; }
      out.push(rec);
    }
    return { righe: out, scartate, colonne: Object.keys(col) };
  };

  /* Storico di ESEMPIO per far vedere la scheda Flotta: ~26 mesi (circa 200) di vendite inventate, segnate demo.
     Deterministico (stessa data → stessi dati). Si elimina da «Elimina i dati di esempio». */
  C.demoStorico = function (oggi, quante) {
    const n = quante || 200, modelli = [
      ["BMW", "Serie 1", "Diesel", "Berlina", 21500, 16], ["BMW", "X1", "Diesel", "SUV", 27500, 14], ["Audi", "A3", "Diesel", "Berlina", 22500, 15], ["Audi", "Q3", "Diesel", "SUV", 29500, 12],
      ["Mercedes-Benz", "Classe A", "Benzina", "Berlina", 24500, 15], ["Mercedes-Benz", "GLA", "Diesel", "SUV", 28500, 13], ["Volkswagen", "Golf", "Diesel", "Berlina", 18500, 14],
      ["Volkswagen", "T-Roc", "Benzina", "SUV", 23500, 12], ["MINI", "Cooper", "Benzina", "Citycar", 17500, 22], ["smart", "forfour", "Benzina", "Citycar", 9800, 30],
    ];
    const peso = [0.8, 0.85, 1.0, 1.1, 1.15, 1.1, 0.85, 0.6, 0.9, 1.05, 1.0, 0.8];            // stagionalità inventata (gen…dic)
    let seme = 20260;
    const rnd = () => { seme = (seme * 1103515245 + 12345) % 2147483648; return seme / 2147483648; };
    const out = [], fine = aggiungiGiorni(oggi, -3), inizio = aggiungiGiorni(oggi, -26 * 30);
    const durataTot = giorniTra(inizio, fine);
    let tentativi = 0;
    while (out.length < n && tentativi++ < n * 30) {
      const d = aggiungiGiorni(inizio, Math.floor(rnd() * durataTot));
      if (rnd() > peso[+d.slice(5, 7) - 1] / 1.2) continue;
      const tot = modelli.reduce((s, m) => s + m[5], 0);
      let x = rnd() * tot, m = modelli[0];
      for (const c of modelli) { x -= c[5]; if (x <= 0) { m = c; break; } }
      const giorni = Math.round(14 + (-Math.log(1 - rnd() * 0.97)) * (m[4] > 26000 ? 62 : m[4] < 12000 ? 34 : 46));
      const anno = +d.slice(0, 4) - 2 - Math.floor(rnd() * 4), km = Math.round((12000 + rnd() * 90000) / 100) * 100;
      const acq = Math.round(m[4] * (0.78 + rnd() * 0.1) * (1 - (anno < +d.slice(0, 4) - 4 ? 0.1 : 0)) / 100) * 100;
      const extra = Math.round((250 + rnd() * 900) / 50) * 50;
      const vendita = Math.round((acq + extra) * (1.1 + rnd() * 0.12) / 100) * 100;
      out.push({ id: "demo" + out.length, marca: m[0], modello: m[1], anno, km, alimentazione: m[2], carrozzeria: m[3], targa: "", data_acquisto: aggiungiGiorni(d, -Math.min(giorni, 400)), data_vendita: d, costo_acquisto: acq, costi_extra: extra, prezzo_vendita: vendita, demo: true });
    }
    return out.sort((a, b) => (a.data_vendita < b.data_vendita ? -1 : 1));
  };

  if (typeof module !== "undefined" && module.exports) module.exports = C;
  else { const GT = (radice.GT = radice.GT || {}); GT.Calc = C; }
})(typeof window !== "undefined" ? window : globalThis);
