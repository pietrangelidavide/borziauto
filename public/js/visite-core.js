/* AutoProfit · prenotazione delle visite: regole e calcoli (nessuna interfaccia).
   Usato da tre parti: la vetrina (il cliente sceglie un orario), il Worker (controlla che la richiesta sia valida)
   e il gestionale (agenda del dealer). Provato con _work/t_visite.mjs.
   Le regole stanno in garage.json → visite: { durata, passo, posti, anticipoOre, giorniMax, chiusure[] } e orari: { "0".."6": [["09:00","12:30"],…] } (0 = domenica). */
(function (radice) {
  "use strict";
  const V = {};
  V.STATI = [["richiesta", "Da confermare"], ["confermata", "Confermata"], ["svolta", "Svolta"], ["non_venuto", "Non è venuto"], ["annullata", "Annullata"]];
  V.ATTIVE = ["richiesta", "confermata"];                    // occupano un orario
  V.nomeStato = (s) => (V.STATI.find((x) => x[0] === s) || [0, s])[1];
  V.VERSIONE_PRIVACY = "2026-10";

  const pad = (n) => String(n).padStart(2, "0");
  V.min = (hhmm) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || "")); return m && +m[1] < 24 && +m[2] < 60 ? +m[1] * 60 + +m[2] : null; };
  V.hhmm = (min) => pad(Math.floor(min / 60)) + ":" + pad(min % 60);
  const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
  V.dataValida = (iso) => { const m = ISO.exec(String(iso || "")); if (!m) return false; const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3]; };
  V.giornoSett = (iso) => new Date(iso + "T12:00:00Z").getUTCDay();
  V.piu = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()); };
  V.giorniTra = (a, b) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5);

  /* data e ora «da orologio» nel fuso del garage (il Worker gira in UTC, il telefono del cliente potrebbe essere altrove) */
  V.adesso = function (fuso, quando) {
    const d = quando || new Date();
    try {
      const p = new Intl.DateTimeFormat("en-CA", { timeZone: fuso || "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d).reduce((o, x) => ((o[x.type] = x.value), o), {});
      return { data: `${p.year}-${p.month}-${p.day}`, min: +p.hour * 60 + +p.minute };
    } catch (e) { return { data: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes() }; }
  };

  const regole = (cfg) => Object.assign({ durata: 30, passo: 30, posti: 1, anticipoOre: 3, giorniMax: 30, chiusure: [] }, (cfg && cfg.visite) || {});
  V.regole = regole;

  /* fasce di apertura del giorno, in minuti: [[inizio, fine], …]. Vuoto se il garage è chiuso o in ferie. */
  V.fasce = function (cfg, iso) {
    if (!V.dataValida(iso)) return [];
    const r = regole(cfg);
    if ((r.chiusure || []).includes(iso)) return [];
    return (((cfg && cfg.orari) || {})[V.giornoSett(iso)] || []).map((f) => [V.min(f[0]), V.min(f[1])]).filter((f) => f[0] != null && f[1] != null && f[1] > f[0]);
  };
  V.apertoIn = (cfg, iso) => V.fasce(cfg, iso).length > 0;

  const sovrappone = (a0, a1, b0, b1) => a0 < b1 && b0 < a1;
  /* orari prenotabili di un giorno. occupate: visite già prese [{data, ora, durata, stato}] */
  V.slotGiorno = function (cfg, iso, occupate, adesso) {
    const r = regole(cfg), out = [];
    const att = (occupate || []).filter((v) => v.data === iso && V.ATTIVE.includes(v.stato || "richiesta")).map((v) => { const s = V.min(v.ora); return s == null ? null : [s, s + (+v.durata || r.durata)]; }).filter(Boolean);
    const dd = adesso ? V.giorniTra(adesso.data, iso) : null;      // giorni da oggi (negativo = passato)
    for (const [ini, fine] of V.fasce(cfg, iso)) {
      for (let t = ini; t + r.durata <= fine; t += r.passo) {
        let motivo = "";
        if (dd != null && dd < 0) motivo = "passato";
        else if (dd != null && dd > r.giorniMax) motivo = "lontano";
        else if (dd != null && dd * 1440 + t < adesso.min + r.anticipoOre * 60) motivo = "preavviso";
        else if (att.filter((x) => sovrappone(t, t + r.durata, x[0], x[1])).length >= r.posti) motivo = "occupato";
        out.push({ ora: V.hhmm(t), libero: !motivo, motivo });
      }
    }
    return out;
  };

  /* giorni da mostrare al cliente, a partire da oggi */
  V.giorni = function (cfg, occupate, adesso, quanti) {
    const r = regole(cfg), out = [];
    for (let i = 0; i <= r.giorniMax && out.length < (quanti || 60); i++) {
      const iso = V.piu(adesso.data, i), slot = V.slotGiorno(cfg, iso, occupate, adesso);
      out.push({ data: iso, aperto: V.apertoIn(cfg, iso), liberi: slot.filter((s) => s.libero).length, slot });
    }
    return out;
  };

  /* ---------- controllo di una richiesta ---------- */
  const TEL = /^\+?[0-9][0-9 ./()-]{5,22}$/;
  const MAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
  const ID = /^[A-Za-z0-9_-]{1,64}$/;
  V.pulisci = (s, max) => String(s == null ? "" : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/[<>]/g, "").trim().slice(0, max);
  V.valida = function (cfg, p, occupate, adesso) {
    const e = {};
    if (!p || typeof p !== "object") return { ok: false, errori: { _: "Richiesta non valida." } };
    const nome = V.pulisci(p.nome, 80), tel = V.pulisci(p.telefono, 24), mail = V.pulisci(p.email, 254);
    if (nome.length < 2) e.nome = "Scrivi il tuo nome.";
    if (!TEL.test(tel) || tel.replace(/\D/g, "").length < 6) e.telefono = "Scrivi un numero di telefono valido.";
    if (mail && !MAIL.test(mail)) e.email = "L’email non sembra valida.";
    if (p.auto_id && !ID.test(String(p.auto_id))) e.auto = "Auto non valida.";
    if (p.consenso_privacy !== true) e.consenso = "Per prenotare serve leggere l’informativa sulla privacy.";
    if (!V.dataValida(p.data) || V.min(p.ora) == null) e.orario = "Scegli giorno e ora.";
    else {
      const s = V.slotGiorno(cfg, p.data, occupate, adesso).find((x) => x.ora === V.hhmm(V.min(p.ora)));
      if (!s) e.orario = "A quell’ora siamo chiusi: scegli un altro orario.";
      else if (!s.libero) e.orario = s.motivo === "occupato" ? "Quell’orario è appena stato preso: scegline un altro." : "Quell’orario non è più prenotabile: scegline un altro.";
    }
    return { ok: !Object.keys(e).length, errori: e, valori: { nome, telefono: tel, email: mail, note: V.pulisci(p.note, 500), auto_id: p.auto_id ? String(p.auto_id) : "", auto_testo: V.pulisci(p.auto_testo, 120), data: p.data, ora: V.hhmm(V.min(p.ora) == null ? 0 : V.min(p.ora)) } };
  };

  /* ---------- documento «visita» ---------- */
  V.norm = function (d) {
    d = d || {};
    return {
      id: String(d.id || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64), auto_id: String(d.auto_id || "").slice(0, 64), auto_testo: V.pulisci(d.auto_testo, 120),
      data: V.dataValida(d.data) ? d.data : "", ora: V.min(d.ora) == null ? "" : V.hhmm(V.min(d.ora)), durata: Math.max(5, Math.min(480, Math.round(+d.durata) || 30)),
      nome: V.pulisci(d.nome, 80), telefono: V.pulisci(d.telefono, 24), email: V.pulisci(d.email, 254), note: V.pulisci(d.note, 500),
      stato: V.STATI.some((s) => s[0] === d.stato) ? d.stato : "richiesta", origine: d.origine === "manuale" ? "manuale" : "vetrina",
      creato: String(d.creato || "").slice(0, 25), aggiornato: String(d.aggiornato || "").slice(0, 25),
      consenso: { privacy: !!(d.consenso && d.consenso.privacy), marketing: !!(d.consenso && d.consenso.marketing), versione: String((d.consenso && d.consenso.versione) || "").slice(0, 12), data: String((d.consenso && d.consenso.data) || "").slice(0, 25) },
      contatto_id: String(d.contatto_id || "").slice(0, 64), codice_hash: String(d.codice_hash || "").slice(0, 64), anonimo: d.anonimo === true, demo: d.demo === true,
    };
  };
  /* elimina i dati personali ma lascia il fatto che una visita c'è stata (serve alle statistiche) */
  V.anonimizza = (v) => Object.assign({}, v, { nome: "", telefono: "", email: "", note: "", codice_hash: "", contatto_id: "", anonimo: true, consenso: { privacy: false, marketing: false, versione: "", data: "" } });
  /* vero se la visita è abbastanza vecchia da dover essere cancellata (mesi di conservazione dalla data della visita) */
  V.scaduta = (v, oggi, mesi) => { if (!v.data || !mesi) return false; const lim = V.piu(oggi, -Math.round(mesi * 30.4)); return v.data < lim; };

  /* ---------- file per il calendario del cliente (.ics, ora «fluttuante» del garage) ---------- */
  V.ics = function (v, garage) {
    const dt = (d, m) => d.replace(/-/g, "") + "T" + pad(Math.floor(m / 60)) + pad(m % 60) + "00";
    const ini = V.min(v.ora), fine = ini + (+v.durata || 30), esc = (t) => String(t || "").replace(/[\\;,]/g, (c) => "\\" + c).replace(/\n/g, "\\n");
    return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//AutoProfit//Visite//IT", "CALSCALE:GREGORIAN", "BEGIN:VEVENT", "UID:" + v.id + "@autoprofit",
      "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z", "DTSTART:" + dt(v.data, ini), "DTEND:" + dt(v.data, fine),
      "SUMMARY:" + esc("Visita da " + (garage.nome || "garage")), "LOCATION:" + esc([garage.indirizzo, garage.citta].filter(Boolean).join(", ")),
      "DESCRIPTION:" + esc((v.auto_testo ? "Auto: " + v.auto_testo + ". " : "") + (garage.telefono ? "Per cambiare orario chiama " + garage.telefono + "." : "")), "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  };

  if (typeof module !== "undefined" && module.exports) module.exports = V;
  else { const AP = (radice.AP = radice.AP || {}); AP.Visite = V; }
})(typeof window !== "undefined" ? window : globalThis);
