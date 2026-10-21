/* Borzi Auto · «Vendi la tua auto»: regole e controlli (nessuna interfaccia).
   Il cliente compila un modulo con i dati dell'auto e almeno 4 foto; il garage riceve una richiesta di valutazione nel gestionale.
   Usato da tre parti: il sito (modulo), il Worker (ricontrolla tutto) e il gestionale (elenco «Valutazioni»). Provato con _work/t_richieste.mjs. */
(function (radice) {
  "use strict";
  const R = {};
  R.VERSIONE_PRIVACY = "2026-10-18";
  R.FOTO_MIN = 4;                                   // foto richieste al cliente
  R.FOTO_MAX = 10;
  R.FOTO_BYTE = 700 * 1024;                         // peso massimo di una foto (dopo il ridimensionamento fatto dal modulo)

  R.STATI = [["nuova", "Nuova"], ["contattata", "Contattata"], ["offerta", "Offerta fatta"], ["acquistata", "Acquistata"], ["rifiutata", "Non interessa"]];
  R.APERTE = ["nuova", "contattata", "offerta"];
  R.nomeStato = (s) => (R.STATI.find((x) => x[0] === s) || [0, s])[1];
  R.ALIMENTAZIONI = ["Benzina", "Diesel", "GPL", "Metano", "Ibrida benzina", "Ibrida diesel", "Elettrica", "Altro"];
  R.CAMBI = ["Manuale", "Automatico"];
  R.CONDIZIONI = [["ottimo", "Ottime, come nuova"], ["buono", "Buone, qualche segno d’uso"], ["discreto", "Discrete, serve qualche ritocco"], ["da_sistemare", "Da sistemare"]];
  R.INCIDENTI = [["no", "Nessuno"], ["lievi", "Sì, danni lievi già riparati"], ["gravi", "Sì, danni importanti"]];
  R.TAGLIANDI = [["completi", "Regolari, con libretto timbrato"], ["parziali", "Alcuni"], ["nessuno", "Nessuno o non so"]];
  R.FINANZIATA = [["no", "No, è tutta mia"], ["finanziata", "C’è un finanziamento da estinguere"], ["leasing", "È in leasing o noleggio"]];
  R.COSA = [["vendere", "Voglio venderla"], ["permuta", "Voglio darla in permuta"], ["valutare", "Voglio solo sapere quanto vale"]];
  R.QUANDO = [["subito", "Il prima possibile"], ["mese", "Entro un mese"], ["senza_fretta", "Senza fretta"]];
  R.CONTATTO = [["telefono", "Telefono"], ["whatsapp", "WhatsApp"], ["email", "Email"]];
  const chiavi = (l) => l.map((x) => x[0]);

  const TEL = /^\+?[0-9][0-9 ./()-]{5,22}$/;
  const MAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
  R.pulisci = (s, max) => String(s == null ? "" : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/[<>]/g, "").trim().slice(0, max);
  const intero = (v, a, b) => { if (v === "" || v == null) return null; const x = Math.round(+String(v).replace(/[.\s]/g, "").replace(",", ".")); return isFinite(x) && x >= a && x <= b ? x : undefined; };

  /* controlla una richiesta. foto = quante foto sono arrivate. Restituisce { ok, errori:{campo:messaggio}, valori } */
  R.valida = function (p, foto, anno) {
    const e = {};
    if (!p || typeof p !== "object") return { ok: false, errori: { _: "Richiesta non valida." }, valori: {} };
    const adesso = anno || new Date().getFullYear();
    const t = (k, max) => R.pulisci(p[k], max);
    const v = {
      marca: t("marca", 40), modello: t("modello", 60), versione: t("versione", 80), colore: t("colore", 40), targa: t("targa", 12).toUpperCase().replace(/[^A-Z0-9 ]/g, ""),
      difetti: t("difetti", 1000), accessori: t("accessori", 1000), permuta_con: t("permuta_con", 200), note: t("note", 1000),
      nome: t("nome", 80), telefono: t("telefono", 24), email: t("email", 254), fascia: t("fascia", 80),
    };
    if (v.marca.length < 2) e.marca = "Scrivi la marca dell’auto.";
    if (!v.modello) e.modello = "Scrivi il modello.";
    const anno_ = intero(p.anno, 1970, adesso + 1);
    if (anno_ == null || anno_ === undefined) e.anno = "Scrivi l’anno di immatricolazione.";
    v.anno = anno_ || null;
    const km = intero(p.km, 0, 999999);
    if (km == null || km === undefined) e.km = "Scrivi i chilometri (anche approssimati).";
    v.km = km == null ? null : km;
    const scelta = (k, lista, msg, obbl) => { const x = String(p[k] == null ? "" : p[k]); if (!x) { if (obbl) e[k] = msg; v[k] = ""; return; } if (!lista.includes(x)) e[k] = msg; else v[k] = x; };
    scelta("alimentazione", R.ALIMENTAZIONI, "Scegli l’alimentazione.", true);
    scelta("cambio", R.CAMBI, "Scegli il cambio.", true);
    scelta("condizioni", chiavi(R.CONDIZIONI), "Dicci in che condizioni è.", true);
    scelta("incidenti", chiavi(R.INCIDENTI), "Dicci se ha avuto incidenti.", true);
    scelta("finanziata", chiavi(R.FINANZIATA), "Dicci se l’auto è tutta tua.", true);
    scelta("cosa", chiavi(R.COSA), "Scegli cosa vuoi fare.", true);
    scelta("tagliandi", chiavi(R.TAGLIANDI), "Scelta non valida.", false);
    scelta("quando", chiavi(R.QUANDO), "Scelta non valida.", false);
    scelta("contatto_pref", chiavi(R.CONTATTO), "Scelta non valida.", false);
    const cv = intero(p.cv, 0, 2000); v.cv = cv == null || cv === undefined ? null : cv; if (cv === undefined) e.cv = "Potenza non valida.";
    const pr = intero(p.proprietari, 1, 20); v.proprietari = pr == null || pr === undefined ? null : pr; if (pr === undefined) e.proprietari = "Numero non valido.";
    const pz = intero(p.prezzo, 0, 9999999); v.prezzo = pz == null || pz === undefined ? null : pz; if (pz === undefined) e.prezzo = "Prezzo non valido.";
    v.doppia_chiave = p.doppia_chiave === true || p.doppia_chiave === "si" ? "si" : p.doppia_chiave === "no" ? "no" : "";
    if (v.nome.length < 2) e.nome = "Scrivi il tuo nome.";
    if (!TEL.test(v.telefono) || v.telefono.replace(/\D/g, "").length < 6) e.telefono = "Scrivi un numero di telefono valido.";
    if (v.email && !MAIL.test(v.email)) e.email = "L’email non sembra valida.";
    if (p.consenso_privacy !== true) e.consenso = "Per inviare la richiesta serve leggere l’informativa sulla privacy.";
    const nf = foto == null ? R.FOTO_MIN : +foto;
    if (nf < R.FOTO_MIN) e.foto = `Servono almeno ${R.FOTO_MIN} foto dell’auto: ne hai aggiunte ${nf}.`;
    else if (nf > R.FOTO_MAX) e.foto = `Al massimo ${R.FOTO_MAX} foto.`;
    return { ok: !Object.keys(e).length, errori: e, valori: v };
  };

  /* documento «richiesta» come sta nel gestionale e nell'archivio */
  R.norm = function (d) {
    d = d || {};
    const s = (k, m) => R.pulisci(d[k], m), n = (k, a, b) => { const x = intero(d[k], a, b); return x == null || x === undefined ? null : x; };
    const dentro = (k, lista, def) => (lista.includes(String(d[k] || "")) ? String(d[k]) : def);
    return {
      id: String(d.id || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64),
      stato: dentro("stato", chiavi(R.STATI), "nuova"), origine: d.origine === "manuale" ? "manuale" : "vetrina",
      creato: String(d.creato || "").slice(0, 25), aggiornato: String(d.aggiornato || "").slice(0, 25),
      marca: s("marca", 40), modello: s("modello", 60), versione: s("versione", 80), anno: n("anno", 1970, 2100), km: n("km", 0, 999999),
      alimentazione: s("alimentazione", 30), cambio: s("cambio", 20), cv: n("cv", 0, 2000), colore: s("colore", 40), targa: s("targa", 12).toUpperCase(),
      proprietari: n("proprietari", 1, 20), tagliandi: dentro("tagliandi", chiavi(R.TAGLIANDI), ""), doppia_chiave: dentro("doppia_chiave", ["si", "no"], ""),
      condizioni: dentro("condizioni", chiavi(R.CONDIZIONI), ""), incidenti: dentro("incidenti", chiavi(R.INCIDENTI), ""), finanziata: dentro("finanziata", chiavi(R.FINANZIATA), ""),
      difetti: s("difetti", 1000), accessori: s("accessori", 1000),
      cosa: dentro("cosa", chiavi(R.COSA), "vendere"), prezzo: n("prezzo", 0, 9999999), quando: dentro("quando", chiavi(R.QUANDO), ""), permuta_con: s("permuta_con", 200), note: s("note", 1000),
      nome: s("nome", 80), telefono: s("telefono", 24), email: s("email", 254), contatto_pref: dentro("contatto_pref", chiavi(R.CONTATTO), ""), fascia: s("fascia", 80),
      foto: String(d.foto || "").split("|").map((x) => x.trim()).filter(Boolean).slice(0, R.FOTO_MAX).join("|"),
      note_interne: s("note_interne", 2000), offerta: n("offerta", 0, 9999999), contatto_id: String(d.contatto_id || "").slice(0, 64),
      consenso: { privacy: !!(d.consenso && d.consenso.privacy), marketing: !!(d.consenso && d.consenso.marketing), versione: String((d.consenso && d.consenso.versione) || "").slice(0, 12), data: String((d.consenso && d.consenso.data) || "").slice(0, 25) },
      anonimo: d.anonimo === true, demo: d.demo === true,
    };
  };
  R.titolo = (d) => [d.marca, d.modello, d.versione].filter(Boolean).join(" ") || "Auto";
  R.sottotitolo = (d) => [d.anno, d.km != null ? new Intl.NumberFormat("it-IT").format(d.km) + " km" : "", d.alimentazione].filter(Boolean).join(" · ");
  /* toglie i dati personali e le foto, ma lascia che una richiesta c'è stata (statistiche) */
  R.anonimizza = (d) => Object.assign({}, d, { nome: "", telefono: "", email: "", note: "", note_interne: "", targa: "", fascia: "", permuta_con: "", foto: "", contatto_id: "", anonimo: true, consenso: { privacy: false, marketing: false, versione: "", data: "" } });
  /* vero se la richiesta è più vecchia del periodo di conservazione (mesi dalla data in cui è arrivata) */
  R.scaduta = (d, oggi, mesi) => {
    if (!mesi || !d.creato) return false;
    const lim = new Date(oggi + "T12:00:00Z"); lim.setUTCDate(lim.getUTCDate() - Math.round(mesi * 30.4));
    return d.creato.slice(0, 10) < lim.toISOString().slice(0, 10);
  };
  R.MESI_DEFAULT = 6;

  if (typeof module !== "undefined" && module.exports) module.exports = R;
  else { const AP = (radice.AP = radice.AP || {}); AP.Richieste = R; }
})(typeof window !== "undefined" ? window : globalThis);
