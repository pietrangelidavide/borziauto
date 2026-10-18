/* AutoProfit · controlli prima della vendita.
   Quando inserisci una nuova auto si apre questa lista: per ogni voce segni «a posto», «da fare» (con costo) o «non c’è».
   I lavori da fare entrano nel calcolo del margine; se sono indispensabili (documenti, sicurezza) l’auto resta
   «in preparazione» e non compare sul sito finché non li segni come fatti. Tutto è riservato: non va mai sul sito. */
(function () {
  "use strict";
  const GT = (window.GT = window.GT || {});
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => TG.esc(s);
  let X = null;        // contesto: { S, salva, ridisegna, toast, apri, oggi, titolo, numero }

  /* [chiave, testo, indispensabile prima di vendere (1) o no (0)] */
  const GRUPPI = [
    ["Documenti", [
      ["pra", "Proprietà e PRA: nessun fermo, ipoteca o gravame", 1],
      ["revisione", "Revisione in regola", 1],
      ["km", "Chilometraggio verificato (tagliandi, storico)", 1],
      ["manuale", "Libretto uso e manutenzione, seconda chiave", 0],
      ["bollo", "Bollo pagato", 0],
    ]],
    ["Sicurezza e meccanica", [
      ["freni", "Freni: pastiglie e dischi", 1],
      ["gomme", "Pneumatici: usura e stagione", 1],
      ["perdite", "Nessuna perdita di olio o liquidi", 1],
      ["tagliando", "Tagliando: olio e filtri", 0],
      ["distribuzione", "Cinghia o catena di distribuzione", 0],
      ["frizione", "Frizione e cambio", 0],
      ["sospensioni", "Sospensioni e ammortizzatori", 0],
      ["batteria", "Batteria e impianto elettrico", 0],
    ]],
    ["Elettronica e interni", [
      ["spie", "Spie accese o errori (diagnosi OBD)", 1],
      ["clima", "Climatizzatore", 0],
      ["luci", "Fari e luci", 0],
      ["comandi", "Schermo, comandi, vetri e specchietti", 0],
      ["interni", "Sedili, volante e tappezzeria", 0],
    ]],
    ["Carrozzeria", [
      ["graffi", "Graffi e ammaccature", 0],
      ["cristalli", "Parabrezza e cristalli", 0],
      ["cerchi", "Cerchi", 0],
      ["vernice", "Vernice opacizzata o ruggine", 0],
    ]],
    ["Preparazione per la vendita", [
      ["pulizia", "Lavaggio e detailing interni ed esterni", 0],
      ["foto", "Foto e descrizione dell’annuncio", 0],
    ]],
  ];
  const STATI = [["ok", "A posto"], ["da_fare", "Da fare"], ["na", "Non c’è"]];
  const TEMPLATE = {};
  GRUPPI.forEach(([g, voci]) => voci.forEach(([k, t, b]) => (TEMPLATE[k] = { k, g, t, blocca: !!b })));

  const numero = (v) => { const n = X && X.numero ? X.numero(v) : parseFloat(v); return n == null || !isFinite(n) ? null : Math.max(0, Math.round(n)); };

  /* checklist salvata → forma pulita (o null) */
  function norm(c) {
    if (!c || typeof c !== "object" || !Array.isArray(c.voci)) return null;
    const voci = c.voci.filter((v) => v && typeof v.k === "string" && /^[a-z0-9_]{1,24}$/i.test(v.k) && ["ok", "da_fare", "fatto", "na"].includes(v.s)).map((v) => {
      const o = { k: v.k, s: v.s, costo: v.costo == null || v.costo === "" || !isFinite(+v.costo) ? null : Math.max(0, Math.round(+v.costo)), nota: String(v.nota || "").slice(0, 200), addebitato: Math.max(0, Math.round(+v.addebitato || 0)) };
      if (!TEMPLATE[v.k]) { o.t = String(v.t || "Altra voce").slice(0, 80); }
      return o;
    });
    return voci.length ? { data: String(c.data || ""), voci } : null;
  }

  /* numeri per l'elenco e per la stima */
  function riepilogo(a) {
    const c = norm(a && a.checklist), r = { fatta: !!c, controllate: 0, totale: Object.keys(TEMPLATE).length, daFare: 0, costo: 0, bloccanti: 0, fatti: 0 };
    if (!c) return r;
    c.voci.forEach((v) => {
      if (TEMPLATE[v.k] || v.t) r.controllate++;
      if (v.s === "da_fare") { r.daFare++; r.costo += v.costo || 0; if (TEMPLATE[v.k] && TEMPLATE[v.k].blocca) r.bloccanti++; }
      if (v.s === "fatto") r.fatti++;
    });
    return r;
  }

  /* ---------- finestra ---------- */
  let A = null, voci = [], opz = {}, nuova = false, stornare = 0;
  const vocePer = (k) => voci.find((v) => v.k === k);
  const testo = (v) => (TEMPLATE[v.k] ? TEMPLATE[v.k].t : v.t || "Altra voce");
  const blocca = (v) => !!(TEMPLATE[v.k] && TEMPLATE[v.k].blocca);

  function riga(v, gi) {
    const aperto = v.s === "da_fare" || v.s === "fatto";
    const st = STATI.map(([s, t]) => `<button type="button" data-s="${s}" aria-pressed="${v.s === s || (s === "da_fare" && v.s === "fatto")}">${t}</button>`).join("");
    return `<li class="ck-r ${v.s ? "s-" + v.s : ""}" data-k="${esc(v.k)}">
  <div class="ck-t"><span>${esc(testo(v))}</span>${blocca(v) ? '<small class="ck-b" title="Serve prima di mettere l’auto in vendita">indispensabile</small>' : ""}</div>
  <div class="ck-seg" role="group" aria-label="${esc(testo(v))}">${st}</div>
  ${aperto ? `<div class="ck-d">
    <label class="ck-eur">Costo €<input data-f="costo" inputmode="numeric" value="${v.costo == null ? "" : v.costo}" placeholder="0"></label>
    <label class="ck-nota">Nota<input data-f="nota" value="${esc(v.nota)}" placeholder="Cosa va fatto"></label>
    <label class="ck-fatto"><input type="checkbox" data-f="fatto" ${v.s === "fatto" ? "checked" : ""}> Lavoro fatto</label>
  </div>` : ""}
</li>`;
  }

  function disegnaLista() {
    const gruppi = GRUPPI.map(([g, tv]) => ({ g, voci: tv.map(([k]) => vocePer(k) || { k, s: "", costo: null, nota: "", addebitato: 0 }) }));
    const extra = voci.filter((v) => !TEMPLATE[v.k]);
    if (extra.length) gruppi.push({ g: "Altre voci", voci: extra });
    $("#k-lista").innerHTML = gruppi.map((G) => {
      const fatte = G.voci.filter((v) => v.s).length;
      return `<section class="ck-g"><h3>${esc(G.g)} <span>${fatte}/${G.voci.length}</span></h3><ul>${G.voci.map(riga).join("")}</ul></section>`;
    }).join("");
    riepiloga();
  }

  function stato() {
    const tot = Object.keys(TEMPLATE).length + voci.filter((v) => !TEMPLATE[v.k]).length;
    const fatte = voci.filter((v) => v.s).length;
    const daFare = voci.filter((v) => v.s === "da_fare");
    return { tot, fatte, daFare, costo: daFare.reduce((t, v) => t + (v.costo || 0), 0), bloccanti: daFare.filter(blocca).length };
  }
  function riepiloga() {
    const s = stato();
    $("#k-prog").textContent = `${s.fatte} su ${s.tot} controllate`;
    $("#k-sum").innerHTML = s.daFare.length
      ? `<b>${s.daFare.length}</b> ${s.daFare.length === 1 ? "lavoro" : "lavori"} da fare · costo stimato <b>${TG.euro(s.costo)}</b>${s.bloccanti ? ` · <span class="late">${s.bloccanti} ${s.bloccanti === 1 ? "indispensabile" : "indispensabili"} prima di vendere</span>` : ""}`
      : s.fatte ? "Nessun lavoro da fare." : "Segna le voci una per una, oppure «Segna tutto a posto» se l’auto è a posto.";
  }

  function apri(a, o) {
    A = a; opz = o || {}; nuova = !!opz.nuova; stornare = 0;
    const c = norm(a.checklist);
    voci = c ? c.voci.map((v) => ({ ...v })) : [];
    $("#k-titolo").textContent = nuova ? "Prima di mettere in vendita" : "Controlli prima della vendita";
    $("#k-auto").textContent = X.titolo(a) + (a.allestimento ? " · " + a.allestimento : "") + (a.anno ? " · " + a.anno : "");
    $("#k-salta").textContent = nuova ? "Salta per ora" : "Chiudi";
    const s = stato();
    const pronta = c ? a.preparazione !== true : s.bloccanti === 0;
    document.querySelector(`input[name="k-st"][value="${pronta ? "pronta" : "prep"}"]`).checked = true;
    disegnaLista();
    X.apri($("#d-check"));
  }

  function suggerisciStato() {
    const s = stato();
    document.querySelector(`input[name="k-st"][value="${s.bloccanti ? "prep" : "pronta"}"]`).checked = true;
  }

  function init(ctx) {
    X = ctx;
    const lista = $("#k-lista");
    lista.addEventListener("click", (e) => {
      const b = e.target.closest("[data-s]"); if (!b) return;
      const k = b.closest(".ck-r").dataset.k;
      let v = vocePer(k);
      if (!v) { v = { k, s: "", costo: null, nota: "", addebitato: 0 }; voci.push(v); }
      const nuovo = b.dataset.s;
      if (v.s === nuovo || (nuovo === "da_fare" && v.s === "fatto")) v.s = "";            // un secondo tocco toglie la scelta
      else v.s = nuovo;
      if (!v.s) { stornare += v.addebitato || 0; voci.splice(voci.indexOf(v), 1); }       // se aveva già addebitato un costo, lo si toglie al salvataggio
      suggerisciStato(); disegnaLista();
    });
    lista.addEventListener("input", (e) => {
      const f = e.target.dataset.f; if (!f) return;
      const v = vocePer(e.target.closest(".ck-r").dataset.k); if (!v) return;
      if (f === "costo") { v.costo = numero(e.target.value); riepiloga(); }
      if (f === "nota") v.nota = e.target.value.slice(0, 200);
    });
    lista.addEventListener("change", (e) => {
      if (e.target.dataset.f !== "fatto") return;
      const v = vocePer(e.target.closest(".ck-r").dataset.k); if (!v) return;
      v.s = e.target.checked ? "fatto" : "da_fare";
      suggerisciStato(); disegnaLista();
    });
    $("#k-tutto").onclick = () => {
      GRUPPI.forEach(([, tv]) => tv.forEach(([k]) => { if (!vocePer(k)) voci.push({ k, s: "ok", costo: null, nota: "", addebitato: 0 }); }));
      suggerisciStato(); disegnaLista();
    };
    const aggiungi = () => {
      const i = $("#k-nuova"), t = i.value.trim().slice(0, 80);
      if (!t) return;
      voci.push({ k: "x" + Date.now().toString(36).slice(-6) + voci.length, s: "da_fare", costo: null, nota: "", addebitato: 0, t });
      i.value = ""; suggerisciStato(); disegnaLista();
    };
    $("#k-add").onclick = aggiungi;
    $("#k-nuova").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); aggiungi(); } });

    $("#k-salva").onclick = () => {
      if (!A) return;
      // i costi dei lavori fatti passano nei «costi extra»: si somma solo la differenza rispetto a quanto già addebitato
      const prima = A.costi_extra;
      let extra = (+prima || 0) - stornare;
      const salvate = voci.filter((v) => v.s).map((v) => {
        const voglio = v.s === "fatto" ? v.costo || 0 : 0;
        extra += voglio - (v.addebitato || 0);
        return { ...v, addebitato: voglio };
      });
      A.costi_extra = prima == null && extra === 0 ? null : Math.max(0, Math.round(extra));
      A.checklist = norm({ data: X.oggi(), voci: salvate });
      A.preparazione = document.querySelector('input[name="k-st"]:checked').value === "prep";
      X.salva(); $("#d-check").close(); X.ridisegna();
      const r = riepilogo(A);
      X.toast(A.preparazione ? `Controlli salvati: l’auto resta in preparazione (${r.daFare} ${r.daFare === 1 ? "lavoro" : "lavori"}).` : "Controlli salvati: l’auto è pronta per la vendita.");
      if (opz.dopo) opz.dopo(A);
      A = null;
    };
  }

  GT.Check = { init, apri, riepilogo, norm, VOCI: TEMPLATE, GRUPPI };
})();
