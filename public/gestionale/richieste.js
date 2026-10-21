/* Borzi Auto · scheda «Valutazioni» (lato dealer): le richieste di chi vuole vendere o dare in permuta un'auto.
   Arrivano dal modulo «Vendi la tua auto» del sito (src/richieste.js) con i dati e almeno 4 foto, e finiscono qui con la sincronizzazione,
   come le visite. Le foto non sono pubbliche: si leggono solo da qui, con la password (GET /api/admin/richiesta-foto/<nome>).
   Le regole e i controlli sono quelli di js/richieste-core.js. Provata nel browser con _work/t_valutazioni.py. */
(function () {
  "use strict";
  const GT = (window.GT = window.GT || {});
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => TG.esc(s);
  const R = () => AP.Richieste;
  let X = null;
  const V = { filtro: "aperte" };
  const CODA = "borziauto.richieste.coda", FOTO = "borziauto.richieste.foto";
  const NOME_SERVER = /^r[a-z0-9]{3,40}-\d{1,2}\.jpg$/;
  const leggi = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const scrivi = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const adesso = () => new Date().toISOString().slice(0, 19);
  const cfg = () => (window.AP && AP.Config && AP.Config.cfg) || {};
  const eta = (r) => ({ nuova: 0, contattata: 1, offerta: 2, acquistata: 3, rifiutata: 4 }[r.stato]);
  const ord = (a, b) => (a.creato < b.creato ? 1 : a.creato > b.creato ? -1 : 0);
  const eur = (n) => (n == null ? "" : TG.euro(n));
  const num = (n) => (n == null ? "" : TG.num(n));
  const etich = (lista, k) => (lista.find((x) => x[0] === k) || [0, ""])[1];

  /* ---------- foto ---------- */
  function fotoSrc(nome) {
    if (NOME_SERVER.test(nome)) return "../api/admin/richiesta-foto/" + encodeURIComponent(nome);
    const m = leggi(FOTO, {});
    return typeof m[nome] === "string" && /^data:image\//.test(m[nome]) ? m[nome] : "";
  }
  const nomiFoto = (r) => String(r.foto || "").split("|").map((x) => x.trim()).filter(Boolean);
  function togliFotoDemo(nomi) {
    const m = leggi(FOTO, {}); let c = false;
    nomi.forEach((n) => { if (n in m) { delete m[n]; c = true; } });
    if (c) scrivi(FOTO, m);
  }
  /* segnaposto per le richieste di esempio: un rettangolo con la scritta, niente foto vere */
  function segnaposto(testo, tono) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480"><rect width="640" height="480" fill="hsl(${tono},14%,22%)"/><rect x="40" y="300" width="560" height="90" rx="10" fill="hsl(${tono},14%,30%)"/><circle cx="170" cy="400" r="46" fill="hsl(${tono},14%,12%)"/><circle cx="470" cy="400" r="46" fill="hsl(${tono},14%,12%)"/><text x="320" y="170" font-family="Arial,sans-serif" font-size="34" fill="#cfd5df" text-anchor="middle">${testo}</text><text x="320" y="214" font-family="Arial,sans-serif" font-size="22" fill="#9aa3b2" text-anchor="middle">foto di esempio</text></svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  const A = (GT.Richieste = {
    togliFoto: (r) => togliFotoDemo(nomiFoto(r)),
    attiva: () => !!(cfg().moduli && cfg().moduli.vendi === true) || (X ? X.S.richieste.length > 0 : false),
    nuove: () => (X ? X.S.richieste.filter((r) => r.stato === "nuova").length : 0),
    aperte: () => (X ? X.S.richieste.filter((r) => R().APERTE.includes(r.stato)).length : 0),
    init(ctx) {
      X = ctx;
      const f = $("#form-ri");
      f.stato.innerHTML = R().STATI.map((s) => `<option value="${esc(s[0])}">${esc(s[1])}</option>`).join("");
      $("#ri-aperte").onclick = () => { V.filtro = "aperte"; A.disegna(); };
      $("#ri-chiuse").onclick = () => { V.filtro = "chiuse"; A.disegna(); };
      $("#ri-tutte").onclick = () => { V.filtro = "tutte"; A.disegna(); };
      $("#ri-lista").addEventListener("click", (e) => { const r = e.target.closest("[data-id]"); if (r) apri(X.S.richieste.find((x) => x.id === r.dataset.id)); });
      $("#ri-lista").addEventListener("keydown", (e) => { const r = e.target.closest && e.target.closest("[data-id]"); if (r && e.target === r && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); apri(X.S.richieste.find((x) => x.id === r.dataset.id)); } });
      initDialogo();
      A.pulisci();
    },

    /* demo: il sito, senza server, lascia le richieste in questo browser («coda»). Si leggono una volta sola e la coda si svuota,
       così una richiesta eliminata da qui non ricompare. Senza demo la coda non esiste. */
    codaIn() {
      const coda = leggi(CODA, []);
      if (!Array.isArray(coda) || !coda.length) return 0;
      let n = 0;
      coda.map(R().norm).filter((r) => r.id).forEach((r) => { if (!X.S.richieste.some((x) => x.id === r.id)) { X.S.richieste.push(r); n++; } });
      try { localStorage.removeItem(CODA); } catch (e) { /* niente */ }
      if (n) X.salva(true);
      return n;
    },

    /* conservazione: le richieste più vecchie del periodo scelto dal garage si cancellano con le foto (stessa regola del server) */
    pulisci() {
      const mesi = +(((cfg().privacy || {}).conservazione || {}).richieste_mesi) || R().MESI_DEFAULT, oggi = X.oggi();
      const via = X.S.richieste.filter((r) => R().scaduta(r, oggi, mesi));
      if (!via.length) return 0;
      via.forEach((r) => togliFotoDemo(nomiFoto(r)));
      X.S.richieste = X.S.richieste.filter((r) => !via.includes(r));
      X.salva();
      return via.length;
    },

    kpi() {
      const l = X.S.richieste, oggi = X.oggi();
      const nuove = l.filter((r) => r.stato === "nuova").length, corso = l.filter((r) => r.stato === "contattata" || r.stato === "offerta").length;
      const da90 = AP.Visite.piu(oggi, -90), recenti = l.filter((r) => r.creato.slice(0, 10) >= da90 && (r.stato === "acquistata" || r.stato === "rifiutata" || r.stato === "offerta"));
      const acq = l.filter((r) => r.stato === "acquistata" && r.creato.slice(0, 10) >= da90).length;
      const t = (lbl, val, sub, cls) => `<div class="kpi ${cls || ""}"><span class="kpi-l">${lbl}</span><b class="kpi-v">${val}</b><small>${sub}</small></div>`;
      return t("Da richiamare", nuove, nuove ? (nuove === 1 ? "una richiesta nuova" : "richieste nuove") : "nessuna in attesa", nuove ? "warn" : "")
        + t("In corso", corso, corso ? "contattate o con offerta" : "nessuna trattativa aperta")
        + t("Acquistate (90 giorni)", acq, recenti.length ? `su ${recenti.length} chiuse o con offerta` : "ancora nessun dato")
        + t("Ricevute in tutto", l.length, l.length ? "negli ultimi " + (((cfg().privacy || {}).conservazione || {}).richieste_mesi || R().MESI_DEFAULT) + " mesi" : "ancora nessuna");
    },

    /* ---------- disegno ---------- */
    disegna() {
      const S = X.S, q = TG.norm(X.q ? X.q() : "");
      $("#ri-kpi").innerHTML = A.kpi();
      ["aperte", "chiuse", "tutte"].forEach((k) => $("#ri-" + k).setAttribute("aria-pressed", String(V.filtro === k)));
      const ok = (r) => (V.filtro === "tutte" || (V.filtro === "aperte") === R().APERTE.includes(r.stato)) && (!q || TG.norm([r.nome, r.telefono, r.email, r.marca, r.modello, r.versione, r.targa].join(" ")).includes(q));
      const lista = S.richieste.filter(ok).sort((a, b) => (V.filtro === "aperte" ? eta(a) - eta(b) || ord(a, b) : ord(a, b)));
      $("#ri-lista").innerHTML = lista.map(riga).join("");
      const v = $("#ri-vuoto"); v.hidden = lista.length > 0;
      if (!lista.length) {
        v.textContent = q ? "Nessuna richiesta corrisponde alla ricerca."
          : S.richieste.length ? (V.filtro === "aperte" ? "Nessuna richiesta da gestire. Quelle già chiuse sono sotto «Chiuse»." : "Nessuna richiesta in questo elenco.")
          : A.attiva() ? "Ancora nessuna richiesta. Quando qualcuno compila «Vendi la tua auto» sul sito, la vedi qui con i suoi dati e le foto."
          : "Il modulo «Vendi la tua auto» non è acceso su questo sito.";
      }
    },

    /* ---------- dati di esempio ---------- */
    demo(auto) {
      const oggi = X.oggi(), base = oggi + "T";
      const giorno = (n) => AP.Visite.piu(oggi, -n) + "T" + ["09:12:00", "11:40:00", "17:05:00"][n % 3];
      const m = (id, off, tono, p) => {
        const foto = [], mappa = leggi(FOTO, {});
        for (let i = 1; i <= 4; i++) { const n = `demo-${id}-${i}.jpg`; mappa[n] = segnaposto(esc(p.marca + " " + p.modello), tono + i * 6); foto.push(n); }
        scrivi(FOTO, mappa);
        return R().norm(Object.assign({ id, creato: giorno(off), aggiornato: giorno(off), origine: "vetrina", foto: foto.join("|"), demo: true, cosa: "vendere", contatto_pref: "telefono",
          consenso: { privacy: true, marketing: false, versione: R().VERSIONE_PRIVACY, data: oggi } }, p));
      };
      void base; void auto;
      return [
        m("rdemo1", 0, 210, { stato: "nuova", marca: "Volkswagen", modello: "Golf", versione: "2.0 TDI Style", anno: 2019, km: 86000, alimentazione: "Diesel", cambio: "Manuale", cv: 150, colore: "Grigio", condizioni: "buono", incidenti: "no", finanziata: "no", tagliandi: "completi", proprietari: 1, doppia_chiave: "si", prezzo: 15500, quando: "mese", nome: "Davide Greco", telefono: "333 200 3001", email: "davide@example.com", contatto_pref: "whatsapp", note: "Posso passare il sabato mattina." }),
        m("rdemo2", 2, 30, { stato: "contattata", cosa: "permuta", marca: "BMW", modello: "Serie 3", versione: "320d Touring", anno: 2017, km: 142000, alimentazione: "Diesel", cambio: "Automatico", cv: 190, colore: "Nero", condizioni: "discreto", incidenti: "lievi", finanziata: "no", tagliandi: "parziali", proprietari: 2, difetti: "Graffi sul paraurti posteriore, spia dell’airbag ogni tanto.", permuta_con: "Un SUV usato, massimo 25.000 €", quando: "subito", nome: "Silvia Rinaldi", telefono: "333 200 3002", note_interne: "Richiamata lunedì: viene giovedì alle 17 con l’auto." }),
        m("rdemo3", 5, 120, { stato: "offerta", cosa: "vendere", marca: "Fiat", modello: "500", versione: "1.2 Lounge", anno: 2016, km: 61000, alimentazione: "Benzina", cambio: "Manuale", cv: 69, colore: "Bianco", condizioni: "ottimo", incidenti: "no", finanziata: "no", tagliandi: "completi", proprietari: 1, prezzo: 6500, quando: "senza_fretta", nome: "Marta De Luca", telefono: "333 200 3003", offerta: 5800, note_interne: "Offerta fatta a 5.800 €: deve pensarci." }),
      ];
    },
  });

  /* ---------- elenco ---------- */
  const fa = (iso) => {
    if (!iso) return "";
    const g = AP.Visite.giorniTra(iso.slice(0, 10), X.oggi());
    return g <= 0 ? "oggi" : g === 1 ? "ieri" : g < 8 ? g + " giorni fa" : iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4);
  };
  function riga(r) {
    const f = nomiFoto(r)[0], src = f ? fotoSrc(f) : "";
    const th = src ? `<img class="thumb vr-th" src="${esc(src)}" alt="" loading="lazy">` : `<span class="thumb vr-th vuota" aria-hidden="true"></span>`;
    const pers = r.anonimo ? "dati personali cancellati" : [r.nome, r.telefono].filter(Boolean).join(" · ");
    const cosa = etich(R().COSA, r.cosa).replace(/^Voglio /, "vuole ").replace(/^vuole solo sapere quanto vale$/, "vuole sapere quanto vale");
    const nf = nomiFoto(r).length;
    return `<li class="vr s-${r.stato}" data-id="${esc(r.id)}" tabindex="0" aria-label="${esc(R().titolo(r) + ", " + R().nomeStato(r.stato))}">`
      + th
      + `<div class="vr-c"><div class="vr-t"><b>${esc(R().titolo(r))}</b> <span class="tag ${r.stato === "nuova" ? "warn" : r.stato === "acquistata" ? "ok" : ""}">${esc(R().nomeStato(r.stato))}</span>${r.origine === "vetrina" ? ' <span class="tag">Dal sito</span>' : ""}${r.demo ? ' <span class="tag">Esempio</span>' : ""}</div>`
      + `<small>${esc(R().sottotitolo(r))}${r.prezzo != null ? " · chiede " + esc(eur(r.prezzo)) : ""}${r.offerta != null ? " · offerta " + esc(eur(r.offerta)) : ""}</small>`
      + `<small>${esc(pers)}${!r.anonimo && cosa ? " — " + esc(cosa) : ""}</small></div>`
      + `<div class="vr-a"><span class="muted small">${esc(fa(r.creato))}</span><span class="muted small">${nf} ${nf === 1 ? "foto" : "foto"}</span></div></li>`;
  }

  /* ---------- scheda della richiesta ---------- */
  let CUR = null;
  const F = () => $("#form-ri");
  const riga2 = (k, v) => (v === "" || v == null ? "" : `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`);
  function dettagli(r) {
    const c = R();
    const auto = [
      riga2("Anno", r.anno), riga2("Chilometri", r.km != null ? num(r.km) + " km" : ""), riga2("Alimentazione", r.alimentazione), riga2("Cambio", r.cambio), riga2("Potenza", r.cv != null ? r.cv + " CV" : ""),
      riga2("Colore", r.colore), riga2("Targa", r.targa), riga2("Proprietari", r.proprietari), riga2("Tagliandi", etich(c.TAGLIANDI, r.tagliandi)), riga2("Doppia chiave", r.doppia_chiave === "si" ? "Sì" : r.doppia_chiave === "no" ? "No" : ""),
      riga2("Condizioni", etich(c.CONDIZIONI, r.condizioni)), riga2("Incidenti", etich(c.INCIDENTI, r.incidenti)), riga2("Finanziamento", etich(c.FINANZIATA, r.finanziata)),
    ].join("");
    const testi = [["Difetti", r.difetti], ["Accessori e optional", r.accessori]].filter((x) => x[1]).map((x) => `<div class="vr-tx"><b>${esc(x[0])}</b><p>${esc(x[1])}</p></div>`).join("");
    const richiesta = [
      riga2("Cosa vuole fare", etich(c.COSA, r.cosa).replace(/^Voglio /, "Vuole ")), riga2("Prezzo che spera", r.prezzo != null ? eur(r.prezzo) : ""), riga2("Quando", etich(c.QUANDO, r.quando)),
      riga2("In cambio vorrebbe", r.permuta_con), riga2("Quando richiamarlo", r.fascia), riga2("Come preferisce essere contattato", etich(c.CONTATTO, r.contatto_pref)),
    ].join("");
    return `<h3 class="vr-h">L’auto</h3><dl class="vr-dl">${auto}</dl>${testi}<h3 class="vr-h">La richiesta</h3><dl class="vr-dl">${richiesta}</dl>${r.note ? `<div class="vr-tx"><b>Note del cliente</b><p>${esc(r.note)}</p></div>` : ""}`;
  }
  function galleria(r) {
    const nomi = nomiFoto(r), box = $("#ri-foto");
    if (!nomi.length) { box.innerHTML = `<p class="muted small vr-nofoto">${r.anonimo ? "Le foto sono state cancellate insieme ai dati personali." : "Nessuna foto."}</p>`; return; }
    const src = nomi.map(fotoSrc);
    box.innerHTML = `<a class="vr-grande" id="ri-grande" href="${esc(src[0])}" target="_blank" rel="noopener" title="Apri la foto a schermo intero"><img src="${esc(src[0])}" alt="Foto 1 di ${nomi.length}"></a>`
      + `<div class="vr-mini">${src.map((s, i) => `<button type="button" data-i="${i}" aria-label="Foto ${i + 1} di ${nomi.length}" ${i === 0 ? 'aria-current="true"' : ""}><img src="${esc(s)}" alt="" loading="lazy"></button>`).join("")}</div>`;
    box.onclick = (e) => {
      const b = e.target.closest("[data-i]"); if (!b) return;
      const i = +b.dataset.i, g = $("#ri-grande");
      g.href = src[i]; g.firstElementChild.src = src[i]; g.firstElementChild.alt = `Foto ${i + 1} di ${nomi.length}`;
      box.querySelectorAll(".vr-mini button").forEach((x) => x.removeAttribute("aria-current")); b.setAttribute("aria-current", "true");
    };
  }
  const telPulito = (t) => String(t || "").replace(/[^\d+]/g, "");
  function link(r) {
    const tel = telPulito(r.telefono), wa = tel.replace(/^\+/, "").replace(/^00/, ""), waN = /^3\d{8,9}$/.test(wa) ? "39" + wa : wa;
    const dis = r.anonimo;
    $("#ri-tel").hidden = dis || !tel; $("#ri-wa").hidden = dis || !tel; $("#ri-mail").hidden = dis || !r.email;
    $("#ri-tel").href = "tel:" + tel; $("#ri-wa").href = "https://wa.me/" + waN; $("#ri-mail").href = "mailto:" + r.email + "?subject=" + encodeURIComponent("La tua " + R().titolo(r));
  }
  function consensoTesto(r) {
    if (r.anonimo) return "Dati personali e foto cancellati: resta solo il fatto che la richiesta è arrivata.";
    if (r.origine === "manuale" && !r.consenso.privacy) return "Inserita da te, senza consenso online. Informa il cliente su come usi i suoi dati (informativa del sito).";
    const q = r.consenso.data ? ` il ${r.consenso.data.slice(8, 10)}/${r.consenso.data.slice(5, 7)}/${r.consenso.data.slice(0, 4)}` : "";
    const mesi = ((cfg().privacy || {}).conservazione || {}).richieste_mesi || R().MESI_DEFAULT;
    return `Informativa privacy letta${q}${r.consenso.versione ? " (versione " + r.consenso.versione + ")" : ""}. Comunicazioni commerciali: ${r.consenso.marketing ? "accettate" : "non accettate, usa i dati solo per questa valutazione"}. Dati e foto si cancellano da soli dopo ${mesi} mesi.`;
  }
  function apri(r) {
    if (!r) return;
    CUR = JSON.parse(JSON.stringify(r));
    const f = F(); f.reset();
    $("#ri-titolo").textContent = R().titolo(r);
    $("#ri-sotto").textContent = [R().sottotitolo(r), r.anonimo ? "dati personali cancellati" : [r.nome, r.telefono].filter(Boolean).join(" · "), fa(r.creato) ? "arrivata " + fa(r.creato) : ""].filter(Boolean).join(" — ");
    $("#ri-dettagli").innerHTML = dettagli(r);
    galleria(r);
    f.stato.value = r.stato; f.offerta.value = r.offerta == null ? "" : r.offerta; f.note_interne.value = r.note_interne || "";
    f.note_interne.disabled = r.anonimo;
    $("#ri-err").hidden = true;
    $("#ri-consenso").textContent = consensoTesto(r);
    $("#ri-anon").hidden = r.anonimo || !(r.nome || r.telefono || r.email || nomiFoto(r).length);
    const c = r.contatto_id ? X.S.contatti.find((x) => x.id === r.contatto_id) : null;
    $("#ri-crm").hidden = r.anonimo; $("#ri-crm").textContent = c ? "Apri il contatto" : "Aggiungi ai contatti";
    $("#ri-stima").hidden = !r.marca || !r.modello;
    link(r);
    X.apri($("#d-ric"));
  }
  function initDialogo() {
    const f = F();
    $("#ri-del").onclick = () => {
      if (!confirm(`Eliminare la richiesta «${R().titolo(CUR)}»${CUR.nome ? " di " + CUR.nome : ""}, con le sue foto? Non si può annullare.`)) return;
      togliFotoDemo(nomiFoto(CUR));
      X.S.richieste = X.S.richieste.filter((r) => r.id !== CUR.id); X.salva(); $("#d-ric").close(); X.ridisegna(); X.toast("Richiesta eliminata.");
    };
    $("#ri-anon").onclick = () => {
      if (!confirm("Cancellare nome, telefono, email, note e foto di questa richiesta? Resta in elenco come «anonima» solo per le statistiche. Non si può annullare.")) return;
      const i = X.S.richieste.findIndex((r) => r.id === CUR.id);
      if (i >= 0) { togliFotoDemo(nomiFoto(X.S.richieste[i])); X.S.richieste[i] = R().norm(Object.assign(R().anonimizza(X.S.richieste[i]), { aggiornato: adesso() })); X.salva(); }
      $("#d-ric").close(); X.ridisegna(); X.toast("Dati personali e foto cancellati.");
    };
    $("#ri-crm").onclick = () => {
      const r = X.S.richieste.find((x) => x.id === CUR.id); if (!r) return;
      const esiste = r.contatto_id && X.S.contatti.find((c) => c.id === r.contatto_id);
      if (esiste) { $("#d-ric").close(); X.S.tab = "crm"; X.ridisegna(); return; }
      const c = GT.Crm.norm({ nome: r.nome, telefono: r.telefono, email: r.email, fonte: r.origine === "vetrina" ? "Sito" : "Di persona", auto_testo: "Vende: " + [R().titolo(r), r.anno].filter(Boolean).join(", "), stato: r.stato === "nuova" ? "nuovo" : "contattato",
        note: r.note, attivita: [{ d: adesso(), t: "nota", x: `Richiesta di valutazione («${etich(R().COSA, r.cosa)}»)${r.prezzo != null ? ", spera " + eur(r.prezzo) : ""}.` + (r.consenso.marketing ? " Ha accettato le comunicazioni commerciali." : " Non ha accettato comunicazioni commerciali: usa i dati solo per questa valutazione.") }] });
      const ex = GT.Crm.trova(c, X.S.contatti);
      if (ex) { r.contatto_id = ex.id; X.toast("Era già tra i contatti."); }
      else { X.S.contatti.push(c); r.contatto_id = c.id; X.toast("Aggiunto ai contatti."); }
      X.salva(); $("#d-ric").close(); X.ridisegna();
    };
    $("#ri-stima").onclick = () => {
      const r = CUR; $("#d-ric").close();
      GT.Stima.apri({ modo: "compra", id: null, lavori: 0, valori: { marca: r.marca, modello: r.modello, allestimento: r.versione, anno: r.anno, km: r.km, prezzo: r.prezzo } });
    };
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      const err = (m) => { const p = $("#ri-err"); p.textContent = m; p.hidden = false; };
      let off = null;
      if (f.offerta.value.trim()) { off = X.numero(f.offerta.value); if (off == null || off < 0) return err("Controlla l’importo dell’offerta."); off = Math.round(off); }
      const i = X.S.richieste.findIndex((r) => r.id === CUR.id); if (i < 0) return;
      const prima = X.S.richieste[i];
      const nuovo = R().norm(Object.assign({}, prima, { stato: f.stato.value, offerta: off, note_interne: f.note_interne.value, aggiornato: adesso() }));
      X.S.richieste[i] = nuovo; X.salva(); $("#d-ric").close(); X.ridisegna(); X.toast("Richiesta aggiornata.");
    });
  }
})();
