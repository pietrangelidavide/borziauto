/* AutoProfit · gestionale auto e CRM della flotta.
   I dati stanno nel browser (localStorage per auto e contatti, IndexedDB per le foto).
   Per pubblicare si scarica il pacchetto .zip (auto.json + foto) e lo si carica nel repository del sito. */
AP.pronto.then(function () {
  "use strict";
  const $ = (s, r) => (r || document).querySelector(s);
  const GT = (window.GT = window.GT || {});
  const LS = "autoprofit.gestionale.v1";

  /* ---------- colonne dei file CSV / Excel ---------- */
  const COLS = [
    { k: "id", t: "ID", w: 14 }, { k: "stato", t: "Stato", w: 13 }, { k: "marca", t: "Marca", w: 16 }, { k: "modello", t: "Modello", w: 18 },
    { k: "allestimento", t: "Allestimento", w: 28 }, { k: "anno", t: "Anno", type: "year", w: 8 }, { k: "km", t: "Km", type: "int", w: 11 },
    { k: "alimentazione", t: "Alimentazione", w: 15 }, { k: "cambio", t: "Cambio", w: 13 }, { k: "cv", t: "CV", type: "int", w: 7 },
    { k: "colore", t: "Colore", w: 13 }, { k: "carrozzeria", t: "Carrozzeria", w: 15 }, { k: "prezzo", t: "Prezzo", type: "money", w: 12 },
    { k: "data_vendita", t: "Data vendita", type: "date", w: 14 }, { k: "prezzo_vendita", t: "Prezzo vendita", type: "money", w: 15 },
    { k: "targa", t: "Targa", w: 11 }, { k: "data_acquisto", t: "Data acquisto", type: "date", w: 14 }, { k: "costo_acquisto", t: "Costo acquisto", type: "money", w: 15 },
    { k: "costi_extra", t: "Costi extra", type: "money", w: 12 }, { k: "scad_revisione", t: "Scadenza revisione", type: "date", w: 18 },
    { k: "foto", t: "Foto", w: 22 }, { k: "descrizione", t: "Descrizione", w: 40 },
    { k: "autoscout_url", t: "Link AutoScout24", w: 30 }, { k: "note_interne", t: "Note interne", w: 30 },
  ].map((c) => Object.assign({ type: "text" }, c));
  const PUBBLICI = ["id", "stato", "marca", "modello", "allestimento", "anno", "km", "alimentazione", "cambio", "cv", "colore", "carrozzeria", "prezzo", "data_vendita", "foto", "descrizione", "autoscout_url", "demo"];

  // nomi alternativi di intestazione (senza accenti, minuscoli, con _ al posto degli spazi)
  const ALIAS = {};
  const alias = (k, ...names) => names.forEach((n) => (ALIAS[n] = k));
  alias("id", "id", "codice", "rif", "riferimento", "cod");
  alias("stato", "stato", "status", "disponibilita");
  alias("marca", "marca", "brand", "make", "casa", "costruttore");
  alias("modello", "modello", "model");
  alias("allestimento", "allestimento", "versione", "trim", "serie", "finitura", "versione_allestimento");
  alias("anno", "anno", "immatricolazione", "anno_immatricolazione", "data_immatricolazione", "anno_di_immatricolazione", "immatricolata");
  alias("km", "km", "chilometri", "chilometraggio", "kilometri", "percorrenza", "km_percorsi");
  alias("alimentazione", "alimentazione", "carburante", "fuel", "combustibile");
  alias("cambio", "cambio", "trasmissione");
  alias("cv", "cv", "potenza", "potenza_cv", "hp");
  alias("kw", "kw", "potenza_kw");
  alias("colore", "colore", "colore_esterno", "colour", "color");
  alias("carrozzeria", "carrozzeria", "tipo", "tipologia", "segmento", "body");
  alias("prezzo", "prezzo", "prezzo_richiesto", "prezzo_in_vetrina", "prezzo_annuncio", "prezzo_di_listino", "listino", "price");
  alias("data_vendita", "data_vendita", "data_di_vendita", "venduta_il", "venduto_il", "data_consegna", "data_vendita_auto");
  alias("prezzo_vendita", "prezzo_vendita", "prezzo_di_vendita", "prezzo_finale", "incasso", "venduta_a", "venduto_a");
  alias("targa", "targa", "plate");
  alias("data_acquisto", "data_acquisto", "data_di_acquisto", "acquistata_il", "acquisto_il", "data_ingresso", "ingresso");
  alias("costo_acquisto", "costo_acquisto", "costo_di_acquisto", "prezzo_acquisto", "prezzo_di_acquisto", "acquisto", "costo");
  alias("costi_extra", "costi_extra", "costi_aggiuntivi", "ricondizionamento", "costi_ricondizionamento", "spese", "extra");
  alias("scad_revisione", "scadenza_revisione", "revisione", "revisione_entro", "scad_revisione", "prossima_revisione");
  alias("foto", "foto", "immagine", "immagini", "url_foto", "link_foto", "image", "foto_principale");
  alias("descrizione", "descrizione", "note", "note_pubbliche", "dettagli", "description");
  alias("autoscout_url", "link_autoscout24", "autoscout24", "autoscout", "link_autoscout", "url", "link", "annuncio", "link_annuncio");
  alias("note_interne", "note_interne", "interno", "note_private", "note_riservate");
  const hnorm = (h) => TG.norm(h).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

  const MARCHE = { bmw: "BMW", audi: "Audi", mercedes: "Mercedes-Benz", "mercedes_benz": "Mercedes-Benz", mb: "Mercedes-Benz", smart: "smart", mini: "MINI", vw: "Volkswagen", volkswagen: "Volkswagen" };
  const marcaCanon = (m) => MARCHE[hnorm(m)] || String(m).trim();
  const alimCanon = (v) => {
    const n = TG.norm(v);
    if (!n) return "";
    if (/diesel|gasolio|tdi|cdi/.test(n)) return "Diesel";
    if (/ibrid|hybrid|phev|mhev/.test(n)) return "Ibrida";
    if (/elettric|electric|^ev$/.test(n)) return "Elettrica";
    if (/benzina|gasoline|petrol|tsi|tfsi/.test(n)) return "Benzina";
    if (/gpl/.test(n)) return "GPL";
    if (/metano|cng/.test(n)) return "Metano";
    return String(v).trim().replace(/^./, (c) => c.toUpperCase());
  };
  const cambioCanon = (v) => {
    const n = TG.norm(v);
    if (!n) return "";
    if (/^man|meccanic/.test(n)) return "Manuale";
    if (/^aut|dsg|tronic|dct|cvt/.test(n)) return "Automatico";
    return String(v).trim().replace(/^./, (c) => c.toUpperCase());
  };

  /* ---------- conversioni ---------- */
  function numero(v) {
    if (v == null || v === "") return null;
    if (typeof v === "number") return isFinite(v) ? v : null;
    let s = String(v).replace(/[^\d.,\-]/g, "");
    if (!/\d/.test(s)) return null;
    const lp = s.lastIndexOf("."), lc = s.lastIndexOf(","), last = Math.max(lp, lc);
    if (last >= 0) {
      const dec = s.length - last - 1;
      if (dec === 3) s = s.replace(/[.,]/g, "");           // 24.900 oppure 24,900 → migliaia
      else s = s.slice(0, last).replace(/[.,]/g, "") + "." + s.slice(last + 1);               // 24.900,50 → decimali
    }
    const n = parseFloat(s);
    return isFinite(n) ? n : null;
  }
  function annoDa(v) {
    if (v == null || v === "") return null;
    const m = /(?:^|[^\d])((?:19|20)\d{2})(?:[^\d]|$)/.exec(String(v));
    if (m) return +m[1];
    const n = numero(v);
    return n && n >= 1950 && n <= 2100 ? Math.round(n) : null;
  }
  function dataIso(v) {
    if (v == null || v === "") return "";
    const s = String(v).trim();
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/.exec(s);
    if (m) { const y = m[3].length === 2 ? "20" + m[3] : m[3]; return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; }
    m = /^(\d{1,2})[\/.\-](\d{4})$/.exec(s);
    if (m) return `${m[2]}-${m[1].padStart(2, "0")}-01`;
    if (/^\d{5}(\.\d+)?$/.test(s) && +s > 30000 && +s < 70000) return TG.tab.serialToISO(+s);
    return null;   // non riconosciuta
  }
  const oggi = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  let seq = 0;
  const nuovoId = () => "a" + Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 5);

  /* record completo = campi pubblici + riservati */
  function pieno(a) {
    const r = TG.pulisci(a);
    r.id = String(r.id || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64) || nuovoId();
    r.prezzo_vendita = numero(a.prezzo_vendita);
    r.targa = String(a.targa || "").trim().toUpperCase();
    r.note_interne = String(a.note_interne || "").trim();
    r.data_acquisto = String(a.data_acquisto || "").trim();
    r.costo_acquisto = numero(a.costo_acquisto);
    r.costi_extra = numero(a.costi_extra);
    r.scad_revisione = String(a.scad_revisione || "").trim();
    r.preparazione = a.preparazione === true;                 // riservato: in preparazione = nascosta dal sito
    r.checklist = GT.Check.norm(a.checklist);                  // riservato: controlli prima della vendita
    return r;
  }
  const pubblico = (a) => { const o = {}; PUBBLICI.forEach((k) => (o[k] = a[k])); if (a.stato === "venduta") o.prezzo = null; return o; };
  const inVetrina = (a) => a.preparazione !== true;          // le auto in preparazione non vanno sul sito
  const stabile = (lista) => JSON.stringify(lista.filter(inVetrina).map(pubblico).sort((x, y) => (x.id > y.id ? 1 : -1)));

  /* ---------- stato ---------- */
  /* impostazioni di flotta, stima e previsioni (riservate) */
  const REG = AP.Config.cfg.regole || {};     // valori di partenza dal file di configurazione del garage
  const IMP_DEF = { posti: REG.posti || null, ritardo: 14, obiettivo: 100, max_ingressi: 4, giorni_prep: 7, costo_giorno: +REG.costo_giorno || 0, costi_vendita: +REG.costi_vendita || 0, margine_min: +REG.margine_min || 0, trattativa: REG.trattativa == null ? 3 : +REG.trattativa };
  const normImp = (o) => {
    const r = Object.assign({}, IMP_DEF);
    if (o && typeof o === "object") for (const k in IMP_DEF) { const n = o[k] == null || o[k] === "" ? NaN : +o[k]; if (isFinite(n) && n >= 0) r[k] = n; }
    r.obiettivo = Math.min(100, Math.max(10, r.obiettivo || 100)); r.trattativa = Math.min(30, r.trattativa);
    r.posti = r.posti ? Math.round(r.posti) : null;
    return r;
  };
  let seqS = 0;
  const normStorico = (l) => (Array.isArray(l) ? l : []).filter((r) => r && typeof r === "object" && GT.Calc.dataIso(r.data_vendita)).map((r) => {
    const n = (v) => { const x = GT.Calc.numero(v); return x == null ? null : x; };
    return { id: String(r.id || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64) || "s" + Date.now().toString(36) + (seqS++).toString(36), marca: String(r.marca || "").trim(), modello: String(r.modello || "").trim(), anno: r.anno ? GT.Calc.annoDa(r.anno) : null, km: n(r.km),
      alimentazione: String(r.alimentazione || "").trim(), carrozzeria: String(r.carrozzeria || "").trim(), targa: String(r.targa || "").trim().toUpperCase(), data_acquisto: GT.Calc.dataIso(r.data_acquisto) || "", data_vendita: GT.Calc.dataIso(r.data_vendita),
      costo_acquisto: n(r.costo_acquisto), costi_extra: n(r.costi_extra), prezzo_vendita: n(r.prezzo_vendita), demo: r.demo === true };
  });
  const FOTO_OK = /^(?:[a-z0-9][a-z0-9._-]{2,90}\.(?:jpe?g|png|webp)|https:\/\/\S+)$/;
  const normTitolare = (t) => ({ nome: String((t && t.nome) || "").trim().slice(0, 80), foto: String((t && t.foto) || "").split("|").map((x) => x.trim()).filter((x) => FOTO_OK.test(x)).slice(0, 2).join("|") });
  const S = { online: false, titolare: { nome: "", foto: "" }, sitoTit: { nome: "", foto: "" }, auto: [], contatti: [], storico: [], visite: [], imp: normImp(), sito: [], tab: "disponibile", q: "", sort: { disponibile: { k: "titolo", d: 1 }, venduta: { k: "data_vendita", d: -1 } } };
  /* salva in questo dispositivo e, con l'archivio online, avvisa che c'è qualcosa da inviare */
  const salva = (senzaSync) => {
    try { localStorage.setItem(LS, JSON.stringify({ auto: S.auto, contatti: S.contatti, storico: S.storico, visite: S.visite, imp: S.imp, titolare: S.titolare, salvato: Date.now() })); }
    catch (e) { toast("Attenzione: il browser non permette di salvare qui. Fai spesso il backup dal menu Esporta."); }
    if (senzaSync !== true && S.online) GT.Server.cambiato();
    GT.Agenda.codaOut();
  };
  let tt;
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("on"), 3800); }
  const aggiungiGiorni = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };

  function pillScrivi(testo, cl, titolo) { const p = $("#sync"); p.className = "pill " + cl; p.textContent = testo; p.title = titolo || ""; }

  /* le auto di esempio ricevono anche i dati riservati della flotta, così il cruscotto si vede */
  function arricchisciDemo(lista) {
    lista.forEach((a, i) => {
      if (!a.demo || a.costo_acquisto != null || a.data_acquisto) return;
      const base = a.prezzo != null ? a.prezzo : 14000 + ((i * 2750) % 14000);
      a.costo_acquisto = Math.round(base * (0.8 + ((i * 7) % 8) / 100) / 100) * 100;
      a.costi_extra = 200 + ((i * 130) % 800);
      a.data_acquisto = aggiungiGiorni(oggi(), -(a.stato === "disponibile" ? 9 + ((i * 17) % 96) : 60 + i * 5));
      if (a.stato === "disponibile" && i % 4 === 1) a.scad_revisione = aggiungiGiorni(oggi(), i % 8 === 1 ? -5 : 18);
      if (a.stato === "venduta" && a.prezzo_vendita == null) a.prezzo_vendita = Math.round((a.costo_acquisto + a.costi_extra) * 1.14 / 100) * 100;
      if (a.stato === "disponibile" && i === 2) a.checklist = { data: oggi(), voci: [{ k: "tagliando", s: "da_fare", costo: 280, nota: "Olio e filtri", addebitato: 0 }, { k: "pulizia", s: "da_fare", costo: 90, nota: "", addebitato: 0 }, { k: "freni", s: "ok", costo: null, nota: "", addebitato: 0 }] };
    });
  }

  function caricaDa(loc) {
    S.auto = loc.auto.map(pieno); S.contatti = Array.isArray(loc.contatti) ? loc.contatti.map(GT.Crm.norm) : []; S.storico = normStorico(loc.storico); S.visite = Array.isArray(loc.visite) ? loc.visite.map(AP.Visite.norm).filter((v) => v.id) : []; S.imp = normImp(loc.imp); S.titolare = normTitolare(loc.titolare);
  }
  /* aspetto e pulsanti secondo la modalità: locale (dati nel browser + pacchetto .zip) oppure online (archivio sul server) */
  function impostaUi() {
    document.body.classList.toggle("online", S.online);
    $("#b-pubblica").hidden = S.online; $("#b-reset").hidden = S.online; $("#b-esci").hidden = !S.online;
    $("#sync").disabled = !S.online;
    $("#intro-t").innerHTML = S.online
      ? "Qui gestisci le auto, le foto e i contatti dei clienti, anche dal telefono. Le modifiche si salvano <strong>online</strong> e il sito si aggiorna da solo; targa, costi e note restano riservati."
      : "Qui gestisci le auto, le loro foto e i contatti dei clienti. Tutto resta <strong>in questo browser</strong>: sul sito va solo quello che pubblichi, e mai i dati riservati.";
  }
  async function avvia() {
    const modo = await GT.Server.rileva();
    S.online = modo !== "locale";
    GT.Foto.online = S.online;
    let sito = null;
    if (!S.online) { try { sito = await TG.carica("../data/auto.json"); } catch (e) {} }
    S.sito = sito ? sito.auto : []; S.sitoTit = normTitolare({ nome: sito ? sito.titolare.nome : "", foto: sito ? sito.titolare.foto.join("|") : "" });
    let loc = null;
    try { loc = JSON.parse(localStorage.getItem(LS)); } catch (e) {}
    try { await GT.Foto.carica(); } catch (e) {}
    if (loc && Array.isArray(loc.auto)) caricaDa(loc);
    else if (!S.online) {
      S.auto = S.sito.map(pieno); arricchisciDemo(S.auto);
      S.contatti = GT.Crm.demo(S.auto).map(GT.Crm.norm);
      S.visite = GT.Agenda.demo(S.auto);
      if (S.auto.some((a) => a.demo)) { S.storico = normStorico(GT.Calc.demoStorico(oggi())); S.imp = normImp({ posti: 28 }); }      // storico e posti di esempio, eliminabili
      S.titolare = S.sitoTit;
      if (sito) salva(true);
    }
    pulisciFoto();
    if (!S.online) { const nv = GT.Agenda.codaIn(); if (nv) toast(nv === 1 ? "C’è una nuova richiesta di visita dal sito." : `Ci sono ${nv} nuove richieste di visita dal sito.`); }
    if (!sito && !S.online) toast("Non riesco a leggere i dati del sito: parti da un file importato.");
    impostaUi();
    disegna();
    if (modo === "accesso") { GT.Server.mostraAccesso(""); return; }
    if (S.online) GT.Server.sincronizza("esplicito");
  }
  // toglie dal browser le foto che nessuna auto usa più
  function pulisciFoto() {
    const usate = new Set(); S.auto.forEach((a) => GT.Foto.lista(a.foto).forEach((n) => usate.add(n)));
    GT.Foto.lista(S.titolare.foto).forEach((n) => usate.add(n));
    GT.Foto.nomi().forEach((n) => { if (!usate.has(n)) GT.Foto.elimina(n); });
  }

  /* ---------- elenco ---------- */
  const titolo = (a) => (a.marca + " " + a.modello).trim();
  function filtrate() {
    const q = TG.norm(S.q);
    return S.auto.filter((a) => a.stato === S.tab && (!q || TG.norm([a.marca, a.modello, a.allestimento, a.targa, a.colore, a.anno, a.alimentazione].join(" ")).includes(q)));
  }
  const Fl = () => GT.Crm.Flotta;
  function disegna() {
    const disp = S.auto.filter((a) => a.stato === "disponibile").length, vend = S.auto.length - disp;
    $("#n-disp").textContent = disp; $("#n-vend").textContent = vend; $("#n-crm").textContent = S.contatti.filter((c) => GT.Crm.aperti().includes(c)).length;
    ["disp:disponibile", "vend:venduta", "crm:crm", "visite:visite", "flotta:flotta"].forEach((x) => { const [i, t] = x.split(":"); $("#tab-" + i).setAttribute("aria-selected", String(S.tab === t)); });
    $("#kpi").innerHTML = GT.Crm.kpi();
    const crm = S.tab === "crm", flotta = S.tab === "flotta", visite = S.tab === "visite", sold = S.tab === "venduta";
    $("#n-visite").textContent = GT.Agenda.daConfermare(); $("#n-visite").hidden = !GT.Agenda.daConfermare();
    $("#vista-auto").hidden = crm || flotta || visite; $("#crm").hidden = !crm; $("#flotta").hidden = !flotta; $("#agenda").hidden = !visite; $("#barra").hidden = flotta; $("#barra").classList.toggle("solo-nuova", visite);
    $("#b-nuova").textContent = crm ? "Nuovo contatto" : visite ? "Nuova visita" : "Aggiungi auto";
    $("#fab").hidden = flotta; $("#fab").textContent = crm ? "+ Nuovo contatto" : visite ? "+ Nuova visita" : "+ Aggiungi auto";
    $("#q").placeholder = crm || visite ? "Cerca nome, telefono, auto…" : "Cerca marca, modello, targa…";
    if (crm) GT.Crm.disegna(); else if (visite) GT.Agenda.disegna(); else if (flotta) { GT.Garage.leggiImp(); GT.Garage.disegna(); } else disegnaAuto(sold);
    $("#b-esempi").hidden = !(S.auto.some((a) => a.demo) || S.contatti.some((c) => c.demo) || S.storico.some((r) => r.demo) || S.visite.some((v) => v.demo));
    if (S.online) GT.Server.pill();
    else {
      const mod = stabile(S.auto) !== stabile(S.sito.map(pieno)) || GT.Unione.h(normTitolare(S.titolare)) !== GT.Unione.h(S.sitoTit);
      pillScrivi(mod ? "Modifiche da pubblicare" : "Allineato al sito", mod ? "mod" : "ok", "");
    }
    const nm = crm ? "Contatti" : sold ? "Vendute" : "In vendita";
    $('[data-exp="tab-csv"]').textContent = `Solo «${nm}» in CSV`;
    $('[data-exp="tab-xlsx"]').textContent = `Solo «${nm}» in Excel`;
  }
  const miniatura = (a) => { const f = GT.Foto.lista(a.foto)[0]; return f ? `<img class="thumb" src="${TG.esc(GT.Foto.src(f, "../"))}" alt="" loading="lazy">` : `<span class="thumb vuota" aria-hidden="true"></span>`; };
  function disegnaAuto(sold) {
    const cols = sold
      ? [["titolo", "Auto"], ["anno", "Anno", 1], ["data_vendita", "Venduta il"], ["prezzo_vendita", "Prezzo vendita", 1], ["margine", "Margine", 1], ["targa", "Targa"]]
      : [["titolo", "Auto"], ["anno", "Anno", 1], ["km", "Km", 1], ["prezzo", "Prezzo", 1], ["targa", "Targa"], ["stock", "In stock", 1], ["lead", "Contatti", 1], ["margine", "Margine", 1]];
    const so = S.sort[S.tab];
    $("#tabella thead").innerHTML = "<tr>" + cols.map((c) => `<th class="${c[2] ? "num" : ""}"><button type="button" data-sort="${c[0]}">${c[1]}<span class="ar">${so.k === c[0] ? (so.d > 0 ? "▲" : "▼") : ""}</span></button></th>`).join("") + "<th></th></tr>";
    const val = (a, k) => k === "titolo" ? titolo(a).toLowerCase() : k === "stock" ? Fl().giorniStock(a) : k === "lead" ? GT.Crm.interessati(a.id) : k === "margine" ? (sold ? Fl().margineVenduta(a) : Fl().margine(a)) : a[k];
    const l = filtrate().sort((a, b) => {
      const va = val(a, so.k), vb = val(b, so.k);
      const na = va == null || va === "", nb = vb == null || vb === "";
      if (na !== nb) return na ? 1 : -1;
      return (va > vb ? 1 : va < vb ? -1 : 0) * so.d;
    });
    const avvisi = (a) => {
      const r = Fl().revisione(a), g = Fl().giorniStock(a), t = [];
      if (r != null && r <= 30) t.push(`<span class="tag warn">${r < 0 ? "Revisione scaduta" : "Revisione tra " + r + " gg"}</span>`);
      if (g != null && g > 60) t.push('<span class="tag warn">Ferma da molto</span>');
      const k = GT.Check.riepilogo(a);
      if (a.preparazione) t.push(`<span class="tag warn">In preparazione${k.daFare ? " · " + k.daFare + (k.daFare === 1 ? " lavoro" : " lavori") : ""}</span>`);
      else if (k.daFare) t.push(`<span class="tag warn">${k.daFare} ${k.daFare === 1 ? "lavoro" : "lavori"} da fare</span>`);
      return t.join("");
    };
    const euroC = (n) => (n == null ? "" : (n < 0 ? "−" : "") + TG.euro(Math.abs(n)));
    const cell = (a, k) => ({
      titolo: `<td class="auto"><div class="auto-in">${miniatura(a)}<div><b>${TG.esc(titolo(a))}${a.demo ? '<span class="tag">Esempio</span>' : ""}${sold ? "" : avvisi(a)}</b><small>${TG.esc(a.allestimento)}</small></div></div></td>`,
      anno: `<td class="num">${a.anno || ""}</td>`, km: `<td class="num">${a.km != null ? TG.num(a.km) : ""}</td>`,
      prezzo: `<td class="num">${a.prezzo != null ? TG.euro(a.prezzo) : ""}</td>`,
      data_vendita: `<td>${TG.esc(a.data_vendita ? a.data_vendita.split("-").reverse().join("/") : "")}</td>`,
      prezzo_vendita: `<td class="num">${a.prezzo_vendita != null ? TG.euro(a.prezzo_vendita) : ""}</td>`, targa: `<td>${TG.esc(a.targa)}</td>`,
      stock: `<td class="num ${Fl().giorniStock(a) > 60 ? "late" : ""}">${Fl().giorniStock(a) != null ? Fl().giorniStock(a) + " gg" : ""}</td>`,
      lead: `<td class="num">${GT.Crm.interessati(a.id) ? `<button type="button" class="lnk" data-az="lead">${GT.Crm.interessati(a.id)}</button>` : '<span class="muted">0</span>'}</td>`,
      margine: (() => { const m = sold ? Fl().margineVenduta(a) : Fl().margine(a); return `<td class="num ${m != null && m < 0 ? "late" : ""}">${euroC(m)}</td>`; })(),
    }[k]);
    $("#tabella tbody").innerHTML = l.map((a) => `<tr data-id="${TG.esc(a.id)}">${cols.map((c) => cell(a, c[0])).join("")}<td class="act">
<button type="button" class="lnk" data-az="modifica">Modifica</button>${sold ? '<button type="button" class="lnk" data-az="riporta">Rimetti in vendita</button>' : '<button type="button" class="lnk" data-az="controlli">Controlli</button><button type="button" class="lnk" data-az="stima">Stima</button><button type="button" class="lnk" data-az="venduta">Venduta</button>'}<button type="button" class="lnk d" data-az="elimina">Elimina</button></td></tr>`).join("");
    $("#cards").innerHTML = l.map((a) => scheda(a, sold, avvisi, euroC)).join("");
    const v = $("#vuoto");
    v.hidden = l.length > 0;
    if (!l.length) v.textContent = S.q ? "Nessuna auto corrisponde alla ricerca." : sold ? "Nessuna auto venduta. Importa un file CSV o Excel, oppure segna come «Venduta» un’auto in vendita." : "Nessuna auto in vendita. Aggiungine una o importa un file CSV o Excel.";
  }

  /* scheda di un'auto per schermi stretti (al posto della tabella) */
  function scheda(a, sold, avvisi, euroC) {
    const m = sold ? Fl().margineVenduta(a) : Fl().margine(a), g = Fl().giorniStock(a);
    const dati = sold
      ? [a.anno, a.data_vendita ? "venduta il " + a.data_vendita.split("-").reverse().join("/") : "", a.prezzo_vendita != null ? TG.euro(a.prezzo_vendita) : ""]
      : [a.anno, a.km != null ? TG.num(a.km) + " km" : "", a.prezzo != null ? TG.euro(a.prezzo) : "prezzo da indicare"];
    const extra = [g != null && !sold ? g + " giorni in stock" : "", m != null ? "margine " + euroC(m) : ""].filter(Boolean).join(" · ");
    return `<li class="card-auto" data-id="${TG.esc(a.id)}">
  <button type="button" class="ca-main" data-az="modifica" aria-label="Modifica ${TG.esc(titolo(a))}">${miniatura(a)}<span class="ca-t"><b>${TG.esc(titolo(a))}${a.demo ? '<span class="tag">Esempio</span>' : ""}</b><small>${TG.esc(a.allestimento)}</small><span class="ca-d">${dati.filter(Boolean).map(TG.esc).join(" · ")}</span>${extra ? `<span class="ca-e ${m != null && m < 0 ? "late" : ""}">${TG.esc(extra)}</span>` : ""}${sold ? "" : `<span class="ca-tag">${avvisi(a)}</span>`}</span></button>
  <div class="ca-az">${sold ? '<button type="button" class="lnk" data-az="riporta">Rimetti in vendita</button>' : '<button type="button" class="lnk" data-az="controlli">Controlli</button><button type="button" class="lnk" data-az="stima">Stima</button><button type="button" class="lnk" data-az="venduta">Venduta</button>'}<button type="button" class="lnk d" data-az="elimina">Elimina</button></div>
</li>`;
  }

  /* ---------- finestre ---------- */
  const apri = (d) => { d.showModal(); };
  document.querySelectorAll("dialog").forEach((d) => {
    if (d.id === "d-accesso") return;           // la finestra della password non si chiude senza password
    d.addEventListener("click", (e) => { if (e.target === d || e.target.closest("[data-chiudi]")) d.close(); });
  });

  /* aggiungi / modifica */
  const F = $("#form");
  let editId = null;
  const fotoEd = GT.Foto.editor($("#fotoed"), F.foto, () => (F.marca.value + " " + F.modello.value).trim(), (m) => toast(m));
  function apriForm(a) {
    editId = a ? a.id : null;
    F.reset();
    $("#f-titolo").textContent = a ? "Modifica auto" : "Aggiungi auto";
    $("#f-err").hidden = true;
    const v = a || { stato: S.tab, data_vendita: "" };
    Array.from(F.elements).forEach((el) => {
      if (!el.name) return;
      const x = v[el.name];
      if (el.tagName === "SELECT" && x && !Array.from(el.options).some((o) => o.value === String(x) || o.text === String(x))) el.add(new Option(x, x));
      el.value = x == null ? "" : x;
    });
    fotoEd.carica(v.foto || "");
    $("#f-check").hidden = !a || a.stato === "venduta";
    apri($("#d-form"));
  }
  /* stima del prezzo con i dati che sono nel modulo (anche se l'auto non è ancora salvata) */
  $("#f-stima").onclick = () => {
    const g = (k) => F.elements[k].value, prev = editId ? S.auto.find((x) => x.id === editId) : null;
    GT.Stima.apri({
      id: editId, lavori: prev ? GT.Calc.lavoriDaFare(prev) : 0,
      valori: { marca: g("marca").trim(), modello: g("modello").trim(), allestimento: g("allestimento").trim(), anno: numero(g("anno")), km: numero(g("km")), costo_acquisto: numero(g("costo_acquisto")), costi_extra: numero(g("costi_extra")), prezzo: numero(g("prezzo")) },
      onUsa: (p) => { F.elements.prezzo.value = p; },
    });
  };
  /* controlli: lavorano su una copia, così non toccano le modifiche non ancora salvate nel modulo */
  $("#f-check").onclick = () => {
    const prev = editId ? S.auto.find((x) => x.id === editId) : null; if (!prev) return;
    const copia = JSON.parse(JSON.stringify(prev)); copia.costi_extra = numero(F.elements.costi_extra.value);
    GT.Check.apri(copia, { dopo: (c) => { prev.checklist = c.checklist; prev.preparazione = c.preparazione; prev.costi_extra = c.costi_extra; F.elements.costi_extra.value = c.costi_extra == null ? "" : c.costi_extra; salva(); disegna(); } });
  };
  function apriStima(a) {
    GT.Stima.apri({ id: a.id, valori: a, lavori: GT.Calc.lavoriDaFare(a), onUsa: (p) => { a.prezzo = p; salva(); disegna(); } });
  }
  F.addEventListener("submit", (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(F));
    const err = (m) => { const p = $("#f-err"); p.textContent = m; p.hidden = false; };
    if (!d.marca.trim() || !d.modello.trim()) return err("Marca e modello sono obbligatori.");
    const NUMERI = ["anno", "km", "cv", "prezzo", "prezzo_vendita", "costo_acquisto", "costi_extra"];
    for (const k of NUMERI) if (d[k].trim() && numero(d[k]) == null) return err("Controlla i numeri: " + k.replace("_", " ") + ".");
    if (d.stato === "venduta" && !d.data_vendita) d.data_vendita = oggi();
    const prev = editId ? S.auto.find((x) => x.id === editId) : null;
    const num = {};
    for (const k of NUMERI) { const n = numero(d[k]); num[k] = n == null ? null : Math.round(n); }
    if (d.cambio) d.cambio = cambioCanon(d.cambio);
    const rec = pieno(Object.assign({}, prev || {}, d, num, { id: editId || "", marca: marcaCanon(d.marca), demo: prev ? prev.demo : false }));
    const pos = prev ? S.auto.indexOf(prev) : -1;
    if (pos >= 0) S.auto[pos] = rec; else S.auto.push(rec);
    S.tab = rec.stato;
    salva(); disegna(); $("#d-form").close(); toast(prev ? "Auto aggiornata." : "Auto aggiunta.");
    if (!prev && rec.stato === "disponibile") GT.Check.apri(rec, { nuova: true });          // auto nuova: subito i controlli prima della vendita
  });

  /* nome e foto del titolare per il sito */
  const FT = $("#form-t");
  const fotoTit = GT.Foto.editor($("#t-foto"), FT.foto, () => "titolare", (m) => toast(m), { max: 2 });
  $("#b-titolare").onclick = () => { FT.nome.value = S.titolare.nome; fotoTit.carica(S.titolare.foto); apri($("#d-titolare")); };
  FT.addEventListener("submit", (e) => {
    e.preventDefault();
    S.titolare = normTitolare({ nome: FT.nome.value, foto: FT.foto.value });
    pulisciFoto(); salva(); disegna(); $("#d-titolare").close(); toast("Titolare aggiornato.");
  });

  /* segna come venduta */
  let vendId = null;
  function apriVenduta(a) {
    vendId = a.id;
    $("#v-auto").textContent = titolo(a) + (a.allestimento ? " · " + a.allestimento : "");
    $("#form-v").data_vendita.value = oggi();
    $("#form-v").prezzo_vendita.value = a.prezzo_vendita != null ? a.prezzo_vendita : "";
    apri($("#d-venduta"));
  }
  $("#form-v").addEventListener("submit", (e) => {
    e.preventDefault();
    const a = S.auto.find((x) => x.id === vendId); if (!a) return;
    const f = e.target;
    a.stato = "venduta"; a.data_vendita = f.data_vendita.value || oggi(); a.prezzo_vendita = numero(f.prezzo_vendita.value);
    salva(); disegna(); $("#d-venduta").close(); toast("Segnata come venduta.");
  });

  /* azioni nella tabella */
  const azioneAuto = (e) => {
    const s = e.target.closest("[data-sort]");
    if (s) { const so = S.sort[S.tab]; so.d = so.k === s.dataset.sort ? -so.d : 1; so.k = s.dataset.sort; return disegna(); }
    const b = e.target.closest("[data-az]"); if (!b) return;
    const a = S.auto.find((x) => x.id === b.closest("[data-id]").dataset.id); if (!a) return;
    if (b.dataset.az === "lead") { GT.Crm.filtraAuto(a.id); S.tab = "crm"; disegna(); }
    else if (b.dataset.az === "modifica") apriForm(a);
    else if (b.dataset.az === "venduta") apriVenduta(a);
    else if (b.dataset.az === "controlli") GT.Check.apri(a, {});
    else if (b.dataset.az === "stima") apriStima(a);
    else if (b.dataset.az === "riporta") { a.stato = "disponibile"; a.data_vendita = ""; a.prezzo_vendita = null; salva(); disegna(); toast("Rimessa in vendita."); }
    else if (b.dataset.az === "elimina" && confirm("Eliminare " + titolo(a) + "?")) { S.auto = S.auto.filter((x) => x !== a); salva(); disegna(); toast("Auto eliminata."); }
  };
  $("#tabella").addEventListener("click", azioneAuto);
  $("#cards").addEventListener("click", azioneAuto);
  $("#fab").onclick = () => (S.tab === "crm" ? GT.Crm.nuovo() : S.tab === "visite" ? GT.Agenda.nuova() : apriForm(null));
  $("#tab-disp").onclick = () => { S.tab = "disponibile"; disegna(); };
  $("#tab-vend").onclick = () => { S.tab = "venduta"; disegna(); };
  $("#tab-crm").onclick = () => { S.tab = "crm"; disegna(); };
  $("#tab-flotta").onclick = () => { S.tab = "flotta"; disegna(); };
  $("#tab-visite").onclick = () => { S.tab = "visite"; disegna(); };
  $("#q").addEventListener("input", (e) => { S.q = e.target.value; disegna(); });
  $("#b-pagare").onclick = () => GT.Stima.quantoPagare();
  $("#b-nuova").onclick = () => (S.tab === "crm" ? GT.Crm.nuovo() : S.tab === "visite" ? GT.Agenda.nuova() : apriForm(null));
  $("#b-esempi").onclick = () => {
    if (!confirm("Eliminare le auto, i contatti e lo storico di esempio?")) return;
    const ids = new Set(S.auto.filter((a) => a.demo).map((a) => a.id));
    S.auto = S.auto.filter((a) => !a.demo); S.contatti = S.contatti.filter((c) => !c.demo && !ids.has(c.auto_id)); S.storico = S.storico.filter((r) => !r.demo); S.visite = S.visite.filter((v) => !v.demo);
    pulisciFoto(); salva(); disegna(); toast("Dati di esempio eliminati.");
  };
  $("#b-reset").onclick = () => {
    if (!confirm("Annullare le modifiche alle auto e ripartire dai dati pubblicati sul sito? Si perdono anche targa, costi, scadenze e note interne inseriti qui. I contatti del CRM restano.")) return;
    S.auto = S.sito.map(pieno); S.contatti.forEach((c) => { if (c.auto_id && !S.auto.some((a) => a.id === c.auto_id)) c.auto_id = ""; });
    pulisciFoto(); salva(); disegna(); toast("Ripartito dai dati del sito.");
  };

  /* ---------- esportazione ---------- */
  const riga = (a) => COLS.map((c) => (c.k === "stato" ? (a.stato === "venduta" ? "Venduta" : "Disponibile") : a[c.k] == null ? "" : a[c.k]));
  const dataFile = () => oggi();
  const sheetDi = (nome, lista) => ({ name: nome, cols: COLS.map((c) => ({ title: c.t, type: c.type, width: c.w })), rows: lista.map(riga) });
  const ordinaExp = (l) => l.slice().sort((a, b) => titolo(a).localeCompare(titolo(b), "it"));
  async function esporta(cosa) {
    const disp = ordinaExp(S.auto.filter((a) => a.stato === "disponibile")), vend = S.auto.filter((a) => a.stato === "venduta").sort((a, b) => (b.data_vendita || "").localeCompare(a.data_vendita || ""));
    const crm = S.tab === "crm";
    const cont = S.contatti.slice().sort((a, b) => (a.prossimo || "9999") > (b.prossimo || "9999") ? 1 : -1);
    const tab = S.tab === "venduta" ? vend : disp, nomeTab = crm ? "contatti" : S.tab === "venduta" ? "vendute" : "in-vendita";
    const hdrC = GT.Crm.COLS.map((c) => c.t);
    try {
      if (cosa === "tab-csv") TG.tab.scarica("\ufeff" + TG.tab.toCSV([crm ? hdrC : COLS.map((c) => c.t)].concat((crm ? cont.map(GT.Crm.riga) : tab.map(riga)))), `top-garage-${crm ? "contatti" : "auto-" + nomeTab}-${dataFile()}.csv`, "text/csv;charset=utf-8");
      else if (cosa === "all-csv") TG.tab.scarica("\ufeff" + TG.tab.toCSV([COLS.map((c) => c.t)].concat(disp.concat(vend).map(riga))), `top-garage-auto-tutte-${dataFile()}.csv`, "text/csv;charset=utf-8");
      else if (cosa === "tab-xlsx") TG.tab.scarica(await TG.tab.scriviXLSX([crm ? GT.Crm.foglio(cont) : sheetDi(S.tab === "venduta" ? "Vendute" : "In vendita", tab)]), `top-garage-${crm ? "contatti" : "auto-" + nomeTab}-${dataFile()}.xlsx`);
      else if (cosa === "all-xlsx") TG.tab.scarica(await TG.tab.scriviXLSX([sheetDi("In vendita", disp), sheetDi("Vendute", vend), GT.Crm.foglio(cont)]), `top-garage-tutto-${dataFile()}.xlsx`);
      else if (cosa === "backup") await scaricaBackup();
      else if (cosa === "modello") {
        const esempio = { id: "esempio", stato: "disponibile", marca: "BMW", modello: "Serie 1", allestimento: "118d Msport", anno: 2021, km: 48200, alimentazione: "Diesel", cambio: "Automatico", cv: 150, colore: "Blu", carrozzeria: "Berlina", prezzo: 24900, data_acquisto: "2026-09-20", costo_acquisto: 20500, costi_extra: 450, descrizione: "RIGA DI ESEMPIO: cancellala o sostituiscila con le tue auto." };
        const istr = [["Come compilare"], ["Una riga per ogni auto. Servono almeno Marca e Modello; le altre colonne sono facoltative."], ["Stato: scrivi Disponibile oppure Venduta. Per le vendute indica anche la Data vendita."], ["Prezzo, Km, CV, Anno: solo numeri (24900). Date: 15/10/2026 oppure 2026-10-15."], ["Foto: i nomi dei file separati da | (la prima è la copertina), oppure link. Più semplice: carica le foto dal gestionale."], ["Targa, Prezzo vendita, Data acquisto, Costo acquisto, Costi extra, Scadenza revisione e Note interne restano riservati: non vanno mai sul sito."], ["Il foglio Contatti è per il CRM: una riga per contatto, servono almeno Nome e Telefono (o Email)."], ["Importa il file dal gestionale con «Importa CSV o Excel». La riga con ID «esempio» viene ignorata."]];
        const contEs = { id: "esempio", nome: "Mario Rossi", telefono: "333 1234567", fonte: "WhatsApp", stato: "nuovo", auto_testo: "BMW Serie 1", budget: 20000, prossimo: oggi(), creato: oggi(), note: "RIGA DI ESEMPIO: cancellala.", attivita: [], auto_id: "", email: "" };
        TG.tab.scarica(await TG.tab.scriviXLSX([sheetDi("In vendita", [esempio]), sheetDi("Vendute", []), GT.Crm.foglio([contEs]), { name: "Istruzioni", cols: [{ title: "Istruzioni", width: 110 }], rows: istr }]), "top-garage-modello.xlsx");
      }
      $("#menu-esporta").open = false;
    } catch (e) { toast("Esportazione non riuscita: " + e.message); }
  }
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-exp]"); if (b) esporta(b.dataset.exp); });
  document.addEventListener("click", (e) => { const m = $("#menu-esporta"); if (m.open && !m.contains(e.target)) m.open = false; });

  /* ---------- importazione ---------- */
  let IMP = null;
  function apriImporta() {
    IMP = null; $("#file").value = ""; $("#i-1").hidden = false; $("#i-2").hidden = true; $("#i-ok").hidden = true; $("#i-err").hidden = true; $("#i-modo").hidden = false;
    document.querySelector('input[name="modo"][value="aggiungi"]').checked = true;
    $("#i-sost").textContent = S.tab === "crm" ? "Sostituisci tutti i contatti con quelli del file" : S.tab === "venduta" ? "Sostituisci tutte le auto vendute con quelle del file" : "Sostituisci tutte le auto in vendita con quelle del file";
    apri($("#d-importa"));
  }
  $("#b-importa").onclick = apriImporta;
  const drop = $("#drop");
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove("over")));
  drop.addEventListener("drop", (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) leggiFile(e.dataTransfer.files[0]); });
  $("#file").addEventListener("change", (e) => { if (e.target.files[0]) leggiFile(e.target.files[0]); });

  async function leggiFile(file) {
    const err = $("#i-err"); err.hidden = true;
    try {
      if (/\.zip$/i.test(file.name)) { await leggiBackup(file); return; }
      IMP = analizza(await TG.tab.leggi(file), S.tab === "crm" ? "disponibile" : S.tab);
      if (!IMP.righe.length && !IMP.contatti.length) throw new Error(IMP.problemi.length ? IMP.problemi[0].m : "Nel file non trovo né auto né contatti: controlla che la prima riga contenga le intestazioni (Marca, Modello… oppure Nome, Telefono…).");
      mostraAnteprima(file.name);
    } catch (e) { IMP = null; err.textContent = e.message; err.hidden = false; $("#i-2").hidden = true; $("#i-ok").hidden = true; }
  }

  function analizza(wb, defStato) {
    const out = { righe: [], contatti: [], problemi: [], riconosciute: new Set(), ignorate: new Set() };
    wb.sheets.forEach((sh) => {
      if (/istruzion|leggimi|note|help/i.test(sh.name) && wb.sheets.length > 1) return;
      const rows = sh.rows;
      const rc = GT.Crm.riconosci(sh, wb.sheets.length);
      if (rc) { GT.Crm.analizza(sh, rc, out); return; }
      const hi = rows.slice(0, 12).findIndex((r) => r.filter((c) => ALIAS[hnorm(c)]).length >= 2);
      if (hi < 0) { if (rows.length) out.problemi.push({ e: 1, m: `Foglio «${sh.name}»: non trovo la riga con le intestazioni (Marca, Modello…).` }); return; }
      const map = rows[hi].map((c) => ALIAS[hnorm(c)] || null);
      rows[hi].forEach((c, i) => { const t = String(c).trim(); if (t) (map[i] ? out.riconosciute : out.ignorate).add(t); });
      const def = /vendut|venduta|sold/i.test(sh.name) ? "venduta" : /vendita|dispon|stock|magazzino/i.test(sh.name) ? "disponibile" : defStato;
      for (let i = hi + 1; i < rows.length; i++) {
        const r = rows[i] || [];
        if (r.every((c) => String(c == null ? "" : c).trim() === "")) continue;
        const raw = {};
        map.forEach((k, ci) => { if (k && r[ci] != null && String(r[ci]).trim() !== "") raw[k] = r[ci]; });
        if (String(raw.id || "").toLowerCase() === "esempio") continue;
        const rec = costruisci(raw, def, `${wb.sheets.length > 1 ? sh.name + ", " : ""}riga ${i + 1}`, out.problemi);
        if (rec) out.righe.push(rec);
      }
    });
    out.contatti = out.contatti.filter((c) => String(c.id).toLowerCase() !== "esempio");
    return out;
  }
  function costruisci(raw, def, dove, prob) {
    if (!String(raw.marca || "").trim() || !String(raw.modello || "").trim()) { prob.push({ e: 1, m: `${dove}: manca marca o modello, riga saltata.` }); return null; }
    const r = { id: String(raw.id || "").trim(), marca: marcaCanon(raw.marca), modello: String(raw.modello).trim(), allestimento: String(raw.allestimento || "").trim() };
    const n = (k, nome) => { if (raw[k] == null) return null; const v = numero(raw[k]); if (v == null) prob.push({ m: `${dove}: «${raw[k]}» non è un numero valido per ${nome}.` }); return v == null ? null : Math.round(v); };
    r.anno = raw.anno != null ? annoDa(raw.anno) : null;
    if (raw.anno != null && r.anno == null) prob.push({ m: `${dove}: anno «${raw.anno}» non riconosciuto.` });
    r.km = n("km", "i km"); r.cv = n("cv", "i CV"); r.prezzo = n("prezzo", "il prezzo"); r.prezzo_vendita = n("prezzo_vendita", "il prezzo di vendita");
    if (r.cv == null && raw.kw != null) { const kw = numero(raw.kw); if (kw != null) r.cv = Math.round(kw * 1.35962); }
    r.alimentazione = alimCanon(raw.alimentazione); r.cambio = cambioCanon(raw.cambio);
    r.colore = String(raw.colore || "").trim(); r.carrozzeria = String(raw.carrozzeria || "").trim();
    r.targa = String(raw.targa || "").trim().toUpperCase(); r.foto = String(raw.foto || "").trim();
    r.data_acquisto = ""; if (raw.data_acquisto != null) { const da = dataIso(raw.data_acquisto); if (da == null) prob.push({ m: `${dove}: data di acquisto «${raw.data_acquisto}» non riconosciuta.` }); else r.data_acquisto = da; }
    r.scad_revisione = ""; if (raw.scad_revisione != null) { const dr = dataIso(raw.scad_revisione); if (dr == null) prob.push({ m: `${dove}: scadenza revisione «${raw.scad_revisione}» non riconosciuta.` }); else r.scad_revisione = dr; }
    r.costo_acquisto = n("costo_acquisto", "il costo di acquisto"); r.costi_extra = n("costi_extra", "i costi extra");
    r.descrizione = String(raw.descrizione || "").trim(); r.autoscout_url = String(raw.autoscout_url || "").trim(); r.note_interne = String(raw.note_interne || "").trim();
    let d = "";
    if (raw.data_vendita != null) { d = dataIso(raw.data_vendita); if (d == null) { prob.push({ m: `${dove}: data «${raw.data_vendita}» non riconosciuta (usa 15/10/2026).` }); d = ""; } }
    r.data_vendita = d;
    const st = TG.norm(raw.stato);
    r._esplicito = !!st || !!d;
    r.stato = st ? (/vend|sold|consegn/.test(st) && !/in vendita/.test(st) ? "venduta" : "disponibile") : d ? "venduta" : def;
    if (r.stato === "venduta" && !r.data_vendita) prob.push({ m: `${dove}: ${titolo(r)} è venduta ma senza data: sul sito non comparirà il mese.` });
    if (r.stato === "disponibile" && r.prezzo == null) prob.push({ m: `${dove}: ${titolo(r)} senza prezzo: sul sito comparirà «Su richiesta».` });
    return r;
  }
  const chiave = (a) => [a.marca, a.modello, a.allestimento, a.anno, a.km].map((x) => TG.norm(x == null ? "" : x)).join("|");
  function trova(rec, lista) {
    if (rec.id) { const x = lista.find((a) => a.id === rec.id); if (x) return x; }
    if (rec.targa) { const x = lista.find((a) => a.targa && a.targa === rec.targa); if (x) return x; }
    const k = chiave(rec);
    return lista.find((a) => chiave(a) === k);
  }
  function mostraAnteprima(nome) {
    const nuove = IMP.righe.filter((r) => !trova(r, S.auto)).length, agg = IMP.righe.length - nuove;
    const ven = IMP.righe.filter((r) => r.stato === "venduta").length;
    const cn = IMP.contatti.filter((c) => !GT.Crm.trova(c, S.contatti)).length, ca = IMP.contatti.length - cn;
    const parti = [];
    if (IMP.righe.length) parti.push(`${IMP.righe.length} auto (${IMP.righe.length - ven} in vendita, ${ven} vendute): nuove <strong>${nuove}</strong> · già presenti <strong>${agg}</strong>`);
    if (IMP.contatti.length) parti.push(`${IMP.contatti.length} contatti: nuovi <strong>${cn}</strong> · già presenti <strong>${ca}</strong>`);
    $("#i-riepilogo").innerHTML = `<strong>${TG.esc(nome)}</strong>: ` + parti.join("; ") + ".";
    $("#i-colonne").textContent = "Colonne riconosciute: " + [...IMP.riconosciute].join(", ") + (IMP.ignorate.size ? ". Ignorate: " + [...IMP.ignorate].join(", ") + "." : ".");
    let mostra, tit, righe;
    if (IMP.righe.length) { mostra = ["marca", "modello", "allestimento", "anno", "km", "prezzo", "stato", "data_vendita"]; tit = ["Marca", "Modello", "Allestimento", "Anno", "Km", "Prezzo", "Stato", "Venduta il"]; righe = IMP.righe; }
    else { mostra = ["nome", "telefono", "fonte", "stato", "budget", "prossimo", "auto_testo"]; tit = ["Nome", "Telefono", "Fonte", "Fase", "Budget", "Ricontattare", "Cosa cerca"]; righe = IMP.contatti; }
    $("#i-anteprima").innerHTML = "<thead><tr>" + tit.map((t) => `<th>${t}</th>`).join("") + "</tr></thead><tbody>" + righe.slice(0, 8).map((r) => "<tr>" + mostra.map((k) => `<td>${TG.esc(k === "stato" ? (IMP.righe.length ? (r.stato === "venduta" ? "Venduta" : "In vendita") : (GT.Crm.STATI.find((x) => x[0] === r.stato) || [0, r.stato])[1]) : r[k] == null ? "" : r[k])}</td>`).join("") + "</tr>").join("") + "</tbody>";
    $("#i-problemi").innerHTML = IMP.problemi.slice(0, 40).map((p) => `<li class="${p.e ? "e" : ""}">${TG.esc(p.m)}</li>`).join("") + (IMP.problemi.length > 40 ? `<li>… e altri ${IMP.problemi.length - 40}.</li>` : "");
    $("#i-ok").textContent = "Importa " + [IMP.righe.length ? IMP.righe.length + " auto" : "", IMP.contatti.length ? IMP.contatti.length + " contatti" : ""].filter(Boolean).join(" e ");
    $("#i-modo").hidden = false;
    $("#i-1").hidden = true; $("#i-2").hidden = false; $("#i-ok").hidden = false;
    $("#i-anteprima").parentElement.hidden = false;
  }
  $("#i-ok").onclick = async () => {
    if (!IMP) return;
    if (IMP.backup) return ripristina();
    const modo = document.querySelector('input[name="modo"]:checked').value;
    let nuove = 0, agg = 0, cn = 0, ca = 0;
    if (modo === "sostituisci") {
      const cosa = [IMP.righe.length ? `le auto ${S.tab === "venduta" ? "vendute" : "in vendita"} attuali` : "", IMP.contatti.length ? "tutti i contatti attuali" : ""].filter(Boolean).join(" e ");
      if (!confirm(`Verranno eliminati ${cosa} e sostituiti con quelli del file. Continuare?`)) return;
      if (IMP.righe.length) S.auto = S.auto.filter((a) => a.stato !== (S.tab === "crm" ? "disponibile" : S.tab));
      if (IMP.contatti.length) S.contatti = [];
    }
    IMP.righe.forEach((r) => {
      const ex = trova(r, S.auto);
      if (ex) {
        agg++;
        Object.keys(r).forEach((k) => { if (k[0] === "_" || k === "id") return; const v = r[k]; if (k === "stato" && !r._esplicito) return; if (v !== "" && v != null) ex[k] = v; });
        if (ex.stato === "disponibile") ex.data_vendita = ex.data_vendita || "";
        ex.demo = false;
      } else { nuove++; const n = pieno(Object.assign({}, r, { demo: false })); S.auto.push(n); }
    });
    if (IMP.contatti.length) { const r = GT.Crm.unisciImport(IMP.contatti, S); cn = r.nuovi; ca = r.agg; }
    // se il file ha solo auto di un tipo, mostra quel tipo
    if (IMP.righe.length) { if (IMP.righe.every((r) => r.stato === "venduta")) S.tab = "venduta"; else if (IMP.righe.every((r) => r.stato === "disponibile")) S.tab = "disponibile"; }
    else if (IMP.contatti.length) S.tab = "crm";
    salva(); disegna(); $("#d-importa").close();
    toast([IMP.righe.length ? `Auto: ${nuove} nuove, ${agg} aggiornate.` : "", IMP.contatti.length ? `Contatti: ${cn} nuovi, ${ca} aggiornati.` : ""].filter(Boolean).join(" "));
    IMP = null;
  };

  /* ---------- backup completo (zip: auto, contatti e foto) ---------- */
  async function scaricaBackup() {
    const z = new JSZip(), foto = z.folder("foto");
    const usate = new Set(); S.auto.forEach((a) => GT.Foto.lista(a.foto).forEach((n) => usate.add(n))); GT.Foto.lista(S.titolare.foto).forEach((n) => usate.add(n));
    let nf = 0;
    for (const n of usate) { const b = await GT.Foto.ottieni(n); if (b) { foto.file(n, b); nf++; } }
    z.file("backup.json", JSON.stringify({ tipo: "autoprofit-backup", versione: 3, creato: new Date().toISOString(), auto: S.auto, contatti: S.contatti, storico: S.storico, visite: S.visite, imp: S.imp, titolare: S.titolare }, null, 1));
    z.file("LEGGIMI.txt", "Backup del gestionale " + AP.Config.cfg.nome + " (AutoProfit).\nPer ripristinarlo: Gestionale → Importa CSV o Excel → scegli questo file .zip.\nContiene auto (anche i dati riservati e i controlli), contatti del CRM, storico delle vendite, impostazioni di flotta e foto caricate dal gestionale.\n");
    TG.tab.scarica(await z.generateAsync({ type: "blob", compression: "DEFLATE" }), `autoprofit-backup-${dataFile()}.zip`);
    toast(`Backup scaricato: ${S.auto.length} auto, ${S.contatti.length} contatti, ${nf} foto.`);
  }
  async function leggiBackup(file) {
    const z = await JSZip.loadAsync(file), bj = z.file("backup.json");
    if (!bj) throw new Error("Questo .zip non è un backup del gestionale (manca backup.json). Per le foto usa «Aggiungi foto» nella scheda dell’auto.");
    const d = JSON.parse(await bj.async("string"));
    if (d.tipo !== "autoprofit-backup" && d.tipo !== "top-garage-backup" || !Array.isArray(d.auto)) throw new Error("Il file di backup non è valido.");
    const foto = []; z.folder("foto").forEach((rel, f) => { if (!f.dir) foto.push([rel.replace(/^.*\//, ""), f]); });
    IMP = { backup: { auto: d.auto, contatti: Array.isArray(d.contatti) ? d.contatti : [], visite: Array.isArray(d.visite) ? d.visite : [], storico: d.storico, imp: d.imp, titolare: d.titolare, foto, creato: d.creato || "" } };
    $("#i-riepilogo").innerHTML = `<strong>${TG.esc(file.name)}</strong>: backup${d.creato ? " del " + TG.esc(d.creato.slice(0, 10).split("-").reverse().join("/")) : ""} con ${d.auto.length} auto, ${IMP.backup.contatti.length} contatti e ${foto.length} foto. <strong>Il ripristino sostituisce tutto quello che c’è ora in questo browser.</strong>`;
    $("#i-colonne").textContent = ""; $("#i-problemi").innerHTML = ""; $("#i-anteprima").innerHTML = "";
    $("#i-anteprima").parentElement.hidden = true; $("#i-modo").hidden = true;
    $("#i-ok").textContent = "Ripristina il backup";
    $("#i-1").hidden = true; $("#i-2").hidden = false; $("#i-ok").hidden = false;
  }
  async function ripristina() {
    const bk = IMP.backup;
    if (!confirm("Sostituire tutte le auto, i contatti e le foto di questo browser con quelli del backup?")) return;
    for (const n of GT.Foto.nomi()) await GT.Foto.elimina(n);
    for (const [nome, f] of bk.foto) await GT.Foto.ripristina(nome, await f.async("blob"));
    S.auto = bk.auto.map(pieno); S.contatti = bk.contatti.map(GT.Crm.norm); S.storico = normStorico(bk.storico); S.visite = (bk.visite || []).map(AP.Visite.norm).filter((v) => v.id); S.imp = normImp(bk.imp); S.titolare = normTitolare(bk.titolare);
    salva(); disegna(); $("#d-importa").close(); toast(`Backup ripristinato: ${S.auto.length} auto, ${S.contatti.length} contatti.`);
    IMP = null;
  }

  /* ---------- pubblica ---------- */
  const fotoLocali = () => { const set = new Set(); S.auto.filter(inVetrina).forEach((a) => GT.Foto.lista(a.foto).forEach((n) => { if (GT.Foto.ha(n)) set.add(n); })); GT.Foto.lista(S.titolare.foto).forEach((n) => { if (GT.Foto.ha(n)) set.add(n); }); return [...set]; };
  const jsonSito = () => JSON.stringify({ versione: 1, aggiornato: oggi(), auto: S.auto.filter(inVetrina).map(pubblico), sito: { titolare: { nome: S.titolare.nome, foto: GT.Foto.lista(S.titolare.foto) } } }, null, 1);
  $("#b-pubblica").onclick = () => {
    const pub = S.auto.filter(inVetrina), prep = S.auto.length - pub.length, d = pub.filter((a) => a.stato === "disponibile").length, nf = fotoLocali().length;
    $("#p-conteggio").textContent = `Sul sito andranno ${d} auto in vendita e ${pub.length - d} vendute` + (nf ? `, con ${nf} foto caricate da qui.` : ".") + (prep ? ` Restano fuori ${prep} ${prep === 1 ? "auto in preparazione" : "auto in preparazione"}.` : "") + (S.auto.some((a) => a.demo) ? " Attenzione: ci sono ancora auto di esempio." : "");
    apri($("#d-pubblica"));
  };
  $("#p-zip").onclick = async () => {
    try {
      const z = new JSZip(), foto = fotoLocali();
      z.file("data/auto.json", jsonSito());
      foto.forEach((n) => z.file("img/auto/" + n, GT.Foto.blob(n)));
      z.file("LEGGIMI.txt", "Pacchetto per il sito " + AP.Config.cfg.nome + ".\n\nSul repository GitHub del sito apri la cartella «public», poi Add file → Upload files, e trascina qui le cartelle «data» e «img» di questo zip (decomprimilo prima).\nLe cartelle si uniscono a quelle esistenti: i file con lo stesso nome vengono sostituiti.\nPoi Commit changes: Cloudflare ripubblica il sito in un paio di minuti.\n\nDentro ci sono: data/auto.json (solo dati pubblici: targa, costi, prezzo di vendita e note interne non ci sono) e " + foto.length + " foto in img/auto/.\n");
      TG.tab.scarica(await z.generateAsync({ type: "blob", compression: "DEFLATE" }), `autoprofit-sito-${oggi()}.zip`);
      toast(`Pacchetto scaricato: auto.json e ${foto.length} foto.`);
    } catch (e) { toast("Non riesco a creare il pacchetto: " + e.message); }
  };
  $("#p-scarica").onclick = () => TG.tab.scarica(jsonSito(), "auto.json", "application/json;charset=utf-8");

  /* collegamento con l'archivio online (server.js) */
  const eguali = (a, b) => GT.Unione.h(a) === GT.Unione.h(b);
  GT.Server.init({
    leggi: () => ({ auto: S.auto, contatti: S.contatti, storico: S.storico, visite: S.visite, titolare: S.titolare, flotta: S.imp }),
    norm: { auto: pieno, contatti: GT.Crm.norm, visite: AP.Visite.norm, storico: (d) => normStorico([d])[0] || null, titolare: normTitolare, flotta: normImp },
    haEsempi: () => S.auto.some((a) => a.demo) || S.contatti.some((c) => c.demo) || S.storico.some((r) => r.demo) || S.visite.some((v) => v.demo),
    applica: (m) => {
      ["auto", "contatti", "storico", "visite"].forEach((t) => {
        const arr = S[t];
        m[t].del.forEach((id) => { const i = arr.findIndex((x) => x.id === id); if (i >= 0) arr.splice(i, 1); });
        m[t].set.forEach((d) => { const i = arr.findIndex((x) => x.id === d.id); if (i >= 0) { Object.keys(arr[i]).forEach((k) => delete arr[i][k]); Object.assign(arr[i], d); } else arr.push(d); });
      });
      if (m.titolare) S.titolare = m.titolare;
      if (m.flotta) S.imp = m.flotta;
      pulisciFoto(); salva(true);
    },
    correggiFoto: (id, via) => { const a = S.auto.find((x) => x.id === id); if (a) { a.foto = GT.Foto.lista(a.foto).filter((n) => !via.has(n)).join("|"); salva(true); } },
    correggiFotoTitolare: (via) => { S.titolare.foto = GT.Foto.lista(S.titolare.foto).filter((n) => !via.has(n)).join("|"); salva(true); },
    pill: pillScrivi, toast, ridisegna: disegna,
    dopoAccesso: async () => { S.online = true; GT.Foto.online = true; impostaUi(); await GT.Server.sincronizza("esplicito"); disegna(); },
  });
  $("#sync").onclick = () => { if (S.online) GT.Server.sincronizza("esplicito"); };
  $("#b-esci").onclick = async () => {
    const msg = GT.Server.daInviare() ? "Ci sono modifiche non ancora inviate al server: se esci le perdi. Esci lo stesso?" : "Uscendo, le auto e le foto salvate su questo dispositivo vengono cancellate (restano al sicuro sul server). Esci?";
    if (!confirm(msg)) return;
    await GT.Server.esci();
    try { localStorage.removeItem(LS); } catch (e) {}
    try { await GT.Foto.svuota(); } catch (e) {}
    location.reload();
  };
  const ctx = { S, salva, ridisegna: disegna, toast, apri, numero, dataIso, oggi, titolo, q: () => S.q, apriVenduta, stima: apriStima, modifica: apriForm };
  GT.Crm.init(ctx);
  GT.Agenda.init(ctx);
  GT.Check.init(ctx);
  GT.Stima.init(ctx);
  GT.Garage.init(ctx);
  avvia();
});
