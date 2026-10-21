/* Borzi Auto · stima del prezzo di vendita.
   Parte dagli annunci di mercato che incolli o importi (AutoScout24 non permette di leggere i prezzi in automatico),
   li filtra per anno, corregge per i chilometri e propone un prezzo per tre approcci: vendere in fretta, equilibrato, margine massimo.
   Accanto mostra i costi dell'auto e il guadagno ipotetico. È una stima, non una valutazione ufficiale. */
(function () {
  "use strict";
  const GT = (window.GT = window.GT || {});
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => TG.esc(s);
  const Calc = () => GT.Calc;
  let X = null;          // contesto: { S, salva, toast, apri, oggi, titolo, numero, ridisegna }
  let ST = null;         // { id, onUsa, comps[], esclusi:Set, q }

  const LSK = "borziauto.mercato.v1";
  const salvati = () => { try { return JSON.parse(localStorage.getItem(LSK)) || {}; } catch (e) { return {}; } };
  const scrivi = (o) => {
    try {
      const k = Object.keys(o);
      if (k.length > 30) k.sort((a, b) => ((o[a].data || "") < (o[b].data || "") ? -1 : 1)).slice(0, k.length - 30).forEach((x) => delete o[x]);
      localStorage.setItem(LSK, JSON.stringify(o));
    } catch (e) { /* senza memoria locale gli annunci restano solo finché la finestra è aperta */ }
  };
  const chiave = (m, mo) => Calc().norm(m) + "|" + Calc().norm(mo);
  const eur = (n) => (n == null || !isFinite(n) ? "–" : (n < 0 ? "−" : "") + TG.euro(Math.round(Math.abs(n))).replace(" ", "\u00a0"));
  const eurH = (n) => (n == null || !isFinite(n) ? "–" : (n < 0 ? "−" : "") + TG.euroHtml(Math.round(Math.abs(n))));
  const pct = (x, d = 0) => (x == null || !isFinite(x) ? "–" : (x * 100).toFixed(d).replace(".", ",") + "%");
  const num = (v) => { const n = X.numero(v); return n == null || !isFinite(n) ? null : n; };

  const leggiAuto = () => ({
    marca: $("#s-marca").value.trim(), modello: $("#s-modello").value.trim(), anno: num($("#s-anno").value), km: num($("#s-km").value),
    acquisto: num($("#s-acq").value), extra: num($("#s-extra").value),
  });

  /* ---------- storia dell'azienda (per tempi di vendita e vendite simili) ---------- */
  const storia = () => Calc().storia(X.S.auto, X.S.storico);
  function simili(a) {
    const k = chiave(a.marca, a.modello);
    return storia().filter((r) => chiave(r.marca, r.modello) === k && (!a.anno || !r.anno || Math.abs(r.anno - a.anno) <= 2));
  }

  /* ---------- apertura ---------- */
  function apri(o) {
    const v = o.valori || {};
    ST = { id: o.id || null, onUsa: o.onUsa, comps: [], esclusi: new Set(), q: 0.5, lavori: o.lavori || 0, prezzoAttuale: v.prezzo == null ? null : v.prezzo, fonte: "" };
    $("#s-marca").value = v.marca || ""; $("#s-modello").value = v.modello || "";
    $("#s-anno").value = v.anno == null ? "" : v.anno; $("#s-km").value = v.km == null ? "" : v.km;
    $("#s-acq").value = v.costo_acquisto == null ? "" : v.costo_acquisto; $("#s-extra").value = v.costi_extra == null ? "" : v.costi_extra;
    $("#s-auto").textContent = [v.marca, v.modello, v.allestimento].filter(Boolean).join(" ") || "Nuova auto";
    const imp = X.S.imp;
    $("#s-trat").value = imp.trattativa; $("#s-cvend").value = imp.costi_vendita || ""; $("#s-cgiorno").value = imp.costo_giorno || ""; $("#s-mmin").value = imp.margine_min || "";
    $("#s-incolla").value = ""; $("#s-q").value = 50;
    $("#s-usa").hidden = !ST.onUsa;
    caricaSalvati();
    X.apri($("#d-stima"));
    aggiorna();
  }
  function caricaSalvati() {
    const a = leggiAuto(), s = salvati()[chiave(a.marca, a.modello)];
    ST.comps = s && Array.isArray(s.annunci) ? s.annunci.slice() : [];
    ST.esclusi = new Set(); ST.fonte = s && ST.comps.length ? s.data : "";
  }
  function memorizza() {
    const a = leggiAuto(); if (!a.marca) return;
    const o = salvati(), k = chiave(a.marca, a.modello);
    if (ST.comps.length) o[k] = { data: X.oggi(), annunci: ST.comps.slice(0, 400) }; else delete o[k];
    scrivi(o);
  }
  function aggiungi(lista) {
    const viste = new Set(ST.comps.map((c) => [c.prezzo, c.km, c.anno].join("|")));
    let nuovi = 0;
    lista.forEach((c) => { const k = [c.prezzo, c.km, c.anno].join("|"); if (!viste.has(k)) { viste.add(k); ST.comps.push({ prezzo: c.prezzo, km: c.km, anno: c.anno }); nuovi++; } });
    if (ST.comps.length > 400) ST.comps = ST.comps.slice(-400);
    ST.fonte = X.oggi(); memorizza();
    return nuovi;
  }

  /* ---------- calcolo e disegno ---------- */
  function calcola() {
    const a = leggiAuto(), imp = X.S.imp, st = storia();
    const mercato = Calc().stimaMercato({ anno: a.anno, km: a.km, comps: ST.comps, esclusi: [...ST.esclusi] });
    const g = Calc().giacenza(st);
    const costi = Calc().costiAuto({ costo_acquisto: a.acquisto, costi_extra: a.extra, checklist: { voci: [{ s: "da_fare", costo: ST.lavori }] } }, imp);
    const base = { mercato, costi, giorniBase: g.n >= 5 ? g.mediana : null, costoGiorno: imp.costo_giorno, trattativa: (imp.trattativa || 0) / 100, margineMin: imp.margine_min };
    const piani = Calc().APPROCCI.map((p) => ({ ...p, piano: Calc().piano({ ...base, q: p.q }) }));
    const scelto = Calc().piano({ ...base, q: ST.q });
    return { a, mercato, costi, g, piani, scelto, base };
  }

  function aggiorna() {
    if (!ST) return;
    const r = calcola(), { a, mercato: m } = r;
    $("#s-link").href = Calc().linkRicerca(a);
    const tot = ST.comps.length;
    $("#s-conta").textContent = !tot ? "Ancora nessun annuncio." : `${tot} annunci letti${ST.fonte ? " (salvati il " + ST.fonte.split("-").reverse().join("/") + ")" : ""}${m.n !== tot ? ` · ${m.n} usati per la stima` : ""}.`;
    $("#s-det").hidden = !tot;
    $("#s-det > summary").textContent = `Annunci letti (${tot}): togli quelli che non c’entrano`;
    $("#s-tab").innerHTML = "<thead><tr><th></th><th class='num'>Prezzo</th><th class='num'>Km</th><th class='num'>Anno</th><th class='num'>Corretto</th><th>Stato</th></tr></thead><tbody>" +
      m.comps.slice().sort((x, y) => x.corretto - y.corretto).map((c) => `<tr class="${c.usata ? "" : "off"}"><td><input type="checkbox" data-i="${c.i}" ${ST.esclusi.has(c.i) ? "" : "checked"} aria-label="Usa questo annuncio"></td><td class="num">${eur(c.prezzo)}</td><td class="num">${c.km != null ? TG.num(c.km) : "–"}</td><td class="num">${c.anno || "–"}</td><td class="num">${c.usata || c.motivo === "prezzo anomalo" ? eur(c.corretto) : "–"}</td><td>${esc(c.usata ? "usato" : c.motivo)}</td></tr>`).join("") + "</tbody>";

    // vendite simili
    const sim = simili(a);
    $("#s-miei").hidden = !sim.length;
    if (sim.length) {
      const pv = sim.filter((x) => x.prezzo_vendita != null).map((x) => x.prezzo_vendita), gg = sim.filter((x) => x.giorni != null).map((x) => x.giorni);
      $("#s-miei").innerHTML = `<b>Le tue vendite di ${esc(a.marca)} ${esc(a.modello)}</b>: ${sim.length} ${sim.length === 1 ? "auto" : "auto"}${pv.length ? `, venduta in media a ${eur(Calc().stat.media(pv))}` : ""}${gg.length ? `, in ${Math.round(Calc().stat.media(gg))} giorni` : ""}. <span class="muted">Sono prezzi di vendita veri, di solito più bassi di quelli di annuncio.</span>`;
    }

    const vuoto = m.affidabilita === "insufficiente";
    $("#s-vuoto").hidden = !vuoto;
    $("#s-ris").hidden = vuoto;
    $("#s-usa").disabled = vuoto;
    if (vuoto) {
      $("#s-vuoto").innerHTML = `<h3>Mancano gli annunci di confronto</h3><p>${tot ? "Gli annunci dell’anno giusto sono troppo pochi: ne servono almeno 3 (meglio più di 10)." : "Per stimare il prezzo servono gli annunci di auto simili alla tua."}</p><ol><li>Tocca <b>Apri la ricerca su AutoScout24</b> (marca, modello e anni sono già impostati).</li><li>Seleziona tutta la pagina dei risultati e copiala.</li><li>Incollala nel riquadro qui a sinistra e tocca <b>Aggiungi questi annunci</b>.</li></ol>` + (r.costi.acquistoNoto ? `<p class="muted small">Intanto: per guadagnare almeno ${eur(X.S.imp.margine_min || 0)} dopo la trattativa del ${X.S.imp.trattativa}% non scendere sotto <b>${eur(Calc().prezzoMinimo({ costi: r.costi, margineMin: X.S.imp.margine_min, trattativa: X.S.imp.trattativa / 100 }))}</b>.</p>` : "");
      ST.ultimo = null; return;
    }
    // schede dei tre approcci
    const migliore = r.piani.filter((p) => p.piano && p.piano.guadagnoGiorno != null && p.piano.guadagnoGiorno > 0).sort((x, y) => y.piano.guadagnoGiorno - x.piano.guadagnoGiorno)[0];
    $("#s-cards").innerHTML = r.piani.map((p) => {
      const pi = p.piano, att = Math.abs(ST.q - p.q) < 0.02;
      return `<button type="button" class="st-card ${att ? "on" : ""}" data-q="${p.q}" aria-pressed="${att}">
  <span class="st-n">${esc(p.nome)}</span><b class="st-p">${eurH(pi.prezzo)}</b>
  <span class="st-m">${pi.giorni != null ? "circa " + pi.giorni + " giorni" : "tempo non stimabile"}</span>
  <span class="st-g ${pi.guadagno < 0 ? "late" : ""}">${r.costi.acquistoNoto ? "guadagno " + eur(pi.guadagno) : esc(p.breve)}</span>
  ${migliore && migliore.id === p.id && r.costi.acquistoNoto ? '<span class="st-best">Più redditizio al giorno</span>' : ""}
</button>`;
    }).join("");
    const s = r.scelto;
    ST.ultimo = s;
    $("#s-qtxt").innerHTML = `Con <b>${eur(s.prezzo)}</b> sei più economico del <b>${pct(s.piuEconomicoDi)}</b> degli annunci simili.`;
    $("#s-grafico").innerHTML = grafico(r);
    $("#s-note").innerHTML = `<b>Affidabilità ${esc(m.affidabilita)}</b>: ${m.n} annunci${m.tolleranza ? ` dell’anno ${a.anno ? a.anno - m.tolleranza + "-" + (a.anno + m.tolleranza) : ""}` : ""}, da ${eur(m.stat.min)} a ${eur(m.stat.max)}, la metà tra ${eur(m.stat.p25)} e ${eur(m.stat.p75)}.` + m.note.map((n) => " " + esc(n)).join("");

    // costi e guadagno
    const c = r.costi, righe = [];
    const R = (t, v, cls, extra) => righe.push(`<div class="st-r ${cls || ""}"><dt>${t}</dt><dd>${v}</dd></div>`);
    R("Prezzo di annuncio", eur(s.prezzo));
    R(`Dopo la trattativa (−${X.S.imp.trattativa}%)`, eur(s.chiuso));
    R("Costo di acquisto", c.acquistoNoto ? eur(c.acquisto) : '<span class="late">non inserito</span>', "costo");
    if (c.extra) R("Costi extra già sostenuti", eur(c.extra), "costo");
    if (c.lavori) R("Lavori da fare (controlli)", eur(c.lavori), "costo");
    if (c.vendita) R("Costi di vendita", eur(c.vendita), "costo");
    if (s.giacenza) R(`Giacenza (${s.giorni} giorni × ${eur(X.S.imp.costo_giorno)})`, eur(s.giacenza), "costo");
    if (c.acquistoNoto) {
      R("Costi totali", eur(s.costiTotali), "tot");
      R("Guadagno ipotetico", `<b class="${s.guadagno < 0 ? "late" : "ok"}">${eur(s.guadagno)}</b>${s.margineSuCosti != null ? ` <small>(${pct(s.margineSuCosti, 1)} sui costi)</small>` : ""}`, "gain");
      if (s.guadagnoGiorno != null) R("Guadagno al giorno in garage", eur(s.guadagnoGiorno), "");
      R(`Prezzo minimo per guadagnare almeno ${eur(X.S.imp.margine_min || 0)}`, eur(Calc().prezzoMinimo({ costi: { diretti: c.diretti + s.giacenza }, margineMin: X.S.imp.margine_min, trattativa: X.S.imp.trattativa / 100 })), "");
    } else R("Guadagno ipotetico", "inserisci il costo di acquisto", "gain");
    $("#s-conti").innerHTML = righe.join("");
    $("#s-usa").textContent = "Usa " + eur(s.prezzo) + " come prezzo";
  }

  /* ---------- grafico: dove cade il tuo prezzo tra gli annunci (prezzi corretti per i km) ---------- */
  const bello = (x) => { const e = Math.pow(10, Math.floor(Math.log10(x))), f = x / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e; };
  function grafico(r) {
    const el = $("#s-grafico"), W = Math.max(300, Math.min(760, el.clientWidth || 560));
    const usati = r.mercato.comps.filter((c) => c.usata), v = usati.map((c) => c.corretto), s = r.scelto;
    const lo = Math.min(...v, s.prezzo), hi = Math.max(...v, s.prezzo), pad = Math.max((hi - lo) * 0.05, 300);
    const passo = bello(Math.max((hi - lo) / 20, 100));
    const x0 = Math.floor((lo - pad) / passo) * passo, x1 = Math.ceil((hi + pad) / passo) * passo;
    const ml = 14, mr = 14, top = 30, rr = 5, sp = 13;
    const X_ = (p) => ml + ((p - x0) / (x1 - x0)) * (W - ml - mr);
    const bin = {};
    usati.forEach((c) => { const b = Math.round((c.corretto - x0) / passo); (bin[b] = bin[b] || []).push(c); });
    const maxPila = Math.max(1, ...Object.values(bin).map((a) => a.length));
    const altPlot = Math.max(70, maxPila * sp + 16), base = top + altPlot, H = base + 58;
    const passoTick = bello((x1 - x0) / (W < 460 ? 3 : 5));
    let t = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Dove cade il tuo prezzo tra gli annunci simili. Il dettaglio è nella tabella degli annunci.">`;
    t += `<rect x="${X_(r.mercato.stat.p25).toFixed(1)}" y="${top}" width="${Math.max(2, X_(r.mercato.stat.p75) - X_(r.mercato.stat.p25)).toFixed(1)}" height="${altPlot}" class="g-banda"/>`;
    t += `<line x1="${ml}" x2="${W - mr}" y1="${base}" y2="${base}" class="g-ass"/>`;
    for (let p = Math.ceil(x0 / passoTick) * passoTick; p <= x1; p += passoTick) { const tx = X_(p), an = tx < ml + 22 ? "start" : tx > W - mr - 22 ? "end" : "middle"; t += `<line x1="${tx.toFixed(1)}" x2="${tx.toFixed(1)}" y1="${base}" y2="${base + 4}" class="g-ass"/><text x="${(an === "start" ? ml - 2 : an === "end" ? W - mr + 2 : tx).toFixed(1)}" y="${base + 18}" class="g-tx" text-anchor="${an}">${TG.num(Math.round(p))}</text>`; }
    Object.keys(bin).forEach((b) => bin[b].forEach((c, k) => {
      const cx = X_(x0 + b * passo).toFixed(1), cy = (base - rr - 3 - k * sp).toFixed(1);
      t += `<g class="g-pt"><circle cx="${cx}" cy="${cy}" r="${rr}" class="g-dot"/><circle cx="${cx}" cy="${cy}" r="12" class="g-hit"><title>${eur(c.prezzo)}${c.km != null ? " · " + TG.num(c.km) + " km" : ""}${c.anno ? " · " + c.anno : ""}${Math.abs(c.corretto - c.prezzo) > 50 ? " · corretto " + eur(c.corretto) : ""}</title></circle></g>`;
    }));
    // i tre approcci, sotto l'asse
    const eti = r.piani.map((p) => ({ x: X_(p.piano.prezzo), n: p.id === "fretta" ? "In fretta" : p.id === "margine" ? "Margine" : "Equilibrato" }));
    eti.forEach((e, i) => { const riga = i === 1 && (e.x - eti[0].x < 56 || eti[2].x - e.x < 56) ? 1 : 0; t += `<line x1="${e.x.toFixed(1)}" x2="${e.x.toFixed(1)}" y1="${base + 22}" y2="${base + 27 + riga * 12}" class="g-ass"/><text x="${e.x.toFixed(1)}" y="${base + 38 + riga * 12}" class="g-tx" text-anchor="middle">${e.n}</text>`; });
    // il prezzo scelto
    const sx = X_(s.prezzo).toFixed(1), ancora = sx < 70 ? "start" : sx > W - 70 ? "end" : "middle";
    t += `<line x1="${sx}" x2="${sx}" y1="${top - 4}" y2="${base}" class="g-sel"/><circle cx="${sx}" cy="${top - 4}" r="4.5" class="g-seld"/><text x="${sx}" y="${top - 12}" class="g-tx2" text-anchor="${ancora}">${eur(s.prezzo)}</text>`;
    return t + "</svg>";
  }

  /* ---------- eventi ---------- */
  function init(ctx) {
    X = ctx;
    const rid = (() => { let tm; return () => { clearTimeout(tm); tm = setTimeout(aggiorna, 120); }; })();
    ["s-marca", "s-modello", "s-anno", "s-km", "s-acq", "s-extra"].forEach((id) => $("#" + id).addEventListener("input", (e) => {
      if ((id === "s-marca" || id === "s-modello") && ST) { const k = chiave($("#s-marca").value, $("#s-modello").value); const sv = salvati()[k]; if (sv && !ST.comps.length) { ST.comps = sv.annunci.slice(); ST.fonte = sv.data; } }
      rid();
    }));
    const impCampi = [["s-trat", "trattativa"], ["s-cvend", "costi_vendita"], ["s-cgiorno", "costo_giorno"], ["s-mmin", "margine_min"]];
    impCampi.forEach(([id, k]) => $("#" + id).addEventListener("input", (e) => { const n = num(e.target.value); X.S.imp[k] = n == null ? (k === "trattativa" ? 3 : 0) : Math.max(0, k === "trattativa" ? Math.min(30, n) : n); X.salva(); rid(); }));
    $("#s-leggi").onclick = () => {
      const testo = $("#s-incolla").value, l = Calc().leggiAnnunci(testo);
      if (!l.length) return X.toast(testo.trim() ? "Non ho trovato annunci in quel testo: servono prezzi con il simbolo € (oppure una riga per annuncio: prezzo km anno)." : "Incolla prima il testo della pagina dei risultati.");
      const n = aggiungi(l);
      $("#s-incolla").value = ""; X.toast(n ? `${n} annunci aggiunti.` : "Erano già tutti presenti."); aggiorna();
    };
    $("#s-incolla").addEventListener("paste", () => setTimeout(() => { if ($("#s-incolla").value.trim().length > 20) $("#s-leggi").click(); }, 30));
    $("#s-file").addEventListener("change", async (e) => {
      const f = e.target.files[0]; e.target.value = ""; if (!f) return;
      try {
        const wb = await TG.tab.leggi(f);
        const l = wb.sheets.reduce((acc, sh) => acc.concat(Calc().annunciDaTabella(sh.rows)), []);
        if (!l.length) return X.toast("Nel file non trovo le colonne «Prezzo», «Km» e «Anno».");
        X.toast(`${aggiungi(l)} annunci aggiunti dal file.`); aggiorna();
      } catch (err) { X.toast("Non riesco a leggere il file: " + err.message); }
    });
    $("#s-svuota").onclick = () => { ST.comps = []; ST.esclusi = new Set(); ST.fonte = ""; memorizza(); aggiorna(); };
    $("#s-tab").addEventListener("change", (e) => { const i = e.target.dataset.i; if (i == null) return; if (e.target.checked) ST.esclusi.delete(+i); else ST.esclusi.add(+i); aggiorna(); });
    $("#s-cards").addEventListener("click", (e) => { const b = e.target.closest("[data-q]"); if (!b) return; ST.q = +b.dataset.q; $("#s-q").value = Math.round(ST.q * 100); aggiorna(); });
    $("#s-q").addEventListener("input", (e) => { ST.q = +e.target.value / 100; aggiorna(); });
    $("#s-usa").onclick = () => {
      if (!ST || !ST.ultimo || !ST.onUsa) return;
      ST.onUsa(ST.ultimo.prezzo); $("#d-stima").close(); X.toast("Prezzo impostato: " + eur(ST.ultimo.prezzo) + ".");
    };
    let tm; window.addEventListener("resize", () => { if ($("#d-stima").open) { clearTimeout(tm); tm = setTimeout(aggiorna, 150); } });
  }

  GT.Stima = { init, apri };
})();
