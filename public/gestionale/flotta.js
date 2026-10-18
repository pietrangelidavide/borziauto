/* AutoProfit · scheda «Flotta»: tenere il garage il più pieno possibile.
   Dallo storico delle vendite (quelle del gestionale più il file CSV che importi) prevede quante auto escono,
   quante ne servono e quando comprarle, su che tipo di auto puntare e quali auto spingere. Sono previsioni, non certezze:
   più storico c'è, più sono affidabili (la scheda dice quanto). */
(function () {
  "use strict";
  const GT = (window.GT = window.GT || {});
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => TG.esc(s);
  const Calc = () => GT.Calc;
  let X = null;            // contesto: { S, salva, ridisegna, toast, apri, oggi, titolo, numero, stima, modifica }
  const MESI = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
  const fData = (iso) => (iso ? `${+iso.slice(8, 10)} ${MESI[+iso.slice(5, 7) - 1]}` : "");
  const fMese = (m) => `${MESI[+m.slice(5, 7) - 1]} ${m.slice(2, 4)}`;
  const eur = (n) => (n == null || !isFinite(n) ? "–" : (n < 0 ? "−" : "") + TG.euro(Math.round(Math.abs(n))).replace(" ", "\u00a0"));
  const eurH = (n) => (n == null || !isFinite(n) ? "–" : (n < 0 ? "−" : "") + TG.euroHtml(Math.round(Math.abs(n))));
  const un = (n, s, p) => `${n} ${n === 1 ? s : p}`;
  const bello = (x) => { const e = Math.pow(10, Math.floor(Math.log10(x))), f = x / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e; };
  let U = null;                                    // ultima previsione calcolata
  let SEG = "marca";

  const storia = () => Calc().storia(X.S.auto, X.S.storico);

  /* ---------- impostazioni (una riga sopra tutto) ---------- */
  const CAMPI = [["fl-posti", "posti", null], ["fl-ritardo", "ritardo", 14], ["fl-obiettivo", "obiettivo", 100], ["fl-max", "max_ingressi", 4], ["fl-prep", "giorni_prep", 7]];
  function leggiImp() { CAMPI.forEach(([id, k]) => { const v = X.S.imp[k]; $("#" + id).value = v == null ? "" : v; }); }

  /* ---------- schede delle cifre ---------- */
  function kpi(p, g, mg, st) {
    const posti = X.S.imp.posti, att = p.attuali, liberi = posti ? Math.max(0, posti - att) : null;
    const K = (l, v, s, extra) => `<div class="kpi ${extra || ""}"><span class="kpi-l">${l}</span><b class="kpi-v">${v}</b><small>${s}</small></div>`;
    const occ = posti ? Math.min(100, Math.round((att / posti) * 100)) : null;
    const senza = p.senzaStorico;
    return [
      K("Auto in garage", posti ? `${att} <span class="eur">/ ${posti}</span>` : String(att), posti ? `<span class="meter" aria-hidden="true"><i style="width:${occ}%"></i></span>${liberi === 0 ? "garage pieno" : un(liberi, "posto libero", "posti liberi")}` : "Imposta i posti per i consigli sugli acquisti", !posti ? "warn" : ""),
      K("Escono nei prossimi 30 giorni", senza ? "–" : `≈ ${Math.round(p.usciteAttuali30)}`, senza ? "serve lo storico delle vendite" : "dalle auto già in garage"),
      K("Da comprare", senza || !posti ? "–" : String(p.ingressiTot), senza || !posti ? "servono posti e storico" : p.daComprareSubito ? `${p.daComprareSubito} entro 7 giorni · ${p.settimane.length} settimane in tutto` : `nelle prossime ${p.settimane.length} settimane`),
      K("Tempo in garage", g.n ? `${Math.round(g.mediana)} <span class="eur">giorni</span>` : "–", g.n ? `la metà delle auto si vende prima · su ${g.n} vendite` : "mancano le date di acquisto e vendita"),
      K("Margine per auto-giorno", mg != null ? eurH(mg) : "–", mg != null ? "quanto frutta ogni giorno un’auto in garage" : "servono costi e prezzi di vendita"),
      K("Affidabilità delle previsioni", { buona: "Buona", media: "Media", bassa: "Bassa", nessuna: "Nessuna" }[p.affidabilita], senza ? "importa lo storico delle vendite" : `${st.length} vendite${p.stagionalita.mesiDati ? " in " + p.stagionalita.mesiDati + " mesi" : ""}${p.stagionalita.affidabile ? ", con stagionalità" : ""}`, p.affidabilita === "bassa" || p.affidabilita === "nessuna" ? "warn" : ""),
    ].join("");
  }

  /* ---------- grafico: auto in garage nelle prossime settimane ---------- */
  function graficoGarage(p) {
    const el = $("#fl-graf"), W = Math.max(300, Math.min(1100, el.clientWidth || 640)), H = 250;
    const ml = 34, mr = 18, mt = 16, mb = 34, pw = W - ml - mr, ph = H - mt - mb;
    const n = p.settimane.length;
    const con = [p.attuali, ...p.settimane.map((s) => s.occCon)], senza = [p.attuali, ...p.settimane.map((s) => s.occSenza)];
    const massimo = Math.max(p.posti || 0, ...con, ...senza, 1);
    const passo = bello(Math.max(1, massimo / 4)), ymax = Math.ceil(massimo / passo) * passo;
    const x = (i) => ml + (i / n) * pw, y = (v) => mt + ph - (v / ymax) * ph;
    const linea = (a) => a.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join("");
    let t = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Auto in garage nelle prossime ${n} settimane, con e senza gli acquisti consigliati. I valori settimana per settimana sono nella tabella accanto.">`;
    for (let v = 0; v <= ymax; v += passo) t += `<line x1="${ml}" x2="${W - mr}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="g-gr"/><text x="${ml - 8}" y="${(y(v) + 4).toFixed(1)}" class="g-tx" text-anchor="end">${v}</text>`;
    for (let i = 0; i <= n; i += W < 520 ? 4 : 2) t += `<text x="${x(i).toFixed(1)}" y="${H - 10}" class="g-tx" text-anchor="middle">${i === 0 ? "oggi" : fData(p.settimane[i - 1].inizio)}</text>`;
    if (p.posti) t += `<line x1="${ml}" x2="${W - mr}" y1="${y(p.posti).toFixed(1)}" y2="${y(p.posti).toFixed(1)}" class="g-cap"/><text x="${W - mr}" y="${(y(p.posti) - 6).toFixed(1)}" class="g-tx" text-anchor="end">${p.posti} posti</text>`;
    t += `<path d="${linea(con)} L${x(n).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)}Z" class="g-area"/>`;
    t += `<path d="${linea(senza)}" class="g-l2"/><path d="${linea(con)}" class="g-l1"/>`;
    t += `<circle cx="${x(n).toFixed(1)}" cy="${y(con[n]).toFixed(1)}" r="4.5" class="g-end1"/><circle cx="${x(n).toFixed(1)}" cy="${y(senza[n]).toFixed(1)}" r="4.5" class="g-end2"/>`;
    t += `<g id="fl-cross" hidden><line class="g-cross" y1="${mt}" y2="${mt + ph}"/><circle r="4.5" class="g-end1" id="fl-c1"/><circle r="4.5" class="g-end2" id="fl-c2"/></g>`;
    t += `<rect x="${ml}" y="${mt}" width="${pw}" height="${ph}" fill="transparent" id="fl-hit"/></svg>`;
    el.innerHTML = t;
    // etichette dei bordi: le date vere (inizio settimana)
    el.querySelectorAll("text.g-tx").forEach(() => {});
    const tip = $("#fl-tip"), cross = $("#fl-cross"), hit = $("#fl-hit");
    const mostra = (i) => {
      i = Math.max(0, Math.min(n, i));
      const cx = x(i); cross.hidden = false;
      cross.querySelector("line").setAttribute("x1", cx); cross.querySelector("line").setAttribute("x2", cx);
      $("#fl-c1").setAttribute("cx", cx); $("#fl-c1").setAttribute("cy", y(con[i])); $("#fl-c2").setAttribute("cx", cx); $("#fl-c2").setAttribute("cy", y(senza[i]));
      const s = i ? p.settimane[i - 1] : null;
      tip.replaceChildren();
      const riga = (cls, a, b) => { const d = document.createElement("div"); d.className = cls; const v = document.createElement("b"); v.textContent = a; const l = document.createElement("span"); l.textContent = b; d.append(v, l); tip.append(d); };
      const tit = document.createElement("div"); tit.className = "tt-t"; tit.textContent = i ? "Al " + fData(s.inizio) : "Oggi"; tip.append(tit);
      riga("k1", String(Math.round(con[i])), "con gli acquisti consigliati");
      if (i) { riga("k0", String(Math.round(senza[i])), "senza nuovi acquisti"); riga("k0", `${Math.round(s.uscite * 10) / 10}`.replace(".", ","), "escono nella settimana (attese)"); if (s.ingressi) riga("k0", String(s.ingressi), "arrivano nella settimana"); }
      tip.hidden = false;
      const w = tip.offsetWidth; tip.style.left = Math.max(4, Math.min(W - w - 4, cx + 12)) + "px"; tip.style.top = "6px";
    };
    const daEvento = (e) => { const r = hit.getBoundingClientRect(); return Math.round(((e.clientX - r.left) / r.width) * n); };
    hit.addEventListener("pointermove", (e) => mostra(daEvento(e)));
    hit.addEventListener("pointerleave", () => { cross.hidden = true; tip.hidden = true; });
    let corr = 0;
    el.tabIndex = 0;
    el.onkeydown = (e) => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); corr = Math.max(0, Math.min(n, corr + (e.key === "ArrowRight" ? 1 : -1))); mostra(corr); } else if (e.key === "Escape") { cross.hidden = true; tip.hidden = true; } };
    el.onblur = () => { cross.hidden = true; tip.hidden = true; };
  }

  /* ---------- grafico: vendite al mese ---------- */
  function graficoVendite(st) {
    const el = $("#fl-vend");
    const v = Calc().venditeMensili(st, X.oggi(), 24);
    if (!st.length) { el.innerHTML = ""; return; }
    const W = Math.max(300, Math.min(1100, el.clientWidth || 640)), H = 210, ml = 30, mr = 8, mt = 12, mb = 30, pw = W - ml - mr, ph = H - mt - mb;
    const massimo = Math.max(1, ...v.map((m) => m.n)), passo = bello(Math.max(1, massimo / 4)), ymax = Math.ceil(massimo / passo) * passo;
    const banda = pw / v.length, larg = Math.min(24, banda * 0.72), y = (n) => mt + ph - (n / ymax) * ph;
    let t = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Auto vendute ogni mese negli ultimi 24 mesi">`;
    for (let n = 0; n <= ymax; n += passo) t += `<line x1="${ml}" x2="${W - mr}" y1="${y(n).toFixed(1)}" y2="${y(n).toFixed(1)}" class="g-gr"/><text x="${ml - 6}" y="${(y(n) + 4).toFixed(1)}" class="g-tx" text-anchor="end">${n}</text>`;
    v.forEach((m, i) => {
      const cx = ml + banda * (i + 0.5), h = Math.max(0, (m.n / ymax) * ph), r = Math.min(4, larg / 2, h);
      if (m.n) t += `<path class="g-bar ${m.parziale ? "parz" : ""}" tabindex="0" d="M${(cx - larg / 2).toFixed(1)} ${(mt + ph).toFixed(1)}V${(mt + ph - h + r).toFixed(1)}Q${(cx - larg / 2).toFixed(1)} ${(mt + ph - h).toFixed(1)} ${(cx - larg / 2 + r).toFixed(1)} ${(mt + ph - h).toFixed(1)}H${(cx + larg / 2 - r).toFixed(1)}Q${(cx + larg / 2).toFixed(1)} ${(mt + ph - h).toFixed(1)} ${(cx + larg / 2).toFixed(1)} ${(mt + ph - h + r).toFixed(1)}V${(mt + ph).toFixed(1)}Z" data-m="${m.mese}" data-n="${m.n}" data-p="${m.parziale ? 1 : 0}"></path>`;
      if (i % (W < 520 ? 4 : 3) === 0 || i === v.length - 1) t += `<text x="${cx.toFixed(1)}" y="${H - 10}" class="g-tx" text-anchor="middle">${fMese(m.mese)}</text>`;
    });
    t += `<line x1="${ml}" x2="${W - mr}" y1="${y(0)}" y2="${y(0)}" class="g-ass"/></svg>`;
    el.innerHTML = t;
    const tip = $("#fl-tip2");
    const mostra = (b) => {
      tip.replaceChildren();
      const a = document.createElement("div"); a.className = "tt-t"; a.textContent = fMese(b.dataset.m) + (b.dataset.p === "1" ? " (in corso)" : "");
      const d = document.createElement("div"); d.className = "k1"; const vv = document.createElement("b"); vv.textContent = b.dataset.n; const l = document.createElement("span"); l.textContent = +b.dataset.n === 1 ? "auto venduta" : "auto vendute"; d.append(vv, l);
      tip.append(a, d); tip.hidden = false;
      const r = b.getBoundingClientRect(), c = el.getBoundingClientRect();
      tip.style.left = Math.max(4, Math.min(c.width - tip.offsetWidth - 4, r.left - c.left + r.width / 2 - tip.offsetWidth / 2)) + "px"; tip.style.top = Math.max(0, r.top - c.top - tip.offsetHeight - 6) + "px";
    };
    el.querySelectorAll(".g-bar").forEach((b) => { b.addEventListener("pointerenter", () => mostra(b)); b.addEventListener("focus", () => mostra(b)); b.addEventListener("pointerleave", () => (tip.hidden = true)); b.addEventListener("blur", () => (tip.hidden = true)); });
  }

  /* ---------- piano settimana per settimana ---------- */
  function piano(p) {
    if (p.senzaStorico) return `<p class="gt-empty">Per prevedere uscite e acquisti serve lo storico delle vendite: importalo qui sotto, oppure segna come «Vendute» le auto che vendi (con data di acquisto e di vendita).</p>`;
    if (p.senzaPosti) return `<p class="gt-empty">Scrivi quanti posti ha il garage (in alto) per vedere quante auto comprare e quando.</p>`;
    const sub = p.ingressiTot
      ? `Per tenere il garage al ${X.S.imp.obiettivo}% servono circa <b>${p.ingressiTot}</b> auto nelle prossime ${p.settimane.length} settimane${p.daComprareSubito ? `, <b class="late">${p.daComprareSubito} da comprare subito</b> (entro 7 giorni)` : ""}.`
      : "Con le uscite previste il garage resta al livello che vuoi: per ora non serve comprare.";
    const minimo = p.minimo < p.posti * (X.S.imp.obiettivo / 100) - 0.5 ? ` Nelle prime settimane il garage scende fino a ${Math.round(p.minimo)} auto: comprare richiede ${X.S.imp.ritardo} giorni.` : "";
    return `<p class="fl-sub">${sub}${minimo}</p><div class="tbl-wrap fl-pt"><table><thead><tr><th>Entro il</th><th class="num">Escono</th><th class="num">Compra</th><th>Compra entro il</th><th class="num">In garage</th></tr></thead><tbody>${p.settimane.map((s) => `<tr class="${s.urgente ? "urg" : ""}"><td>${fData(s.inizio)}</td><td class="num">${(Math.round(s.uscite * 10) / 10).toString().replace(".", ",")}</td><td class="num">${s.ingressi ? `<b>${s.ingressi}</b>` : "–"}</td><td>${s.ingressi ? fData(s.acquistaEntro) + (s.urgente ? ' <span class="tag warn">subito</span>' : "") : ""}</td><td class="num">${Math.round(s.occCon)}</td></tr>`).join("")}</tbody></table></div>
<p class="small muted">Ogni riga è una settimana. Le «uscite» sono attese (una media, non un calendario preciso). «Compra entro il» tiene conto dei ${X.S.imp.ritardo} giorni tra l’acquisto e l’auto in vetrina.</p>`;
  }

  /* ---------- su cosa puntare ---------- */
  function segmenti(st) {
    const righe = Calc().segmenti(st, SEG);
    const buoni = righe.filter((r) => !r.pochiDati && r.margineGiorno != null);
    if (!buoni.length) return `<p class="gt-empty">Servono almeno 3 vendite con date e prezzi per ogni gruppo. Importa lo storico con costi e prezzi di vendita.</p>`;
    let frase = "";
    if (buoni.length >= 2) { const a = buoni[0], b = buoni[buoni.length - 1]; frase = `<p class="fl-sub">In media ${esc(a.nome)} frutta <b>${eur(a.margineGiorno)}</b> al giorno per auto in garage, ${esc(b.nome)} <b>${eur(b.margineGiorno)}</b>. Il margine per giorno premia chi si vende in fretta oltre a chi rende di più.</p>`; }
    return frase + `<div class="tbl-wrap"><table><thead><tr><th>${{ marca: "Marca", marca_modello: "Modello", alimentazione: "Alimentazione", carrozzeria: "Carrozzeria", fascia: "Fascia di prezzo" }[SEG]}</th><th class="num">Vendute</th><th class="num">Giorni</th><th class="num">Margine</th><th class="num">Al giorno</th></tr></thead><tbody>${righe.slice(0, 12).map((r, i) => `<tr class="${r.pochiDati ? "off" : ""}"><td><b>${esc(r.nome)}</b>${i === 0 && !r.pochiDati ? ' <span class="tag ok">Punta su</span>' : ""}${r.pochiDati ? ' <span class="tag">pochi dati</span>' : ""}</td><td class="num">${r.n}</td><td class="num">${r.giorniMedi != null ? Math.round(r.giorniMedi) : "–"}</td><td class="num">${eur(r.margineMedio)}</td><td class="num">${eur(r.margineGiorno)}</td></tr>`).join("")}</tbody></table></div>`;
  }

  /* ---------- auto da spingere ---------- */
  function spingere(st) {
    const l = Calc().daSpingere(X.S.auto, st, X.oggi(), X.S.imp);
    if (!l.length) return `<p class="gt-empty">Nessuna auto è ferma da più del normale.</p>`;
    return `<ul class="fl-spingi">${l.slice(0, 8).map((x) => {
      const a = X.S.auto.find((y) => y.id === x.id); if (!a) return "";
      return `<li data-id="${esc(a.id)}"><div><b>${esc(X.titolo(a))}</b><small>ferma da ${x.eta} giorni${x.vsMediana ? ` (${x.vsMediana.toFixed(1).replace(".", ",")}× il tempo normale)` : ""} · prezzo ${eur(x.prezzo)}</small>
<ul class="fl-rib" aria-label="Se abbassi il prezzo">${x.ribassi.map((r) => `<li><b>−${Math.round(r.r * 100)}%</b> ${eur(r.prezzo)}${r.margine != null ? ` <span class="${r.margine < 0 ? "late" : ""}">margine ${eur(r.margine)}</span>` : ""}</li>`).join("")}</ul></div>
<div class="fl-az"><button type="button" class="btn btn-line sm" data-az="stima">Stima il prezzo</button><button type="button" class="lnk" data-az="modifica">Modifica</button></div></li>`;
    }).join("")}</ul>`;
  }

  /* ---------- storico ---------- */
  function riepilogoStorico(st) {
    const dem = X.S.storico.some((r) => r.demo);
    const g = st.filter((r) => r.fonte === "gestionale").length, i = st.length - g;
    const da = st.length ? st[0].data_vendita : "", a = st.length ? st[st.length - 1].data_vendita : "";
    $("#fl-sto-info").innerHTML = st.length
      ? `<b>${st.length}</b> vendite dal ${fData(da)} ${da.slice(0, 4)} al ${fData(a)} ${a.slice(0, 4)}: ${g} dal gestionale, ${i} importate.${dem ? ' <span class="tag warn">Storico di esempio</span>' : ""}`
      : "Ancora nessuna vendita. Le auto che segni come «Vendute» entrano da sole; per i mesi passati importa un file.";
    $("#fl-sto-esporta").hidden = !X.S.storico.length; $("#fl-sto-svuota").hidden = !X.S.storico.length;
    $("#fl-esempio").hidden = !dem;
  }

  /* ---------- disegno ---------- */
  function disegna() {
    if (!X || $("#flotta").hidden) return;
    const st = storia(), imp = X.S.imp;
    const p = Calc().previsione({ auto: X.S.auto, storia: st, oggi: X.oggi(), posti: imp.posti, ritardoIngresso: imp.ritardo, obiettivo: imp.obiettivo / 100, giorniPreparazione: imp.giorni_prep, maxIngressi: imp.max_ingressi, settimane: 12 });
    U = p;
    const g = Calc().giacenza(st), mg = Calc().margineGiorno(st);
    $("#fl-kpi").innerHTML = kpi(p, g, mg, st);
    const puoi = !p.senzaStorico && imp.posti;
    $("#fl-g-box").hidden = !puoi;
    if (puoi) {
      graficoGarage(p);
      const dopoSett = p.settimane.at(-1);
      $("#fl-g-sub").textContent = `Senza nuovi acquisti restano circa ${Math.round(dopoSett.occSenza)} auto tra ${p.settimane.length} settimane; con gli acquisti consigliati il garage resta intorno a ${Math.round(dopoSett.occCon)}.`;
    }
    $("#fl-piano").innerHTML = piano(p);
    $("#fl-seg").innerHTML = segmenti(st);
    $("#fl-push").innerHTML = spingere(st);
    riepilogoStorico(st);
    graficoVendite(st);
    $("#fl-vend-box").hidden = !st.length;
    const sg = p.stagionalita;
    $("#fl-stag").textContent = sg.affidabile
      ? (() => { const idx = sg.indici.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]); const pc = (v) => { const x = Math.round((v - 1) * 100); return (x > 0 ? "+" : x < 0 ? "−" : "") + Math.abs(x) + "%"; }; return `Mesi più forti: ${MESI[idx[0][1]]} (${pc(idx[0][0])}) e ${MESI[idx[1][1]]} (${pc(idx[1][0])}). Più deboli: ${MESI[idx.at(-1)[1]]} (${pc(idx.at(-1)[0])}). Le previsioni ne tengono conto.`; })()
      : st.length ? "Con meno di 18 mesi di storico non calcolo la stagionalità." : "";
  }

  /* ---------- import dello storico ---------- */
  let IMP = null;
  async function leggi(file) {
    const err = $("#sto-err"); err.hidden = true;
    try {
      const wb = await TG.tab.leggi(file);
      const tutte = { righe: [], scartate: [], colonne: new Set() };
      wb.sheets.forEach((sh) => { const r = Calc().storicoDaTabella(sh.rows); tutte.righe.push(...r.righe); tutte.scartate.push(...r.scartate.filter((m) => !/Non trovo la riga/.test(m) || wb.sheets.length === 1)); r.colonne.forEach((c) => tutte.colonne.add(c)); });
      if (!tutte.righe.length) throw new Error(tutte.scartate[0] || "Nel file non trovo vendite: serve almeno la colonna «Data vendita».");
      IMP = tutte; anteprima(file.name);
    } catch (e) { IMP = null; err.textContent = e.message; err.hidden = false; $("#sto-2").hidden = true; $("#sto-ok").hidden = true; }
  }
  function anteprima(nome) {
    const esist = new Set(X.S.storico.map(Calc().chiaveStorico));
    const nuove = IMP.righe.filter((r) => !esist.has(Calc().chiaveStorico(r))).length;
    const conGiorni = IMP.righe.filter((r) => r.data_acquisto).length, conPrezzi = IMP.righe.filter((r) => r.prezzo_vendita != null && r.costo_acquisto != null).length;
    const date = IMP.righe.map((r) => r.data_vendita).sort();
    $("#sto-riep").innerHTML = `<strong>${esc(nome)}</strong>: ${IMP.righe.length} vendite dal ${fData(date[0])} ${date[0].slice(0, 4)} al ${fData(date.at(-1))} ${date.at(-1).slice(0, 4)} · nuove <strong>${nuove}</strong> · già presenti <strong>${IMP.righe.length - nuove}</strong>.`;
    const avv = [];
    if (conGiorni < IMP.righe.length * 0.6) avv.push(`Solo ${conGiorni} righe hanno la data di acquisto: senza, non posso calcolare i giorni in garage.`);
    if (conPrezzi < IMP.righe.length * 0.6) avv.push(`Solo ${conPrezzi} righe hanno costo e prezzo di vendita: il margine per tipo di auto sarà incompleto.`);
    $("#sto-prob").innerHTML = avv.map((m) => `<li>${esc(m)}</li>`).concat(IMP.scartate.slice(0, 20).map((m) => `<li class="e">${esc(m)}</li>`), IMP.scartate.length > 20 ? [`<li>… e altre ${IMP.scartate.length - 20} righe saltate.</li>`] : []).join("");
    $("#sto-ok").textContent = `Importa ${IMP.righe.length} vendite`;
    $("#sto-1").hidden = true; $("#sto-2").hidden = false; $("#sto-ok").hidden = false;
  }
  const idStorico = (() => { let q = 0; return () => "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5) + (q++).toString(36); })();
  function conferma() {
    if (!IMP) return;
    const sostituisci = document.querySelector('input[name="sto-modo"]:checked').value === "sostituisci";
    if (sostituisci && !confirm("Sostituire tutto lo storico importato con quello del file? Le auto vendute nel gestionale restano.")) return;
    const tolte = X.S.storico.some((r) => r.demo);
    let lista = sostituisci ? [] : X.S.storico.filter((r) => !r.demo);
    const esist = new Set(lista.map(Calc().chiaveStorico));
    let nuove = 0;
    IMP.righe.forEach((r) => { const k = Calc().chiaveStorico(r); if (esist.has(k)) return; esist.add(k); lista.push({ ...r, id: idStorico() }); nuove++; });
    X.S.storico = lista;
    X.salva(); $("#d-storico").close(); X.toast(`Storico aggiornato: ${nuove} vendite aggiunte${tolte ? ` (tolto lo storico di esempio)` : ""}.`); IMP = null; X.ridisegna();
  }
  function apriImporta() {
    IMP = null; $("#sto-file").value = ""; $("#sto-1").hidden = false; $("#sto-2").hidden = true; $("#sto-ok").hidden = true; $("#sto-err").hidden = true;
    document.querySelector('input[name="sto-modo"][value="aggiungi"]').checked = true;
    X.apri($("#d-storico"));
  }

  function esporta(solo) {
    const rows = solo ? [] : X.S.storico.map((r) => Calc().COLONNE_STORICO.map(([k]) => (r[k] == null ? "" : r[k])));
    TG.tab.scarica("﻿" + TG.tab.toCSV([Calc().COLONNE_STORICO.map(([, t]) => t)].concat(rows)), solo ? "autoprofit-storico-modello.csv" : `autoprofit-storico-vendite-${X.oggi()}.csv`, "text/csv;charset=utf-8");
  }

  function init(ctx) {
    X = ctx;
    CAMPI.forEach(([id, k, def]) => $("#" + id).addEventListener("change", (e) => {
      const n = X.numero(e.target.value);
      X.S.imp[k] = n == null || !isFinite(n) || n < 0 ? def : Math.round(n);
      if (k === "obiettivo") X.S.imp[k] = Math.min(100, Math.max(10, X.S.imp[k] || 100));
      e.target.value = X.S.imp[k] == null ? "" : X.S.imp[k];
      X.salva(); disegna();
    }));
    $("#fl-seg-per").addEventListener("change", (e) => { SEG = e.target.value; $("#fl-seg").innerHTML = segmenti(storia()); });
    $("#fl-push").addEventListener("click", (e) => {
      const b = e.target.closest("[data-az]"); if (!b) return;
      const a = X.S.auto.find((x) => x.id === b.closest("li").dataset.id); if (!a) return;
      if (b.dataset.az === "stima") X.stima(a); else X.modifica(a);
    });
    $("#fl-sto-importa").onclick = apriImporta;
    $("#fl-sto-modello").onclick = () => esporta(true);
    $("#fl-sto-esporta").onclick = () => esporta(false);
    $("#fl-sto-svuota").onclick = () => { if (!confirm("Eliminare tutto lo storico importato? Le auto vendute nel gestionale restano.")) return; X.S.storico = []; X.salva(); X.ridisegna(); X.toast("Storico importato eliminato."); };
    $("#fl-esempio").onclick = () => { X.S.storico = X.S.storico.filter((r) => !r.demo); X.salva(); X.ridisegna(); X.toast("Storico di esempio eliminato."); };
    const drop = $("#sto-drop");
    ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove("over")));
    drop.addEventListener("drop", (e) => { e.preventDefault(); if (e.dataTransfer.files[0]) leggi(e.dataTransfer.files[0]); });
    $("#sto-file").addEventListener("change", (e) => { if (e.target.files[0]) leggi(e.target.files[0]); });
    $("#sto-ok").onclick = conferma;
    let tm; window.addEventListener("resize", () => { if (!$("#flotta").hidden) { clearTimeout(tm); tm = setTimeout(disegna, 180); } });
  }

  GT.Garage = { init, disegna, leggiImp, ultima: () => U };
})();
