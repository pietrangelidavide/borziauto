/* AutoProfit · agenda delle visite (lato dealer).
   Le richieste dei clienti arrivano dal sito (src/visite.js) e finiscono qui con la sincronizzazione, come le auto e i contatti.
   Le regole degli orari sono le stesse del sito (js/visite-core.js). Provata nel browser con _work/t_agenda.py. */
(function () {
  "use strict";
  const GT = (window.GT = window.GT || {});
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => TG.esc(s);
  let X = null;
  const V = { vista: "elenco", chiuse: false, sett: 0 };     // sett: spostamento in settimane rispetto a oggi
  const GIORNI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
  const GG = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
  const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  const dataLunga = (iso) => { const g = AP.Visite.giornoSett(iso); return `${GIORNI[g]} ${+iso.slice(8, 10)} ${MESI[+iso.slice(5, 7) - 1]}`; };
  const dataBreve = (iso) => `${+iso.slice(8, 10)} ${MESI[+iso.slice(5, 7) - 1]}`;
  const cfg = () => (window.AP && AP.Config && AP.Config.cfg) || {};
  const ATTIVA = (v) => AP.Visite.ATTIVE.includes(v.stato);
  const ord = (a, b) => (a.data + a.ora > b.data + b.ora ? 1 : a.data + a.ora < b.data + b.ora ? -1 : 0);
  const CODA = "autoprofit.visite.coda";
  let seq = 0;
  const nuovoId = () => "m" + Date.now().toString(36) + (seq++).toString(36);
  const adesso = () => new Date().toISOString().slice(0, 16);

  const autoDi = (v) => (v.auto_id ? X.S.auto.find((a) => a.id === v.auto_id) : null);
  const descAuto = (v) => { const a = autoDi(v); return a ? [X.titolo(a), a.allestimento].filter(Boolean).join(" · ") : v.auto_testo || ""; };
  const oraFine = (v) => AP.Visite.hhmm(AP.Visite.min(v.ora) + (v.durata || 30));
  const telPulito = (t) => String(t || "").replace(/[^\d+]/g, "");

  /* ---------- numeri in alto ---------- */
  const A = (GT.Agenda = {
    daConfermare: () => (X ? X.S.visite.filter((v) => v.stato === "richiesta").length : 0),
    nuova: () => apriVisita(null),
    init(ctx) {
      X = ctx;
      const sel = (el, opts) => (el.innerHTML = opts.map((o) => `<option value="${esc(o[0])}">${esc(o[1])}</option>`).join(""));
      sel($('#form-vi [name="stato"]'), AP.Visite.STATI);
      sel($('#form-vi [name="durata"]'), [[15, "15 minuti"], [30, "30 minuti"], [45, "45 minuti"], [60, "1 ora"], [90, "1 ora e mezza"], [120, "2 ore"]]);
      $("#av-elenco").onclick = () => { V.vista = "elenco"; A.disegna(); };
      $("#av-sett").onclick = () => { V.vista = "sett"; A.disegna(); };
      $("#av-chiuse").onchange = (e) => { V.chiuse = e.target.checked; A.disegna(); };
      $("#av-prec").onclick = () => { V.sett--; A.disegna(); };
      $("#av-succ").onclick = () => { V.sett++; A.disegna(); };
      $("#av-oggi").onclick = () => { V.sett = 0; A.disegna(); };
      $("#agenda").addEventListener("click", (e) => {
        const az = e.target.closest("[data-az]");
        if (az) { e.stopPropagation(); const v = X.S.visite.find((x) => x.id === az.closest("[data-id]").dataset.id); if (v) azione(v, az.dataset.az); return; }
        const r = e.target.closest("[data-id]"); if (r) apriVisita(X.S.visite.find((x) => x.id === r.dataset.id));
      });
      $("#agenda").addEventListener("keydown", (e) => { const r = e.target.closest && e.target.closest("[data-id]"); if (r && e.target === r && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); apriVisita(X.S.visite.find((x) => x.id === r.dataset.id)); } });
      initDialogo();
      A.pulisci();
    },

    /* demo: il sito, senza server, lascia le richieste in questo browser («coda»); qui si leggono e si tiene la coda allineata a ciò che fa il dealer.
       Senza demo la coda non esiste e queste due funzioni non fanno nulla. */
    codaIn() {
      let coda = []; try { coda = JSON.parse(localStorage.getItem(CODA)) || []; } catch (e) { return 0; }
      if (!Array.isArray(coda) || !coda.length) return 0;
      let n = 0;
      coda.map(AP.Visite.norm).filter((v) => v.id).forEach((v) => {
        const i = X.S.visite.findIndex((x) => x.id === v.id);
        if (i < 0) { X.S.visite.push(v); n++; }
        else if (v.aggiornato > X.S.visite[i].aggiornato && v.stato !== X.S.visite[i].stato) X.S.visite[i] = Object.assign({}, X.S.visite[i], { stato: v.stato, aggiornato: v.aggiornato });   // il cliente ha annullato dal sito
      });
      if (n) X.salva(true);
      return n;
    },
    codaOut() {
      let coda = []; try { coda = JSON.parse(localStorage.getItem(CODA)) || []; } catch (e) { return; }
      if (!Array.isArray(coda) || !coda.length) return;
      let cambiato = false;
      coda.forEach((c, i) => { const v = X.S.visite.find((x) => x.id === c.id); if (v && (v.stato !== c.stato || v.aggiornato !== c.aggiornato)) { coda[i] = Object.assign({}, c, { stato: v.stato, aggiornato: v.aggiornato }); cambiato = true; } });
      if (cambiato) { try { localStorage.setItem(CODA, JSON.stringify(coda)); } catch (e) { /* niente */ } }
    },

    /* conservazione: le visite più vecchie del periodo scelto dal garage si cancellano (stessa regola del server) */
    pulisci() {
      const mesi = +(((cfg().privacy || {}).conservazione || {}).visite_mesi) || 12, oggi = X.oggi();
      const prima = X.S.visite.length;
      X.S.visite = X.S.visite.filter((v) => !AP.Visite.scaduta(v, oggi, mesi));
      if (X.S.visite.length !== prima) X.salva();
      return prima - X.S.visite.length;
    },

    kpi() {
      const oggi = X.oggi(), l = X.S.visite, att = l.filter(ATTIVA), lun = AP.Visite.piu(oggi, -((AP.Visite.giornoSett(oggi) + 6) % 7)), dom = AP.Visite.piu(lun, 6);
      const richieste = l.filter((v) => v.stato === "richiesta").length, hOggi = att.filter((v) => v.data === oggi).length;
      const sett = att.filter((v) => v.data >= lun && v.data <= dom).length;
      const da30 = AP.Visite.piu(oggi, -30), recenti = l.filter((v) => v.data >= da30 && v.data < oggi && (v.stato === "svolta" || v.stato === "non_venuto"));
      const nv = recenti.filter((v) => v.stato === "non_venuto").length;
      const daChiudere = att.filter((v) => v.data < oggi).length;
      const t = (lbl, val, sub, cls) => `<div class="kpi ${cls || ""}"><span class="kpi-l">${lbl}</span><b class="kpi-v">${val}</b><small>${sub}</small></div>`;
      return t("Da confermare", richieste, richieste ? "rispondi al cliente" : "nessuna in attesa", richieste ? "warn" : "")
        + t("Oggi", hOggi, hOggi ? `${hOggi === 1 ? "visita" : "visite"} in programma` : "nessuna visita")
        + t("Questa settimana", sett, sett ? "tra confermate e da confermare" : "agenda libera")
        + t("Non venuti (30 giorni)", recenti.length ? `${nv} su ${recenti.length}` : "–", recenti.length ? (nv ? "chiama prima per ridurli" : "tutti presenti") : "ancora nessun dato", nv > 1 ? "warn" : "")
        + (daChiudere ? t("Da chiudere", daChiudere, "visite passate senza esito", "warn") : "");
    },

    /* ---------- disegno ---------- */
    disegna() {
      const S = X.S, oggi = X.oggi(), q = TG.norm(X.q ? X.q() : "");
      $("#av-kpi").innerHTML = A.kpi();
      $("#av-elenco").setAttribute("aria-pressed", String(V.vista === "elenco")); $("#av-sett").setAttribute("aria-pressed", String(V.vista === "sett"));
      $("#av-chiuse").checked = V.chiuse; $("#av-chiuse").closest("label").hidden = V.vista !== "elenco";
      $("#av-nav").hidden = V.vista !== "sett";
      const ok = (v) => !q || TG.norm([v.nome, v.telefono, v.email, descAuto(v), v.note].join(" ")).includes(q);
      const lista = S.visite.filter(ok).slice().sort(ord);
      const vuoto = $("#av-vuoto");
      $("#av-lista").hidden = V.vista !== "elenco"; $("#av-settimana").hidden = V.vista !== "sett";
      if (V.vista === "elenco") {
        const dachiudere = lista.filter((v) => ATTIVA(v) && v.data < oggi);
        const future = lista.filter((v) => ATTIVA(v) && v.data >= oggi);
        const chiuse = V.chiuse ? lista.filter((v) => !ATTIVA(v)).reverse() : [];
        let h = "";
        if (dachiudere.length) h += gruppo("Da chiudere: com’è andata?", dachiudere, "chiudere", true);
        const perGiorno = {}; future.forEach((v) => (perGiorno[v.data] = perGiorno[v.data] || []).push(v));
        Object.keys(perGiorno).sort().forEach((d) => { const g = AP.Visite.giorniTra(oggi, d); h += gruppo(g === 0 ? "Oggi" : g === 1 ? "Domani" : cap(dataLunga(d)), perGiorno[d], d === oggi ? "oggi" : "", false, g <= 1 ? dataLunga(d) : ""); });
        if (chiuse.length) h += gruppo("Già chiuse", chiuse, "chiuse", false);
        $("#av-lista").innerHTML = h;
        const nulla = !dachiudere.length && !future.length && !chiuse.length;
        vuoto.hidden = !nulla;
        if (nulla) vuoto.textContent = S.visite.length ? (q ? "Nessuna visita corrisponde alla ricerca." : "Nessuna visita in programma. Le prenotazioni dal sito compariranno qui; puoi anche aggiungerne una a mano.") : "Ancora nessuna visita. Quando un cliente prenota dal sito la vedi qui; puoi anche aggiungerne una a mano con «+ Nuova visita».";
      } else {
        vuoto.hidden = true;
        const lun = AP.Visite.piu(oggi, -((AP.Visite.giornoSett(oggi) + 6) % 7) + V.sett * 7), giorni = [0, 1, 2, 3, 4, 5, 6].map((i) => AP.Visite.piu(lun, i));
        $("#av-intervallo").textContent = `${dataBreve(giorni[0])} – ${dataBreve(giorni[6])} ${giorni[6].slice(0, 4)}`;
        $("#av-settimana").innerHTML = giorni.map((d) => {
          const l = lista.filter((v) => v.data === d && (V.chiuse || v.stato !== "annullata")), aperto = AP.Visite.apertoIn(cfg(), d);
          return `<section class="sg ${d === oggi ? "oggi" : ""} ${aperto ? "" : "chiuso"}" aria-label="${esc(dataLunga(d))}"><h3><span>${GG[AP.Visite.giornoSett(d)]}</span> <b>${+d.slice(8, 10)}</b></h3>`
            + (l.length ? l.map((v) => `<div class="sv s-${v.stato}" data-id="${esc(v.id)}" tabindex="0"><b>${esc(v.ora)}</b> ${esc(v.nome || "Cliente")}<small>${esc(descAuto(v))}</small></div>`).join("") : `<p class="sv-v">${aperto ? "libero" : "chiuso"}</p>`) + "</section>";
        }).join("");
      }
    },

    /* ---------- dati di esempio ---------- */
    demo(auto) {
      const oggi = X.oggi(), d = auto.filter((a) => a.stato === "disponibile" && a.demo);
      if (d.length < 3) return [];
      const c = cfg(), prossimoAperto = (iso, passo) => { for (let i = 0; i < 14 && !AP.Visite.apertoIn(c, iso); i++) iso = AP.Visite.piu(iso, passo); return iso; };
      const orario = (iso, n) => { const s = AP.Visite.slotGiorno(c, iso, []); return s.length ? s[Math.min(s.length - 1, n)].ora : "10:00"; };
      let k = 0;
      const mk = (i, off, passo, n, p) => {
        const iso = prossimoAperto(AP.Visite.piu(oggi, off), passo), a = d[i % d.length];
        return AP.Visite.norm(Object.assign({ id: "vdemo" + k++, auto_id: a.id, data: iso, ora: orario(iso, n), durata: (c.visite || {}).durata || 30, origine: "vetrina", creato: iso + "T09:00", demo: true,
          consenso: { privacy: true, marketing: false, versione: AP.Visite.VERSIONE_PRIVACY, data: oggi } }, p));
      };
      return [
        mk(0, -2, -1, 2, { nome: "Marco Ferri", telefono: "333 100 2001", stato: "svolta", note: "Ha fatto la prova su strada." }),
        mk(1, -1, -1, 4, { nome: "Elisa Gallo", telefono: "333 100 2002", stato: "non_venuto" }),
        mk(2, 0, 1, 6, { nome: "Paolo Riva", telefono: "333 100 2003", stato: "confermata", note: "Porta la sua auto in permuta." }),
        mk(0, 1, 1, 1, { nome: "Sara Conti", telefono: "333 100 2004", email: "sara@example.com", stato: "richiesta", origine: "vetrina" }),
        mk(1, 2, 1, 3, { nome: "Luca Bianchi", telefono: "333 100 2005", stato: "confermata", origine: "manuale", note: "Cliente già in trattativa." }),
        mk(2, 3, 1, 5, { nome: "Giulia Neri", telefono: "333 100 2006", email: "giulia@example.com", stato: "richiesta", consenso: { privacy: true, marketing: true, versione: AP.Visite.VERSIONE_PRIVACY, data: oggi } }),
      ];
    },
  });
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  function gruppo(titolo, l, cls, evidenzia, sotto) {
    return `<section class="ag ${cls || ""}"><h3>${esc(titolo)}${sotto ? `<small>${esc(sotto)}</small>` : ""}<span>${l.length}</span></h3><ul>${l.map((v) => riga(v, evidenzia)).join("")}</ul></section>`;
  }
  function bottoni(v, passata) {
    const b = (az, t, cls) => `<button type="button" class="btn ${cls || "btn-line"} sm" data-az="${az}">${t}</button>`;
    if (v.stato === "richiesta") return b("conferma", "Conferma", "btn-light") + b("annulla", "Annulla");
    if (v.stato === "confermata") return (passata ? b("svolta", "Svolta", "btn-light") + b("non_venuto", "Non è venuto") : b("svolta", "Svolta") + b("annulla", "Annulla"));
    return b("riapri", "Riapri");
  }
  function riga(v, passata) {
    const a = descAuto(v), pers = v.anonimo ? "dati cancellati" : [v.telefono, v.email].filter(Boolean).join(" · ");
    return `<li class="vi s-${v.stato}" data-id="${esc(v.id)}" tabindex="0">`
      + `<div class="vi-o"><b>${esc(v.ora)}</b><small>${esc(oraFine(v))}</small></div>`
      + `<div class="vi-c"><div class="vi-t"><b>${esc(v.nome || (v.anonimo ? "Cliente anonimo" : "Cliente"))}</b> <span class="tag ${v.stato === "richiesta" ? "warn" : v.stato === "confermata" ? "ok" : ""}">${esc(AP.Visite.nomeStato(v.stato))}</span>`
      + (v.origine === "vetrina" ? ' <span class="tag">Dal sito</span>' : "") + (v.demo ? ' <span class="tag">Esempio</span>' : "") + "</div>"
      + `<small>${esc([a, pers].filter(Boolean).join(" — "))}</small>${v.note ? `<small class="vi-n">${esc(v.note)}</small>` : ""}</div>`
      + `<div class="vi-a">${bottoni(v, passata)}</div></li>`;
  }

  /* ---------- azioni rapide ---------- */
  function azione(v, az) {
    const nuovo = { conferma: "confermata", svolta: "svolta", non_venuto: "non_venuto", annulla: "annullata", riapri: "confermata" }[az];
    if (!nuovo) return;
    v.stato = nuovo; v.aggiornato = adesso();
    X.salva(); X.ridisegna();
    X.toast({ confermata: "Visita confermata.", svolta: "Segnata come svolta.", non_venuto: "Segnata: non è venuto.", annullata: "Visita annullata." }[nuovo]);
  }

  /* ---------- finestra della visita ---------- */
  let CUR = null, nuovaV = false;
  const F = () => $("#form-vi");
  function riempiAuto(selId) {
    const el = F().auto_id;
    el.innerHTML = '<option value="">— nessuna in particolare —</option>' + X.S.auto.filter((a) => a.stato === "disponibile" || a.id === selId).map((a) => `<option value="${esc(a.id)}">${esc(X.titolo(a) + (a.allestimento ? " · " + a.allestimento : ""))}</option>`).join("");
    el.value = selId || "";
  }
  function avviso() {
    const f = F(), data = f.data.value, ora = f.ora.value, el = $("#vi-avviso");
    el.hidden = true; el.textContent = "";
    if (!data || !ora || !AP.Visite.dataValida(data) || AP.Visite.min(ora) == null) return;
    const altre = X.S.visite.filter((v) => v.id !== CUR.id), s = AP.Visite.slotGiorno(cfg(), data, altre).find((x) => x.ora === AP.Visite.hhmm(AP.Visite.min(ora)));
    const stato = f.stato.value;
    if (!AP.Visite.ATTIVE.includes(stato)) return;
    if (!AP.Visite.apertoIn(cfg(), data)) { el.textContent = "Quel giorno il garage risulta chiuso (orari o ferie). Puoi salvarla lo stesso."; el.hidden = false; }
    else if (!s) { el.textContent = "È fuori dagli orari di apertura. Puoi salvarla lo stesso."; el.hidden = false; }
    else if (s.motivo === "occupato") { el.textContent = "Si sovrappone a un’altra visita già in agenda. Puoi salvarla lo stesso."; el.hidden = false; }
  }
  function aggiornaLink() {
    const f = F(), tel = telPulito(f.telefono.value), wa = tel.replace(/^\+/, "").replace(/^00/, ""), waN = /^3\d{8,9}$/.test(wa) ? "39" + wa : wa;
    $("#vi-tel").hidden = !tel; $("#vi-wa").hidden = !tel;
    $("#vi-tel").href = "tel:" + tel; $("#vi-wa").href = "https://wa.me/" + waN;
  }
  function consensoTesto(v) {
    if (v.anonimo) return "Dati personali cancellati: resta solo il fatto che la visita c’è stata.";
    if (v.origine === "manuale" && !v.consenso.privacy) return "Inserita da te, senza consenso online. Informa il cliente su come usi i suoi dati (informativa del sito).";
    const quando = v.consenso.data ? ` il ${v.consenso.data.slice(8, 10)}/${v.consenso.data.slice(5, 7)}/${v.consenso.data.slice(0, 4)}` : "";
    return `Informativa privacy letta${quando}${v.consenso.versione ? " (versione " + v.consenso.versione + ")" : ""}. Comunicazioni commerciali: ${v.consenso.marketing ? "accettate" : "non accettate, usa i dati solo per questa visita"}.`;
  }
  function apriVisita(v) {
    nuovaV = !v;
    const oggi = X.oggi();
    CUR = JSON.parse(JSON.stringify(v || AP.Visite.norm({ id: nuovoId(), data: oggi, ora: "", durata: (cfg().visite || {}).durata || 30, stato: "confermata", origine: "manuale", creato: adesso() })));
    const f = F(); f.reset();
    $("#vi-titolo").textContent = nuovaV ? "Nuova visita" : "Visita · " + (CUR.nome || "cliente");
    $("#vi-err").hidden = true; $("#vi-del").hidden = nuovaV;
    riempiAuto(CUR.auto_id);
    ["nome", "telefono", "email", "auto_testo", "data", "ora", "durata", "stato", "note"].forEach((k) => (f[k].value = CUR[k] == null ? "" : CUR[k]));
    if (!CUR.ora && nuovaV) f.ora.value = "";
    $("#vi-consenso").textContent = nuovaV ? "" : consensoTesto(CUR);
    $("#vi-consenso").hidden = nuovaV;
    $("#vi-anon").hidden = nuovaV || CUR.anonimo || !(CUR.nome || CUR.telefono || CUR.email);
    const c = CUR.contatto_id ? X.S.contatti.find((x) => x.id === CUR.contatto_id) : null;
    $("#vi-crm").hidden = nuovaV || CUR.anonimo; $("#vi-crm").textContent = c ? "Apri il contatto" : "Aggiungi ai contatti";
    $("#vi-ics").hidden = nuovaV || CUR.anonimo || !CUR.data || !CUR.ora;
    aggiornaLink(); avviso();
    X.apri($("#d-visita"));
  }
  function scarica(nome, testo, tipo) {
    const url = URL.createObjectURL(new Blob([testo], { type: tipo })), a = document.createElement("a");
    a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function initDialogo() {
    const f = F();
    f.telefono.addEventListener("input", aggiornaLink);
    ["data", "ora", "stato"].forEach((k) => f[k].addEventListener("input", avviso));
    $("#vi-del").onclick = () => { if (confirm(`Eliminare la visita di «${CUR.nome || "cliente"}»?`)) { X.S.visite = X.S.visite.filter((v) => v.id !== CUR.id); X.salva(); $("#d-visita").close(); X.ridisegna(); X.toast("Visita eliminata."); } };
    $("#vi-anon").onclick = () => {
      if (!confirm("Cancellare nome, telefono, email e note di questo cliente? La visita resta in agenda come «anonima». Non si può annullare.")) return;
      const i = X.S.visite.findIndex((v) => v.id === CUR.id);
      if (i >= 0) { X.S.visite[i] = AP.Visite.norm(AP.Visite.anonimizza(X.S.visite[i])); X.salva(); }
      $("#d-visita").close(); X.ridisegna(); X.toast("Dati personali cancellati.");
    };
    $("#vi-crm").onclick = () => {
      const v = X.S.visite.find((x) => x.id === CUR.id); if (!v) return;
      const esiste = v.contatto_id && X.S.contatti.find((c) => c.id === v.contatto_id);
      if (esiste) { $("#d-visita").close(); X.S.tab = "crm"; X.ridisegna(); return; }
      const c = GT.Crm.norm({ nome: v.nome, telefono: v.telefono, email: v.email, fonte: v.origine === "vetrina" ? "Sito" : "Di persona", auto_id: v.auto_id, auto_testo: v.auto_testo, stato: v.stato === "svolta" ? "contattato" : "appuntamento", note: v.note,
        attivita: [{ d: v.data + "T" + v.ora, t: "visita", x: "Visita " + (v.stato === "svolta" ? "svolta" : "in agenda") }, { d: adesso(), t: "nota", x: v.consenso.marketing ? "Ha accettato le comunicazioni commerciali." : "Non ha accettato comunicazioni commerciali: usa i dati solo per questa trattativa." }] });
      const ex = GT.Crm.trova(c, X.S.contatti);
      if (ex) { v.contatto_id = ex.id; X.toast("Era già tra i contatti."); }
      else { X.S.contatti.push(c); v.contatto_id = c.id; X.toast("Aggiunto ai contatti."); }
      X.salva(); $("#d-visita").close(); X.ridisegna();
    };
    $("#vi-ics").onclick = () => { const g = cfg().contatti || {}, v = Object.assign({}, CUR, { id: CUR.id }); scarica("visita-" + CUR.data + ".ics", AP.Visite.ics(v, { nome: cfg().nome, indirizzo: g.indirizzo, citta: g.citta, telefono: g.telefono }), "text/calendar"); };
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      const err = (m) => { const p = $("#vi-err"); p.textContent = m; p.hidden = false; };
      if (!CUR.anonimo && !f.nome.value.trim()) return err("Scrivi almeno il nome.");
      if (!AP.Visite.dataValida(f.data.value)) return err("Scegli il giorno.");
      if (AP.Visite.min(f.ora.value) == null) return err("Scegli l’ora.");
      const prima = nuovaV ? null : X.S.visite.find((v) => v.id === CUR.id);
      Object.assign(CUR, { nome: f.nome.value, telefono: f.telefono.value, email: f.email.value, auto_id: f.auto_id.value, auto_testo: f.auto_testo.value, data: f.data.value, ora: f.ora.value, durata: +f.durata.value || 30, stato: f.stato.value, note: f.note.value, aggiornato: adesso() });
      if (nuovaV) CUR.origine = "manuale";
      const rec = AP.Visite.norm(CUR);
      if (prima) X.S.visite[X.S.visite.indexOf(prima)] = rec; else X.S.visite.push(rec);
      X.salva(); $("#d-visita").close(); X.ridisegna(); X.toast(prima ? "Visita aggiornata." : "Visita aggiunta.");
    });
  }
})();
