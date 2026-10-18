/* AutoProfit · CRM della flotta: contatti e trattative collegati alle auto, cruscotto della flotta.
   Tutto resta in questo browser (come le auto): non finisce mai nel sito. */
(function () {
  "use strict";
  const GT = (window.GT = window.GT || {});
  const $ = (s, r) => (r || document).querySelector(s);
  let X = null;   // contesto passato dal gestionale: { S, salva, ridisegna, toast, apri, numero, dataIso, oggi, titolo, apriVenduta, vaiCrm }

  const STATI = [["nuovo", "Nuovo"], ["contattato", "Contattato"], ["appuntamento", "Appuntamento"], ["trattativa", "Trattativa"], ["venduto", "Venduto"], ["perso", "Perso"]];
  const APERTI = ["nuovo", "contattato", "appuntamento", "trattativa"];
  const FONTI = ["Telefono", "WhatsApp", "Instagram", "TikTok", "AutoScout24", "Sito", "Di persona", "Passaparola", "Altro"];
  const ATT = [["chiamata", "Chiamata"], ["whatsapp", "WhatsApp"], ["email", "Email"], ["visita", "Visita in sede"], ["prova", "Prova su strada"], ["offerta", "Offerta"], ["nota", "Nota"]];
  const nomeStato = (s) => (STATI.find((x) => x[0] === s) || [0, s])[1];
  const nomeAtt = (t) => (ATT.find((x) => x[0] === t) || [0, t === "stato" ? "Fase" : t])[1];
  const esc = (s) => TG.esc(s);
  const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  const fmtBreve = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ""); return m ? `${+m[3]} ${MESI[+m[2] - 1]}` : ""; };
  const fmtData = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ""); return m ? `${m[3]}/${m[2]}/${m[1]}` : ""; };
  const giorni = (a, b) => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 864e5);
  const aggiungiGiorni = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const adesso = () => new Date().toISOString().slice(0, 16);   // data e ora, per lo storico
  let seq = 0;
  const nuovoId = () => "c" + Date.now().toString(36) + (seq++).toString(36);

  /* ---------- flotta: numeri calcolati sulle auto ---------- */
  const Flotta = {
    giorniStock(a) { return a.stato === "disponibile" && a.data_acquisto ? Math.max(0, giorni(a.data_acquisto, X.oggi())) : null; },
    margine(a) { return a.prezzo != null && a.costo_acquisto != null ? a.prezzo - a.costo_acquisto - (a.costi_extra || 0) - (GT.Calc ? GT.Calc.lavoriDaFare(a) : 0) : null; },   // meno i lavori ancora da fare (controlli)
    margineVenduta(a) { return a.prezzo_vendita != null && a.costo_acquisto != null ? a.prezzo_vendita - a.costo_acquisto - (a.costi_extra || 0) : null; },
    revisione(a) { return a.stato === "disponibile" && a.scad_revisione ? giorni(X.oggi(), a.scad_revisione) : null; },   // giorni alla scadenza (negativo = scaduta)
  };

  /* ---------- contatti ---------- */
  const norm = (c) => ({
    id: String(c.id || "") || nuovoId(), nome: String(c.nome || "").trim(), telefono: String(c.telefono || "").trim(), email: String(c.email || "").trim(),
    fonte: String(c.fonte || "").trim(), auto_id: String(c.auto_id || ""), auto_testo: String(c.auto_testo || "").trim(),
    stato: STATI.some((s) => s[0] === c.stato) ? c.stato : "nuovo", budget: c.budget == null || c.budget === "" ? null : Math.round(+c.budget) || null,
    prossimo: String(c.prossimo || ""), note: String(c.note || "").trim(), creato: String(c.creato || "") || X.oggi(),
    attivita: Array.isArray(c.attivita) ? c.attivita.map((a) => ({ d: String(a.d || ""), t: String(a.t || "nota"), x: String(a.x || "") })) : [], demo: !!c.demo,
  });
  const apertoC = (c) => APERTI.includes(c.stato);
  const autoDi = (c) => (c.auto_id ? X.S.auto.find((a) => a.id === c.auto_id) : null);
  const descAuto = (c) => { const a = autoDi(c); return a ? [X.titolo(a), a.allestimento].filter(Boolean).join(" · ") : c.auto_testo || ""; };
  const ultima = (c) => (c.attivita.length ? c.attivita.slice().sort((x, y) => (y.d > x.d ? 1 : -1))[0] : null);
  const scadenza = (c) => (apertoC(c) && c.prossimo ? giorni(X.oggi(), c.prossimo) : null);   // <0 scaduto, 0 oggi

  const Crm = (GT.Crm = {
    STATI, FONTI, Flotta, norm, descAuto,
    init(ctx) {
      X = ctx;
      const sel = (el, opts) => (el.innerHTML = opts.map((o) => `<option value="${esc(o[0])}">${esc(o[1])}</option>`).join(""));
      sel($('#form-c [name="fonte"]'), [["", "—"]].concat(FONTI.map((f) => [f, f])));
      sel($('#form-c [name="stato"]'), STATI);
      sel($("#c-tipo"), ATT);
      $("#cv-pipe").onclick = () => { V.vista = "pipe"; this.disegna(); };
      $("#cv-list").onclick = () => { V.vista = "list"; this.disegna(); };
      $("#crm-auto").onchange = (e) => { V.auto = e.target.value; this.disegna(); };
      $("#crm-chiusi").onchange = (e) => { V.chiusi = e.target.checked; this.disegna(); };
      $("#board").addEventListener("click", (e) => {
        const nx = e.target.closest("[data-next]");
        if (nx) { e.stopPropagation(); const c = X.S.contatti.find((x) => x.id === nx.closest(".kc").dataset.id); if (c) muovi(c, nx.dataset.next); return; }
        const k = e.target.closest(".kc"); if (k) apriContatto(X.S.contatti.find((x) => x.id === k.dataset.id));
      });
      $("#board").addEventListener("keydown", (e) => { const k = e.target.closest && e.target.closest(".kc"); if (k && (e.key === "Enter" || e.key === " ") && e.target === k) { e.preventDefault(); apriContatto(X.S.contatti.find((x) => x.id === k.dataset.id)); } });
      $("#board").addEventListener("dragstart", (e) => { const k = e.target.closest(".kc"); if (!k) return; e.dataTransfer.setData("text/plain", k.dataset.id); e.dataTransfer.effectAllowed = "move"; k.classList.add("drag"); });
      $("#board").addEventListener("dragend", () => document.querySelectorAll(".kc.drag,.kcol.over").forEach((n) => n.classList.remove("drag", "over")));
      $("#board").addEventListener("dragover", (e) => { const col = e.target.closest(".kcol"); if (col) { e.preventDefault(); document.querySelectorAll(".kcol.over").forEach((n) => n !== col && n.classList.remove("over")); col.classList.add("over"); } });
      $("#board").addEventListener("drop", (e) => {
        const col = e.target.closest(".kcol"); if (!col) return; e.preventDefault(); col.classList.remove("over");
        const c = X.S.contatti.find((x) => x.id === e.dataTransfer.getData("text/plain")); if (c && c.stato !== col.dataset.s) muovi(c, col.dataset.s);
      });
      $("#crm-tab").addEventListener("click", (e) => {
        const s = e.target.closest("[data-sort]"); if (s) { V.sort.d = V.sort.k === s.dataset.sort ? -V.sort.d : 1; V.sort.k = s.dataset.sort; return this.disegna(); }
        const r = e.target.closest("tr[data-id]"); if (r) apriContatto(X.S.contatti.find((x) => x.id === r.dataset.id));
      });
      $("#crm-scad-del").onclick = () => {
        const sc = Crm.scaduti(); if (!sc.length) return;
        if (!confirm(`Eliminare ${sc.length} ${sc.length === 1 ? "contatto" : "contatti"} senza attività da più di ${Crm.mesiConservazione()} mesi? Non si può annullare: fai prima un backup se vuoi tenerne una copia.`)) return;
        const id = new Set(sc.map((c) => c.id)); X.S.contatti = X.S.contatti.filter((c) => !id.has(c.id)); X.salva(); X.ridisegna(); X.toast(sc.length === 1 ? "Contatto eliminato." : `${sc.length} contatti eliminati.`);
      };
      initDialogo();
    },
    nuovo: () => apriContatto(null),
    /* contatti aperti collegati a una certa auto */
    interessati: (autoId) => X.S.contatti.filter((c) => c.auto_id === autoId && apertoC(c)).length,
    aperti: () => X.S.contatti.filter(apertoC),
    filtraAuto(id) { V.auto = id || ""; V.vista = "list"; },

    /* privacy: contatti senza alcuna attività da più dei mesi scritti nell'informativa (garage.json → privacy.conservazione.contatti_mesi) */
    mesiConservazione: () => +((((window.AP && AP.Config.cfg.privacy) || {}).conservazione || {}).contatti_mesi) || 24,
    scaduti() {
      const lim = aggiungiGiorni(X.oggi(), -Math.round(Crm.mesiConservazione() * 30.4));
      return X.S.contatti.filter((c) => { const ds = [c.creato, c.prossimo].concat(c.attivita.map((a) => a.d)).filter(Boolean).map((d) => String(d).slice(0, 10)).sort(); return ds.length && ds[ds.length - 1] < lim; });
    },

    /* cruscotto: 5 numeri in alto */
    kpi() {
      const S = X.S, disp = S.auto.filter((a) => a.stato === "disponibile");
      const valore = disp.reduce((s, a) => s + (a.prezzo || 0), 0);
      const gg = disp.map(Flotta.giorniStock).filter((x) => x != null), medi = gg.length ? Math.round(gg.reduce((a, b) => a + b, 0) / gg.length) : null;
      const lunghe = gg.filter((x) => x > 60).length;
      const marg = disp.map(Flotta.margine).filter((x) => x != null), margTot = marg.reduce((a, b) => a + b, 0);
      const ap = S.contatti.filter(apertoC), da = ap.filter((c) => scadenza(c) != null && scadenza(c) <= 0).length;
      const rev = disp.filter((a) => { const r = Flotta.revisione(a); return r != null && r <= 30; }).length;
      const t = (lbl, val, sub, cls) => `<div class="kpi ${cls || ""}"><span class="kpi-l">${lbl}</span><b class="kpi-v">${val}</b><small>${sub}</small></div>`;
      return t("In vetrina", disp.length, valore ? "valore " + TG.euro(valore) : "nessuna auto")
        + t("Giorni medi in stock", medi == null ? "–" : medi, medi == null ? "indica la data di acquisto" : lunghe ? `${lunghe} oltre 60 giorni` : "nessuna ferma da molto", lunghe ? "warn" : "")
        + t("Margine potenziale", marg.length ? TG.euroHtml(margTot) : "–", marg.length ? `su ${marg.length} auto con costo` : "indica il costo di acquisto")
        + t("Trattative aperte", ap.length, rev ? `${rev} revision${rev === 1 ? "e" : "i"} in scadenza` : "revisioni in regola", rev ? "" : "")
        + t("Da ricontattare", da, da ? "oggi o in ritardo" : "nessun ritardo", da ? "warn" : "");
    },

    /* ---------- disegno della vista ---------- */
    disegna() {
      const S = X.S;
      const q = TG.norm(X.q ? X.q() : "");
      const lista = S.contatti.filter((c) => {
        if (V.auto === "_nessuna" ? c.auto_id : V.auto && c.auto_id !== V.auto) return false;
        if (!V.chiusi && V.vista === "list" && !apertoC(c)) return false;
        return !q || TG.norm([c.nome, c.telefono, c.email, c.fonte, descAuto(c), c.note].join(" ")).includes(q);
      });
      // promemoria privacy
      const sc = Crm.scaduti(), bn = $("#crm-scad");
      bn.hidden = !sc.length;
      if (sc.length) $("#crm-scad-t").textContent = `${sc.length} ${sc.length === 1 ? "contatto non ha" : "contatti non hanno"} attività da più di ${Crm.mesiConservazione()} mesi: è il limite scritto nell’informativa sulla privacy.`;
      // filtro per auto
      const sa = $("#crm-auto");
      const scelte = [["", "Tutte le auto"], ["_nessuna", "Senza auto precisa"]].concat(S.auto.filter((a) => a.stato === "disponibile" || S.contatti.some((c) => c.auto_id === a.id)).map((a) => [a.id, X.titolo(a) + (a.allestimento ? " · " + a.allestimento : "") + (a.stato === "venduta" ? " (venduta)" : "")]));
      sa.innerHTML = scelte.map((o) => `<option value="${esc(o[0])}">${esc(o[1])}</option>`).join(""); sa.value = scelte.some((o) => o[0] === V.auto) ? V.auto : "";
      $("#cv-pipe").setAttribute("aria-pressed", String(V.vista === "pipe")); $("#cv-list").setAttribute("aria-pressed", String(V.vista === "list"));
      $("#crm-chiusi").closest("label").hidden = V.vista !== "list";
      $("#board").hidden = V.vista !== "pipe"; $("#crm-list").hidden = V.vista !== "list";
      const vuoto = $("#crm-vuoto"); vuoto.hidden = lista.length > 0;
      if (!lista.length) vuoto.textContent = S.contatti.length ? "Nessun contatto corrisponde ai filtri." : "Ancora nessun contatto. Aggiungi chi ti ha chiamato o scritto: così non ti scordi di richiamarlo e sai chi è interessato a quale auto.";
      if (V.vista === "pipe") {
        const ord = (a, b) => (a.prossimo || "9999") > (b.prossimo || "9999") ? 1 : -1;
        $("#board").innerHTML = STATI.map(([s, n]) => {
          const l = lista.filter((c) => c.stato === s).sort(ord);
          const tot = l.reduce((x, c) => x + (c.budget || 0), 0);
          return `<section class="kcol s-${s}" data-s="${s}" aria-label="${n}"><h3>${n}<span>${l.length}</span></h3>${tot ? `<small class="kcol-t">budget ${TG.euro(tot)}</small>` : ""}<div class="kcol-b">${l.map(cardC).join("") || '<p class="kcol-v">—</p>'}</div></section>`;
        }).join("");
      } else {
        const cols = [["nome", "Nome"], ["telefono", "Telefono"], ["auto", "Auto"], ["stato", "Fase"], ["prossimo", "Ricontattare"], ["budget", "Budget", 1], ["fonte", "Fonte"], ["ultima", "Ultima attività"]];
        const val = (c, k) => k === "auto" ? TG.norm(descAuto(c)) : k === "ultima" ? (ultima(c) || {}).d || "" : k === "stato" ? STATI.findIndex((s) => s[0] === c.stato) : k === "nome" ? TG.norm(c.nome) : c[k];
        const so = V.sort;
        const l = lista.slice().sort((a, b) => { const va = val(a, so.k), vb = val(b, so.k), na = va == null || va === "", nb = vb == null || vb === ""; if (na !== nb) return na ? 1 : -1; return (va > vb ? 1 : va < vb ? -1 : 0) * so.d; });
        $("#crm-tab").innerHTML = "<thead><tr>" + cols.map((c) => `<th class="${c[2] ? "num" : ""}"><button type="button" data-sort="${c[0]}">${c[1]}<span class="ar">${so.k === c[0] ? (so.d > 0 ? "▲" : "▼") : ""}</span></button></th>`).join("") + "</tr></thead><tbody>"
          + l.map((c) => { const u = ultima(c), sc = scadenza(c); return `<tr data-id="${esc(c.id)}" tabindex="0"><td class="auto"><b>${esc(c.nome)}${c.demo ? '<span class="tag">Esempio</span>' : ""}</b></td><td>${esc(c.telefono)}</td><td>${esc(descAuto(c))}</td><td><span class="st s-${c.stato}">${nomeStato(c.stato)}</span></td><td class="${sc != null && sc < 0 ? "late" : sc === 0 ? "today" : ""}">${esc(fmtData(c.prossimo))}</td><td class="num">${c.budget != null ? TG.euro(c.budget) : ""}</td><td>${esc(c.fonte)}</td><td>${u ? esc(fmtBreve(u.d) + " · " + nomeAtt(u.t)) : ""}</td></tr>`; }).join("") + "</tbody>";
      }
    },

    /* ---------- dati di esempio ---------- */
    demo(auto) {
      const oggi = X.oggi(), d = auto.filter((a) => a.stato === "disponibile" && a.demo);
      if (d.length < 4) return [];
      const car = (i) => d[i % d.length].id;
      const mk = (nome, tel, fonte, ai, stato, budget, pr, note, att) => ({ id: nuovoId(), nome, telefono: tel, email: "", fonte, auto_id: ai ? car(ai - 1) : "", auto_testo: ai ? "" : "SUV diesel, usato recente", stato, budget, prossimo: pr == null ? "" : aggiungiGiorni(oggi, pr), note, creato: aggiungiGiorni(oggi, -(att[0] ? att[0][0] : 3)), demo: true,
        attivita: att.map((a) => ({ d: aggiungiGiorni(oggi, -a[0]) + "T1" + (a[0] % 9) + ":30", t: a[1], x: a[2] })) });
      return [
        mk("Mario Rossi", "333 000 0001", "WhatsApp", 1, "nuovo", 18000, 0, "Chiede se è trattabile.", [[0, "whatsapp", "Messaggio ricevuto: chiede il prezzo e se si può vedere."]]),
        mk("Giulia Bianchi", "333 000 0002", "AutoScout24", 2, "contattato", 16000, -2, "", [[4, "chiamata", "Prima chiamata: interessata, richiamare dopo il lavoro."], [2, "whatsapp", "Inviate altre foto."]]),
        mk("Luca Ferrari", "333 000 0003", "TikTok", 3, "appuntamento", 26000, 1, "Viene sabato con la moglie.", [[3, "chiamata", "Fissato appuntamento per sabato mattina."]]),
        mk("Sara Esposito", "333 000 0004", "Di persona", 4, "trattativa", 24000, 3, "Ha un’auto da dare in permuta.", [[6, "visita", "In sede, ha visto l’auto."], [4, "prova", "Prova su strada fatta."], [1, "offerta", "Proposta 24.000 € con permuta."]]),
        mk("Paolo Conti", "333 000 0005", "Passaparola", 0, "contattato", 25000, 5, "Cerca un SUV diesel.", [[5, "chiamata", "Cerca SUV diesel, massimo 25.000 €."]]),
        mk("Elena Russo", "333 000 0006", "Sito", 5, "venduto", 15000, null, "", [[9, "chiamata", "Contatto dal sito."], [2, "offerta", "Accettata l’offerta."]]),
        mk("Davide Greco", "333 000 0007", "Instagram", 2, "perso", 20000, null, "Ha scelto un’altra concessionaria.", [[12, "whatsapp", "Chiede informazioni."], [8, "nota", "Ha comprato altrove."]]),
      ];
    },
  });

  /* ---------- stato della vista ---------- */
  const V = { vista: "pipe", auto: "", chiusi: false, sort: { k: "prossimo", d: 1 } };

  function cardC(c) {
    const sc = scadenza(c), a = autoDi(c);
    const prox = c.prossimo && apertoC(c) ? `<span class="fu ${sc < 0 ? "late" : sc === 0 ? "today" : ""}">${sc < 0 ? "In ritardo" : sc === 0 ? "Oggi" : "Il " + fmtBreve(c.prossimo)}</span>` : "";
    const idx = STATI.findIndex((s) => s[0] === c.stato), nx = APERTI.includes(c.stato) && idx < 3 ? STATI[idx + 1][0] : c.stato === "trattativa" ? "venduto" : "";
    return `<article class="kc" draggable="true" tabindex="0" data-id="${esc(c.id)}" aria-label="${esc(c.nome)}, ${nomeStato(c.stato)}">
  <b>${esc(c.nome)}${c.demo ? '<span class="tag">Esempio</span>' : ""}</b>
  <small class="kc-a">${esc(descAuto(c)) || "Nessuna auto precisa"}${a && a.prezzo != null ? " · " + TG.euro(a.prezzo) : ""}</small>
  <span class="kc-m">${prox}${c.fonte ? `<span class="tag">${esc(c.fonte)}</span>` : ""}${c.budget != null ? `<span class="kc-b">${TG.euro(c.budget)}</span>` : ""}</span>
  ${nx ? `<button type="button" class="kc-next" data-next="${nx}" title="Sposta in «${nomeStato(nx)}»" aria-label="Sposta in ${nomeStato(nx)}">${nomeStato(nx)} ›</button>` : ""}
</article>`;
  }

  /* cambio di fase */
  function muovi(c, stato) {
    if (c.stato === stato) return;
    c.stato = stato;
    c.attivita.push({ d: adesso(), t: "stato", x: `Fase: ${nomeStato(stato)}` });
    if (!apertoC(c)) c.prossimo = "";
    X.salva(); X.ridisegna();
    chiediVendita(c);
  }
  function chiediVendita(c) {
    const a = autoDi(c);
    if (c.stato === "venduto" && a && a.stato === "disponibile" && confirm(`Segnare come venduta anche «${X.titolo(a)}»?`)) X.apriVenduta(a);
  }

  /* ---------- finestra del contatto ---------- */
  let CUR = null, nuovoC = false;
  const F = () => $("#form-c");
  function riempiAuto(selId) {
    const S = X.S, el = F().auto_id;
    const l = S.auto.filter((a) => a.stato === "disponibile" || a.id === selId);
    el.innerHTML = '<option value="">— nessuna in particolare —</option>' + l.map((a) => `<option value="${esc(a.id)}">${esc(X.titolo(a) + (a.allestimento ? " · " + a.allestimento : "") + (a.prezzo != null ? " · " + TG.euro(a.prezzo) : "") + (a.stato === "venduta" ? " (venduta)" : ""))}</option>`).join("");
    el.value = selId || "";
  }
  function disegnaAtt() {
    const l = CUR.attivita.slice().sort((a, b) => (b.d > a.d ? 1 : -1));
    $("#c-att").innerHTML = l.length ? l.map((a) => `<li><span class="att-d">${esc(fmtBreve(a.d))}${a.d.length > 10 ? " " + esc(a.d.slice(11, 16)) : ""}</span><span class="att-t">${esc(nomeAtt(a.t))}</span><span class="att-x">${esc(a.x)}</span></li>`).join("") : '<li class="att-vuoto">Ancora niente: scrivi qui chiamate, messaggi, visite e offerte.</li>';
  }
  function aggiornaLink() {
    const f = F(), tel = String(f.telefono.value).replace(/[^\d+]/g, "");
    const wa = tel.replace(/^\+/, "").replace(/^00/, ""), waN = /^3\d{8,9}$/.test(wa) ? "39" + wa : wa;
    $("#c-tel").hidden = !tel; $("#c-wa").hidden = !tel; $("#c-mail").hidden = !f.email.value.trim();
    $("#c-tel").href = "tel:" + tel; $("#c-wa").href = "https://wa.me/" + waN; $("#c-mail").href = "mailto:" + f.email.value.trim();
  }
  function apriContatto(c) {
    nuovoC = !c;
    CUR = JSON.parse(JSON.stringify(c || norm({ stato: "nuovo", creato: X.oggi() })));
    const f = F(); f.reset();
    $("#c-titolo").textContent = nuovoC ? "Nuovo contatto" : CUR.nome;
    $("#c-err").hidden = true; $("#c-del").hidden = nuovoC;
    riempiAuto(CUR.auto_id);
    ["nome", "telefono", "email", "fonte", "auto_testo", "stato", "prossimo", "note"].forEach((k) => (f[k].value = CUR[k] || ""));
    if (CUR.fonte && !FONTI.includes(CUR.fonte)) f.fonte.add(new Option(CUR.fonte, CUR.fonte)), (f.fonte.value = CUR.fonte);
    f.budget.value = CUR.budget != null ? CUR.budget : "";
    $("#c-att-x").value = ""; disegnaAtt(); aggiornaLink();
    X.apri($("#d-contatto"));
  }
  function initDialogo() {
    const f = F();
    f.telefono.addEventListener("input", aggiornaLink); f.email.addEventListener("input", aggiornaLink);
    document.querySelectorAll("[data-fu]").forEach((b) => (b.onclick = () => { f.prossimo.value = b.dataset.fu === "0" ? "" : aggiungiGiorni(X.oggi(), +b.dataset.fu); }));
    $("#c-att-add").onclick = () => {
      const x = $("#c-att-x").value.trim(); if (!x) return $("#c-att-x").focus();
      CUR.attivita.push({ d: adesso(), t: $("#c-tipo").value, x }); $("#c-att-x").value = ""; disegnaAtt();
    };
    $("#c-att-x").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $("#c-att-add").click(); } });
    $("#c-del").onclick = () => { if (confirm(`Eliminare il contatto «${CUR.nome}»?`)) { X.S.contatti = X.S.contatti.filter((c) => c.id !== CUR.id); X.salva(); $("#d-contatto").close(); X.ridisegna(); X.toast("Contatto eliminato."); } };
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      const err = (m) => { const p = $("#c-err"); p.textContent = m; p.hidden = false; };
      if (!f.nome.value.trim()) return err("Scrivi almeno il nome.");
      const b = f.budget.value.trim(), bn = b ? X.numero(b) : null;
      if (b && bn == null) return err("Il budget deve essere un numero.");
      const prima = nuovoC ? null : X.S.contatti.find((c) => c.id === CUR.id);
      const fase0 = prima ? prima.stato : null;
      Object.assign(CUR, { nome: f.nome.value.trim(), telefono: f.telefono.value.trim(), email: f.email.value.trim(), fonte: f.fonte.value, auto_id: f.auto_id.value, auto_testo: f.auto_testo.value.trim(), stato: f.stato.value, budget: bn == null ? null : Math.round(bn), prossimo: f.prossimo.value, note: f.note.value.trim() });
      if (fase0 && fase0 !== CUR.stato) CUR.attivita.push({ d: adesso(), t: "stato", x: `Fase: ${nomeStato(CUR.stato)}` });
      if (!apertoC(CUR)) CUR.prossimo = "";
      const rec = norm(CUR);
      if (prima) X.S.contatti[X.S.contatti.indexOf(prima)] = rec; else X.S.contatti.push(rec);
      X.salva(); $("#d-contatto").close(); X.ridisegna(); X.toast(prima ? "Contatto aggiornato." : "Contatto aggiunto.");
      if (rec.stato === "venduto" && fase0 !== "venduto") chiediVendita(rec);
    });
  }

  /* ---------- file CSV / Excel dei contatti ---------- */
  Crm.COLS = [
    { k: "id", t: "ID", w: 14 }, { k: "nome", t: "Nome", w: 24 }, { k: "telefono", t: "Telefono", w: 16 }, { k: "email", t: "Email", w: 26 }, { k: "fonte", t: "Fonte", w: 14 },
    { k: "stato", t: "Fase", w: 14 }, { k: "auto_id", t: "Auto ID", w: 14 }, { k: "auto_desc", t: "Auto", w: 30 }, { k: "auto_testo", t: "Cosa cerca", w: 28 },
    { k: "budget", t: "Budget", type: "money", w: 12 }, { k: "prossimo", t: "Ricontattare il", type: "date", w: 16 }, { k: "creato", t: "Creato il", type: "date", w: 13 },
    { k: "note", t: "Note", w: 34 }, { k: "storico", t: "Storico", w: 60 },
  ].map((c) => Object.assign({ type: "text" }, c));
  Crm.riga = (c) => Crm.COLS.map((col) => col.k === "stato" ? nomeStato(c.stato) : col.k === "auto_desc" ? descAuto(c) : col.k === "creato" ? c.creato.slice(0, 10) : col.k === "storico" ? c.attivita.slice().sort((a, b) => (a.d > b.d ? 1 : -1)).map((a) => `${a.d.slice(0, 10)} ${a.t}: ${a.x}`).join("\n") : c[col.k] == null ? "" : c[col.k]);
  Crm.foglio = (lista) => ({ name: "Contatti", cols: Crm.COLS.map((c) => ({ title: c.t, type: c.type, width: c.w })), rows: lista.map(Crm.riga) });

  const A = {};
  const al = (k, ...n) => n.forEach((x) => (A[x] = k));
  al("id", "id", "codice"); al("nome", "nome", "cliente", "contatto", "nominativo", "name", "nome_e_cognome", "nome_cognome", "cognome_nome"); al("telefono", "telefono", "tel", "cellulare", "cell", "mobile", "phone", "numero");
  al("email", "email", "e_mail", "mail", "posta"); al("fonte", "fonte", "provenienza", "canale", "origine", "source", "come_ci_ha_trovato"); al("stato", "fase", "stato", "status", "stadio");
  al("auto_id", "auto_id", "id_auto", "codice_auto"); al("auto_desc", "auto", "auto_di_interesse", "interesse", "veicolo", "modello_di_interesse"); al("auto_testo", "cosa_cerca", "cerca", "richiesta", "ricerca");
  al("budget", "budget", "importo", "cifra", "offerta"); al("prossimo", "ricontattare_il", "prossimo_contatto", "follow_up", "followup", "prossimo", "richiamare_il", "ricontatto");
  al("note", "note", "annotazioni", "commenti"); al("creato", "creato_il", "creato", "data_creazione", "inserito_il", "data"); al("storico", "storico", "attivita", "cronologia", "log");
  const hn = (h) => TG.norm(h).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const faseDa = (v) => { const n = TG.norm(v); if (!n) return "nuovo"; if (/vend|acquist|chius.*ok|firmat/.test(n)) return "venduto"; if (/pers|annull|non inter|chius/.test(n)) return "perso"; if (/trattativ|offert|negozi|preventiv/.test(n)) return "trattativa"; if (/appunt|visita|prova/.test(n)) return "appuntamento"; if (/contattat|chiamat|rispost|richiam/.test(n)) return "contattato"; return "nuovo"; };
  const fonteDa = (v) => { const n = TG.norm(v); if (!n) return ""; return FONTI.find((f) => n.includes(TG.norm(f))) || (/telef|chiam/.test(n) ? "Telefono" : /whats|wa$/.test(n) ? "WhatsApp" : /insta|ig$/.test(n) ? "Instagram" : String(v).trim()); };

  /* il foglio è dei contatti? restituisce {hi, map} oppure null */
  Crm.riconosci = function (sh, nFogli) {
    const rows = sh.rows, hi = rows.slice(0, 12).findIndex((r) => r.filter((c) => A[hn(c)]).length >= 2);
    if (hi < 0) return null;
    const map = rows[hi].map((c) => A[hn(c)] || null);
    const perNome = /contatt|client|crm|lead|trattativ/i.test(sh.name);
    const haAuto = rows[hi].some((c) => ["marca", "modello", "km", "alimentazione", "carrozzeria", "targa"].includes(hn(c)));
    if (!map.includes("nome")) return null;
    if (!perNome && (haAuto || !(map.includes("telefono") || map.includes("email")))) return null;
    return { hi, map };
  };
  Crm.analizza = function (sh, ris, out) {
    const rows = sh.rows, { hi, map } = ris;
    rows[hi].forEach((c, i) => { const t = String(c).trim(); if (t) (map[i] ? out.riconosciute : out.ignorate).add(t); });
    for (let i = hi + 1; i < rows.length; i++) {
      const r = rows[i] || [];
      if (r.every((c) => String(c == null ? "" : c).trim() === "")) continue;
      const raw = {}; map.forEach((k, ci) => { if (k && r[ci] != null && String(r[ci]).trim() !== "") raw[k] = r[ci]; });
      const dove = `${sh.name}, riga ${i + 1}`;
      if (!String(raw.nome || "").trim()) { out.problemi.push({ e: 1, m: `${dove}: manca il nome, riga saltata.` }); continue; }
      const c = { id: String(raw.id || "").trim(), nome: String(raw.nome).trim(), telefono: String(raw.telefono || "").trim(), email: String(raw.email || "").trim(), fonte: fonteDa(raw.fonte), stato: faseDa(raw.stato), auto_id: String(raw.auto_id || "").trim(), auto_testo: String(raw.auto_testo || "").trim(), note: String(raw.note || "").trim(), attivita: [] };
      if (raw.budget != null) { const b = X.numero(raw.budget); if (b == null) out.problemi.push({ m: `${dove}: «${raw.budget}» non è un numero valido per il budget.` }); else c.budget = Math.round(b); }
      if (raw.prossimo != null) { const d = X.dataIso(raw.prossimo); if (d == null) out.problemi.push({ m: `${dove}: data «${raw.prossimo}» non riconosciuta (usa 15/10/2026).` }); else c.prossimo = d; }
      if (raw.creato != null) { const d = X.dataIso(raw.creato); if (d) c.creato = d; }
      // auto: l'ID se esiste, altrimenti cerco per nome tra le auto della flotta
      if (c.auto_id && !X.S.auto.some((a) => a.id === c.auto_id)) c.auto_id = "";
      if (!c.auto_id && raw.auto_desc) {
        const n = TG.norm(raw.auto_desc), a = X.S.auto.find((x) => n.includes(TG.norm(X.titolo(x))) && (!x.allestimento || true));
        if (a) c.auto_id = a.id; else if (!c.auto_testo) c.auto_testo = String(raw.auto_desc).trim();
      }
      if (raw.storico) String(raw.storico).split(/\r?\n/).forEach((riga) => {
        const m = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?\s+([a-zà-ù]+)\s*:\s*(.*)$/i.exec(riga.trim());
        if (m) c.attivita.push({ d: m[1] + (m[2] ? "T" + m[2] : ""), t: ATT.some((a) => a[0] === m[3].toLowerCase()) || m[3].toLowerCase() === "stato" ? m[3].toLowerCase() : "nota", x: m[4] });
        else if (riga.trim()) c.attivita.push({ d: X.oggi(), t: "nota", x: riga.trim() });
      });
      out.contatti.push(c);
    }
  };
  const tel9 = (t) => String(t || "").replace(/\D/g, "").slice(-9);
  Crm.trova = function (c, lista) {
    if (c.id) { const x = lista.find((y) => y.id === c.id); if (x) return x; }
    if (tel9(c.telefono).length >= 7) { const x = lista.find((y) => tel9(y.telefono) === tel9(c.telefono)); if (x) return x; }
    if (c.email) { const x = lista.find((y) => y.email && TG.norm(y.email) === TG.norm(c.email)); if (x) return x; }
    return lista.find((y) => TG.norm(y.nome) === TG.norm(c.nome) && !tel9(c.telefono) && !tel9(y.telefono));
  };
  Crm.unisciImport = function (lista, S) {
    let nuovi = 0, agg = 0;
    lista.forEach((c) => {
      const ex = Crm.trova(c, S.contatti);
      if (ex) {
        agg++;
        ["nome", "telefono", "email", "fonte", "stato", "auto_id", "auto_testo", "budget", "prossimo", "note", "creato"].forEach((k) => { if (c[k] !== "" && c[k] != null && !(k === "stato" && c.stato === "nuovo" && ex.stato !== "nuovo")) ex[k] = c[k]; });
        c.attivita.forEach((a) => { if (!ex.attivita.some((y) => y.d === a.d && y.x === a.x)) ex.attivita.push(a); });
        ex.demo = false;
      } else { nuovi++; S.contatti.push(norm(Object.assign({}, c, { demo: false }))); }
    });
    return { nuovi, agg };
  };
  Crm.vistaFiltro = V;
})();
