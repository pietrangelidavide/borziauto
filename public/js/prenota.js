/* AutoProfit · prenotazione di una visita (lato cliente): calendario, orari liberi, modulo, conferma, annullamento.
   Le regole (orari, ferie, preavviso, posti) sono quelle di js/visite-core.js, le stesse che il Worker ricontrolla.
   Due modi:
     - normale: gli orari già presi arrivano da /api/visite e la richiesta viaggia al Worker (src/visite.js)
     - demo (garage.json → demo:true): nessun server; gli orari occupati sono finti e la richiesta resta in questo browser
       (localStorage «autoprofit.visite.coda»), dove il gestionale la ritrova nell'agenda. */
(function () {
  "use strict";
  const AP = (window.AP = window.AP || {});
  const V = AP.Visite;
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => TG.esc(s);
  const CODA = "autoprofit.visite.coda", MIA = "autoprofit.prenotazione";
  const GIORNI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
  const GG = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
  const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  const pad = (n) => String(n).padStart(2, "0");
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const leggi = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const scrivi = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* senza memoria si va avanti lo stesso */ } };
  const quando = (data, ora) => `${cap(GIORNI[V.giornoSett(data)])} ${+data.slice(8, 10)} ${MESI[+data.slice(5, 7) - 1]}${ora ? ", ore " + ora : ""}`;
  const breve = (data) => `${cap(GG[V.giornoSett(data)])} ${+data.slice(8, 10)} ${MESI[+data.slice(5, 7) - 1].slice(0, 3)}`;
  const CODICE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const casuale = (n, set) => { let s = ""; const a = new Uint32Array(n); (window.crypto || { getRandomValues: (x) => x.forEach((_, i) => (x[i] = Math.random() * 4294967296)) }).getRandomValues(a); for (let i = 0; i < n; i++) s += set[a[i] % set.length]; return s; };

  const P = { cfg: null, auto: [], occ: [], adesso: null, giorni: {}, mese: "", giorno: "", ora: "", locale: false, stato: "carico", conferma: null, annullando: false };

  /* ---------- orari occupati ---------- */
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  /* demo: alcuni orari «già presi» ma sempre gli stessi per la stessa data, così il calendario sembra vero */
  function occupateFinte() {
    const r = V.regole(P.cfg), out = [];
    for (let i = 0; i <= r.giorniMax; i++) {
      const d = V.piu(P.adesso.data, i);
      V.fasce(P.cfg, d).forEach(([a, b]) => { for (let t = a; t + r.durata <= b; t += r.passo) if (hash(d + "|" + t) % 100 < 24) out.push({ data: d, ora: V.hhmm(t), durata: r.durata, stato: "confermata" }); });
    }
    return out;
  }
  async function caricaOccupate() {
    P.adesso = V.adesso(P.cfg.fuso);
    if (P.locale) {
      P.occ = occupateFinte().concat(leggi(CODA, []).filter((v) => V.ATTIVE.includes(v.stato)).map((v) => ({ data: v.data, ora: v.ora, durata: v.durata, stato: v.stato })));
      P.stato = "ok"; return;
    }
    const r = V.regole(P.cfg);
    try {
      const res = await fetch("api/visite?da=" + P.adesso.data + "&a=" + V.piu(P.adesso.data, r.giorniMax + 1), { headers: { accept: "application/json" }, cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const j = await res.json();
      P.occ = Array.isArray(j.occupate) ? j.occupate.map((x) => ({ data: x.data, ora: x.ora, durata: x.durata, stato: "confermata" })) : [];
      if (j.ora && V.dataValida(j.ora.data) && typeof j.ora.min === "number") P.adesso = j.ora;           // vale l'orologio del garage, non quello del telefono
      P.stato = "ok";
    } catch (e) { P.stato = "non_attivo"; }
  }
  function ricalcola() {
    P.giorni = {};
    V.giorni(P.cfg, P.occ, P.adesso, 400).forEach((g) => (P.giorni[g.data] = g));
  }

  /* ---------- calendario ---------- */
  const meseDi = (iso) => iso.slice(0, 7);
  function primoUltimoMese() { const r = V.regole(P.cfg); return [meseDi(P.adesso.data), meseDi(V.piu(P.adesso.data, r.giorniMax))]; }
  function disegnaCal() {
    const [y, m] = P.mese.split("-").map(Number), primo = `${y}-${pad(m)}-01`, off = (V.giornoSett(primo) + 6) % 7, n = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const [da, a] = primoUltimoMese();
    $("#pr-mese").textContent = `${MESI[m - 1]} ${y}`;
    $("#pr-prec").disabled = P.mese <= da; $("#pr-succ").disabled = P.mese >= a;
    let h = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((x) => `<span class="cal-h" aria-hidden="true">${x}</span>`).join("");
    for (let i = 0; i < off; i++) h += '<span class="cal-v"></span>';
    for (let d = 1; d <= n; d++) {
      const iso = `${y}-${pad(m)}-${pad(d)}`, g = P.giorni[iso], libero = g && g.liberi > 0, chiuso = g && !g.aperto;
      const cls = ["cal-g", libero ? "libero" : "", chiuso ? "chiuso" : "", iso === P.adesso.data ? "oggi" : ""].filter(Boolean).join(" ");
      const lbl = `${quando(iso)}: ${!g ? "non prenotabile" : chiuso ? "chiuso" : libero ? g.liberi + (g.liberi === 1 ? " orario libero" : " orari liberi") : "nessun orario libero"}`;
      h += `<button type="button" class="${cls}" data-d="${iso}" aria-label="${esc(lbl)}" aria-pressed="${iso === P.giorno}" ${libero ? "" : "disabled"}>${d}</button>`;
    }
    $("#pr-cal").innerHTML = h;
  }
  function disegnaOre() {
    const t = $("#pr-ore-t"), box = $("#pr-ore"), vuoto = $("#pr-vuoto");
    vuoto.hidden = true;
    if (!P.giorno) { t.hidden = true; box.innerHTML = ""; return; }
    const g = P.giorni[P.giorno], slot = g ? g.slot.filter((s) => s.libero || s.motivo === "occupato") : [];
    t.hidden = false; t.textContent = "Scegli l’ora · " + quando(P.giorno);
    box.innerHTML = slot.map((s) => `<button type="button" class="ora" data-o="${s.ora}" aria-pressed="${s.ora === P.ora}" ${s.libero ? "" : "disabled"}${s.libero ? "" : ' aria-label="' + s.ora + ', già preso"'}>${s.ora}</button>`).join("");
    if (!slot.length) { vuoto.hidden = false; vuoto.textContent = "Quel giorno non ci sono orari liberi."; }
  }
  function aggiornaScelta() {
    const el = $("#pr-scelta"), ok = P.giorno && P.ora;
    el.classList.toggle("vuota", !ok);
    el.textContent = ok ? quando(P.giorno, P.ora) : "Scegli giorno e ora dal calendario";
  }
  function vai(data, ora, scorri) {
    if (!P.giorni[data]) return;
    P.giorno = data; P.ora = ora || ""; P.mese = meseDi(data);
    disegnaCal(); disegnaOre(); aggiornaScelta();
    if (scorri) { const s = $("#prenota"); if (s) s.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); }
  }

  /* ---------- «prossime visite libere» nella prima schermata ---------- */
  function disegnaTagliando() {
    const box = $("#tagliando"); if (!box) return;
    const giorni = Object.keys(P.giorni).sort().map((d) => ({ d, l: P.giorni[d].slot.filter((x) => x.libero) })).filter((x) => x.l.length).slice(0, 3);
    if (P.stato !== "ok" || !giorni.length) { box.hidden = true; return; }
    box.hidden = false;
    // per ogni giorno tre orari sparsi (il primo, uno a metà, l'ultimo): si vede subito che ci sono mattina e pomeriggio
    const tre = (l) => [...new Set([0, Math.floor((l.length - 1) / 2), l.length - 1])].map((i) => l[i]);
    $("#tg-corpo").innerHTML = giorni.map((g) => `<div class="tg-giorno"><span class="tg-gg">${esc(breve(g.d))}</span><div class="tg-ore">${tre(g.l).map((s) => `<button type="button" class="tg-slot" data-d="${g.d}" data-o="${s.ora}" aria-label="${esc(quando(g.d, s.ora))}">${s.ora}</button>`).join("")}</div></div>`).join("")
      + '<button type="button" class="btn btn-ink" id="tg-tutti">Vedi il calendario</button>';
  }

  /* ---------- modulo ---------- */
  function errore(msg, campo) {
    const e = $("#pr-err"); e.textContent = msg; e.hidden = !msg;
    document.querySelectorAll("#pr-form [aria-invalid]").forEach((x) => x.removeAttribute("aria-invalid"));
    if (campo) { const c = $("#pr-form").elements[campo]; if (c) { c.setAttribute("aria-invalid", "true"); c.focus(); } }
  }
  const CAMPO = { nome: "nome", telefono: "telefono", email: "email", consenso: "privacy", orario: null, auto: null };
  function riempiAuto() {
    const sel = $("#pr-auto");
    sel.innerHTML = '<option value="">Non ho ancora scelto</option>' + P.auto.map((a) => `<option value="${esc(a.id)}">${esc([TG.titolo(a), a.allestimento, a.anno].filter(Boolean).join(" · "))}</option>`).join("");
  }
  async function invia(ev) {
    ev.preventDefault();
    const f = $("#pr-form"), btn = $("#pr-invia");
    errore("");
    if (!P.giorno || !P.ora) return errore("Scegli giorno e ora dal calendario.");
    const a = P.auto.find((x) => x.id === f.auto_id.value);
    const corpo = { nome: f.nome.value, telefono: f.telefono.value, email: f.email.value, note: f.note.value, auto_id: a ? a.id : "", auto_testo: a ? [TG.titolo(a), a.allestimento].filter(Boolean).join(" ") : "",
      data: P.giorno, ora: P.ora, consenso_privacy: f.privacy.checked, consenso_marketing: f.marketing.checked, sito: f.sito.value };
    const val = V.valida(P.cfg, corpo, P.occ, P.adesso);
    if (!val.ok) { const k = Object.keys(val.errori)[0]; return errore(val.errori[k], CAMPO[k]); }
    btn.disabled = true; btn.textContent = "Invio in corso…";
    try {
      if (P.locale) {
        const iso = new Date().toISOString(), id = "w" + Date.now().toString(36) + casuale(4, CODICE).toLowerCase(), codice = casuale(8, CODICE);
        const doc = V.norm(Object.assign({}, val.valori, { id, durata: V.regole(P.cfg).durata, stato: "richiesta", origine: "vetrina", creato: iso, aggiornato: iso, demo: true,
          consenso: { privacy: true, marketing: corpo.consenso_marketing === true, versione: V.VERSIONE_PRIVACY, data: iso } }));
        const coda = leggi(CODA, []); coda.push(doc); scrivi(CODA, coda);
        conferma({ id, codice, data: doc.data, ora: doc.ora, durata: doc.durata, auto_testo: doc.auto_testo });
      } else {
        const res = await fetch("api/visite", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) });
        let j = {}; try { j = await res.json(); } catch (e) { /* risposta senza JSON */ }
        if (res.status === 201 || (res.ok && j.ok)) conferma({ id: j.id, codice: j.codice, data: j.data || corpo.data, ora: j.ora || corpo.ora, durata: j.durata, auto_testo: corpo.auto_testo });
        else if (res.status === 409) { await caricaOccupate(); ricalcola(); P.ora = ""; disegnaCal(); disegnaOre(); aggiornaScelta(); disegnaTagliando(); errore(j.messaggio || "Quell’orario è appena stato preso: scegline un altro."); }
        else if (res.status === 422 && j.errori) { const k = Object.keys(j.errori)[0]; errore(j.errori[k], CAMPO[k]); }
        else errore(j.messaggio || "Non siamo riusciti a registrare la richiesta. Riprova o chiamaci" + (P.cfg.contatti && P.cfg.contatti.telefono ? " al " + P.cfg.contatti.telefono : "") + ".");
      }
    } catch (e) { errore("Connessione assente: la richiesta non è partita. Riprova tra poco."); }
    finally { btn.disabled = false; btn.textContent = "Richiedi la visita"; }
  }

  /* ---------- conferma e annullamento ---------- */
  function conferma(m) {
    P.conferma = m; P.annullando = false;
    scrivi(MIA, { id: m.id, codice: m.codice, data: m.data, ora: m.ora, durata: m.durata, auto_testo: m.auto_testo || "" });
    caricaOccupate().then(() => { ricalcola(); disegnaCal(); disegnaOre(); disegnaTagliando(); });
    mostraConferma();
    $("#pr-form").reset(); P.ora = ""; aggiornaScelta();
  }
  function mostraConferma() {
    const m = P.conferma, g = P.cfg.contatti || {}, box = $("#pr-ok");
    $("#pr-grid").hidden = true; $("#mia").hidden = true; box.hidden = false;
    const ics = !P.cfg.demo;
    box.innerHTML = `<div class="tagliando"><div class="tg-testa"><h3 id="pr-ok-t" tabindex="-1" style="font-size:1.5rem;line-height:1.05">Richiesta inviata</h3><p>Ti confermiamo l’orario al numero o all’email che hai lasciato.</p></div>
      <div class="tg-corpo"><dl class="tg-dati"><dt>Quando</dt><dd>${esc(quando(m.data, m.ora))}</dd><dt>Dove</dt><dd>${esc([g.indirizzo, g.citta].filter(Boolean).join(", "))}</dd>${m.auto_testo ? `<dt>Auto</dt><dd>${esc(m.auto_testo)}</dd>` : ""}</dl>
      ${m.codice ? `<div class="tg-codice"><small>Il tuo codice. Serve per annullare la visita: conservalo.</small><b>${esc(m.codice)}</b></div>` : ""}
      ${P.annullando ? `<p><b>Vuoi annullare la visita?</b></p><div class="tg-azioni"><button type="button" class="btn btn-ink" id="ok-si">Sì, annulla</button><button type="button" class="btn btn-line" id="ok-no">No, la tengo</button></div>`
        : `<div class="tg-azioni">${ics ? '<button type="button" class="btn btn-line" id="ok-ics">Aggiungi al calendario</button>' : ""}${m.codice ? '<button type="button" class="btn btn-line" id="ok-ann">Annulla la visita</button>' : ""}<button type="button" class="btn btn-line" id="ok-altra">Prenota un’altra visita</button></div>`}
      <p class="pr-err" id="ok-err" role="alert" hidden></p>
      ${P.locale ? '<p class="tg-nota">Demo: la richiesta resta in questo browser. Aprila nell’agenda del gestionale (scheda «Visite»).</p>' : ""}</div></div>`;
    const t = $("#pr-ok-t"); if (t) t.focus({ preventScroll: false });
  }
  async function annulla() {
    const m = P.conferma, err = $("#ok-err");
    try {
      if (P.locale) {
        const coda = leggi(CODA, []), v = coda.find((x) => x.id === m.id);
        if (v) { v.stato = "annullata"; v.aggiornato = new Date().toISOString(); scrivi(CODA, coda); }
      } else {
        const res = await fetch("api/visite/annulla", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: m.id, codice: m.codice }) });
        if (!res.ok) { let j = {}; try { j = await res.json(); } catch (e) { /* */ } err.textContent = j.messaggio || "Non siamo riusciti ad annullare: chiamaci."; err.hidden = false; return; }
      }
    } catch (e) { err.textContent = "Connessione assente: riprova tra poco."; err.hidden = false; return; }
    scrivi(MIA, null); P.conferma = null; P.annullando = false;
    $("#pr-ok").hidden = true; $("#pr-grid").hidden = false;
    await caricaOccupate(); ricalcola(); disegnaCal(); disegnaOre(); disegnaTagliando();
    mostraMia();
    const e = $("#pr-err"); e.textContent = "Visita annullata. Se vuoi, scegli un altro orario."; e.hidden = false;
  }
  function mostraMia() {
    const box = $("#mia"), m = leggi(MIA, null);
    if (!m || !m.data || m.data < P.adesso.data) { if (m) scrivi(MIA, null); box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = `<p>Hai richiesto una visita per <b>${esc(quando(m.data, m.ora))}</b>.</p><button type="button" class="lnk" id="mia-vedi">Vedi il tagliando o annulla</button>`;
  }
  function scaricaIcs() {
    const m = P.conferma, g = P.cfg.contatti || {};
    const testo = V.ics({ id: m.id, data: m.data, ora: m.ora, durata: m.durata || V.regole(P.cfg).durata, auto_testo: m.auto_testo }, { nome: P.cfg.nome, indirizzo: g.indirizzo, citta: g.citta, telefono: g.telefono });
    const url = URL.createObjectURL(new Blob([testo], { type: "text/calendar" })), a = document.createElement("a");
    a.href = url; a.download = "visita-" + m.data + ".ics"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /* ---------- avvio ---------- */
  AP.Prenota = {
    async init(cfg, auto) {
      P.cfg = cfg; P.auto = auto || []; P.locale = cfg.demo === true;
      if (!$("#prenota")) return;
      if (cfg.moduli && cfg.moduli.visite === false) { document.querySelectorAll("[data-modulo=visite]").forEach((e) => (e.hidden = true)); return; }
      riempiAuto();
      await caricaOccupate();
      if (P.stato !== "ok") {
        $("#pr-grid").hidden = true; document.querySelectorAll("#tagliando").forEach((e) => (e.hidden = true));
        const tel = (cfg.contatti || {}).telefono;
        const c = $("#pr-chiuso"); c.hidden = false;
        c.innerHTML = `<p><b>La prenotazione online non è disponibile in questo momento.</b></p><p>${tel ? `Chiamaci al <b>${esc(tel)}</b> e fissiamo insieme un orario.` : "Scrivici per fissare un orario."}</p>`;
        return;
      }
      ricalcola();
      const prima = Object.keys(P.giorni).sort().find((d) => P.giorni[d].liberi > 0) || P.adesso.data;
      P.mese = meseDi(prima);
      disegnaCal(); disegnaOre(); aggiornaScelta(); disegnaTagliando(); mostraMia();
      if (P.locale) { const n = $(".pr-nota"); if (n) n.insertAdjacentHTML("afterend", '<p class="pr-nota"><b>Demo:</b> gli orari già presi sono d’esempio; la richiesta resta in questo browser e compare nell’agenda del gestionale.</p>'); }
      $("#pr-prec").onclick = () => { const [y, m] = P.mese.split("-").map(Number); P.mese = m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`; disegnaCal(); };
      $("#pr-succ").onclick = () => { const [y, m] = P.mese.split("-").map(Number); P.mese = m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`; disegnaCal(); };
      $("#pr-cal").addEventListener("click", (e) => { const b = e.target.closest(".cal-g"); if (b && !b.disabled) { P.giorno = b.dataset.d; P.ora = ""; disegnaCal(); disegnaOre(); aggiornaScelta(); } });
      $("#pr-ore").addEventListener("click", (e) => { const b = e.target.closest(".ora"); if (b && !b.disabled) { P.ora = b.dataset.o; disegnaOre(); aggiornaScelta(); errore(""); } });
      $("#tg-corpo").addEventListener("click", (e) => {
        const s = e.target.closest(".tg-slot"); if (s) return vai(s.dataset.d, s.dataset.o, true);
        if (e.target.closest("#tg-tutti")) { const s2 = $("#prenota"); s2.scrollIntoView({ behavior: "smooth", block: "start" }); }
      });
      $("#pr-form").addEventListener("submit", invia);
      $("#pr-ok").addEventListener("click", (e) => {
        const id = e.target.id;
        if (id === "ok-ann") { P.annullando = true; mostraConferma(); }
        else if (id === "ok-no") { P.annullando = false; mostraConferma(); }
        else if (id === "ok-si") annulla();
        else if (id === "ok-ics") scaricaIcs();
        else if (id === "ok-altra") { P.conferma = null; $("#pr-ok").hidden = true; $("#pr-grid").hidden = false; mostraMia(); errore(""); }
      });
      $("#mia").addEventListener("click", (e) => { if (e.target.id === "mia-vedi") { const m = leggi(MIA, null); if (m) { P.conferma = m; P.annullando = false; mostraConferma(); } } });
    },
    /* dalla scheda di un'auto: porta al calendario con quell'auto già scelta */
    scegliAuto(id) {
      if (!P.cfg || P.stato !== "ok") return false;
      const sel = $("#pr-auto"); if (sel) sel.value = P.auto.some((a) => a.id === id) ? id : "";
      const s = $("#prenota"); if (s) s.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      return true;
    },
    attiva: () => P.stato === "ok",
  };
})();
