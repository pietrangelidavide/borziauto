/* AutoProfit · stima del prezzo di vendita e calcolo di quanto pagare.
   Gli annunci di mercato arrivano da una fonte (mercato.js: feed autorizzato, dati di esempio dichiarati, oppure annunci inseriti a mano),
   si filtrano per anno, si correggono per i chilometri e danno un prezzo per tre approcci: vendere in fretta, equilibrato, margine massimo.
   Con gli stessi dati, in modalità «Quanto pagare» si risale al massimo da pagare per ogni approccio.
   È una stima, non una valutazione ufficiale. */
(function () {
  "use strict";
  const GT = (window.GT = window.GT || {});
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => TG.esc(s);
  const Calc = () => GT.Calc;
  let X = null;          // contesto: { S, salva, toast, apri, oggi, titolo, numero, ridisegna }
  let ST = null;         // { id, modo, onUsa, auto[] (dalla fonte), comps[] (inseriti a mano), esclusi:Set, q, fonteAuto, carico }

  const LSK = "autoprofit.mercato.v1";
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

  const elenco = () => ST.auto.concat(ST.comps);        // gli indici di «esclusi» valgono su questo elenco

  /* ---------- apertura ---------- */
  function apri(o) {
    const v = o.valori || {};
    ST = { id: o.id || null, modo: o.modo === "compra" ? "compra" : "vendi", onUsa: o.onUsa, auto: [], comps: [], esclusi: new Set(), q: 0.5, lavori: o.lavori || 0, prezzoAttuale: v.prezzo == null ? null : v.prezzo, fonte: "", fonteAuto: null, carico: 0, token: 0 };
    $("#s-marca").value = v.marca || ""; $("#s-modello").value = v.modello || "";
    $("#s-anno").value = v.anno == null ? "" : v.anno; $("#s-km").value = v.km == null ? "" : v.km;
    $("#s-acq").value = v.costo_acquisto == null ? "" : v.costo_acquisto; $("#s-extra").value = v.costi_extra == null ? "" : v.costi_extra;
    $("#s-auto").textContent = [v.marca, v.modello, v.allestimento].filter(Boolean).join(" ") || "Nuova auto";
    const imp = X.S.imp;
    $("#s-trat").value = imp.trattativa; $("#s-cvend").value = imp.costi_vendita || ""; $("#s-cgiorno").value = imp.costo_giorno || ""; $("#s-mmin").value = imp.margine_min || "";
    $("#s-incolla").value = ""; $("#s-q").value = 50;
    $("#s-manuale").open = false;
    caricaSalvati();
    impostaModo();
    X.apri($("#d-stima"));
    cercaMercato();            // prima la ricerca (segna «Cerco gli annunci…»), così il pannello degli annunci manuali non si apre per un attimo
    aggiorna();
  }
  function impostaModo() {
    const c = ST.modo === "compra";
    $("#d-stima").dataset.modo = ST.modo;
    $("#s-m-vendi").setAttribute("aria-pressed", String(!c)); $("#s-m-compra").setAttribute("aria-pressed", String(c));
    $("#s-titolo").textContent = c ? "Quanto pagare questa auto" : "Stima del prezzo di vendita";
    $("#s-acq-l").firstChild.nodeValue = c ? "Prezzo che ti chiedono (€)" : "Costo di acquisto (€)";
    $("#s-extra-l").firstChild.nodeValue = c ? "Lavori e costi previsti (€)" : "Costi extra (€)";
    $("#s-usa").hidden = c || !ST.onUsa;
    $("#s-vendi-box").hidden = c; $("#s-compra-box").hidden = !c;
    $("#s-q-lbl").textContent = c ? "Come pensi di rivenderla" : "Scegli come vuoi vendere";
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
  /* ---------- fonte dei prezzi di mercato ---------- */
  const CACHE = {};
  const chiaveFonte = (a) => [chiave(a.marca, a.modello), a.anno || ""].join("|");
  async function cercaMercato(forza) {
    const a = leggiAuto(); if (!ST) return;
    if (!a.marca) { ST.auto = []; ST.fonteAuto = null; ST.carico = 0; return aggiorna(); }
    const k = chiaveFonte(a), mio = ++ST.token;
    if (!forza && CACHE[k]) { applicaFonte(CACHE[k]); return aggiorna(); }
    ST.carico = 1; aggiorna();
    const cfg = (window.AP && AP.Config.cfg.mercato) || {};
    const r = await GT.Mercato.cerca({ marca: a.marca, modello: a.modello, anno: a.anno, km: a.km }, cfg, { online: X.S.online, oggi: X.oggi() });
    if (!ST || mio !== ST.token) return;                       // nel frattempo è cambiato qualcosa: questa risposta è vecchia
    r.quando = Date.now(); CACHE[k] = r;
    applicaFonte(r); aggiorna();
  }
  function applicaFonte(r) {
    ST.auto = r.annunci.slice(); ST.fonteAuto = r.fonte; ST.erroreFonte = r.errore || ""; ST.carico = 0;
    ST.esclusi = new Set();
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
    const mercato = Calc().stimaMercato({ anno: a.anno, km: a.km, comps: elenco(), esclusi: [...ST.esclusi] });
    const g = Calc().giacenza(st);
    const compra = ST.modo === "compra";
    // in «vendi» l'acquisto è il costo già sostenuto; in «compra» è il prezzo chiesto dal venditore e le spese sono quelle previste
    const costi = Calc().costiAuto({ costo_acquisto: compra ? null : a.acquisto, costi_extra: a.extra, checklist: { voci: [{ s: "da_fare", costo: ST.lavori }] } }, imp);
    const base = { mercato, costi, giorniBase: g.n >= 5 ? g.mediana : null, costoGiorno: imp.costo_giorno, trattativa: (imp.trattativa || 0) / 100, margineMin: imp.margine_min };
    const piani = Calc().APPROCCI.map((p) => ({ ...p, piano: Calc().piano({ ...base, q: p.q }), paga: Calc().pagare({ ...base, q: p.q, richiesta: compra ? a.acquisto : null }) }));
    const scelto = Calc().piano({ ...base, q: ST.q });
    const paga = Calc().pagare({ ...base, q: ST.q, richiesta: compra ? a.acquisto : null });
    return { a, mercato, costi, g, piani, scelto, paga, base, compra };
  }

  const dataIt = (iso) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "");
  function disegnaFonte(r) {
    const el = $("#s-fonte"), f = ST.fonteAuto, a = r.a;
    let h = "";
    if (ST.carico) h = '<span class="fonte-c">Cerco gli annunci simili…</span>';
    else if (!a.marca) h = '<span class="fonte-c muted">Scrivi marca e modello: i prezzi di mercato compaiono da soli.</span>';
    else if (f && f.id !== "manuale") {
      h = `<span class="chip ${f.reale ? "ok" : "ex"}">${f.reale ? "Fonte" : "Esempio"}: ${esc(f.nome)}</span> <span class="fonte-c">${ST.auto.length} annunci${f.aggiornato ? ", aggiornati al " + dataIt(f.aggiornato) : ""}.</span>`
        + (f.nota ? `<small class="fonte-n">${esc(f.nota)}</small>` : "");
    } else h = `<span class="fonte-c muted">${esc(ST.erroreFonte || "Nessuna fonte automatica collegata: la stima usa gli annunci che inserisci tu.")}</span>`;
    el.innerHTML = h;
    el.hidden = false;
    const man = $("#s-manuale");
    if (!ST.auto.length && a.marca && !ST.carico && !ST.manTocca) man.open = true;
    $("#s-ricarica").hidden = !(f && f.id !== "manuale");
    $("#s-ricarica").disabled = !!ST.carico;
  }

  function aggiorna() {
    if (!ST) return;
    const r = calcola(), { a, mercato: m } = r, compra = r.compra;
    $("#s-link").href = Calc().linkRicerca(a);
    disegnaFonte(r);
    const tutti = elenco(), tot = tutti.length, man = ST.comps.length;
    $("#s-conta").textContent = ST.carico ? "" : !tot ? "Ancora nessun annuncio." : `${tot} annunci${man ? ` (${man} inseriti da te${ST.fonte ? ", salvati il " + ST.fonte.split("-").reverse().join("/") : ""})` : ""}${m.n !== tot ? ` · ${m.n} usati per la stima` : ""}.`;
    $("#s-det").hidden = !tot;
    $("#s-det > summary").textContent = `Annunci usati (${tot}): togli quelli che non c’entrano`;
    $("#s-tab").innerHTML = "<thead><tr><th></th><th class='num'>Prezzo</th><th class='num'>Km</th><th class='num'>Anno</th><th class='num'>Corretto</th><th>Stato</th></tr></thead><tbody>" +
      m.comps.slice().sort((x, y) => x.corretto - y.corretto).map((c) => `<tr class="${c.usata ? "" : "off"}"><td><input type="checkbox" data-i="${c.i}" ${ST.esclusi.has(c.i) ? "" : "checked"} aria-label="Usa questo annuncio"></td><td class="num">${eur(c.prezzo)}</td><td class="num">${c.km != null ? TG.num(c.km) : "–"}</td><td class="num">${c.anno || "–"}</td><td class="num">${c.usata || c.motivo === "prezzo anomalo" ? eur(c.corretto) : "–"}</td><td>${esc(c.usata ? "usato" : c.motivo)}</td></tr>`).join("") + "</tbody>";

    // vendite simili
    const sim = simili(a);
    $("#s-miei").hidden = !sim.length;
    if (sim.length) {
      const pv = sim.filter((x) => x.prezzo_vendita != null).map((x) => x.prezzo_vendita), gg = sim.filter((x) => x.giorni != null).map((x) => x.giorni);
      $("#s-miei").innerHTML = `<b>Le tue vendite di ${esc(a.marca)} ${esc(a.modello)}</b>: ${sim.length} auto${pv.length ? `, venduta in media a ${eur(Calc().stat.media(pv))}` : ""}${gg.length ? `, in ${Math.round(Calc().stat.media(gg))} giorni` : ""}. <span class="muted">Sono prezzi di vendita veri, di solito più bassi di quelli di annuncio.</span>`;
    }

    const vuoto = m.affidabilita === "insufficiente";
    $("#s-vuoto").hidden = !vuoto;
    $("#s-ris").hidden = vuoto;
    $("#s-usa").disabled = vuoto;
    if (vuoto) {
      const attesa = ST.carico && a.marca;
      $("#s-vuoto").innerHTML = attesa ? "<h3>Sto cercando gli annunci…</h3><p class='muted'>Ci vuole un attimo.</p>"
        : !a.marca ? "<h3>Da dove parto?</h3><p>Scrivi marca, modello e anno dell’auto: il programma cerca gli annunci simili e mostra subito il prezzo.</p>"
        : `<h3>Mancano gli annunci di confronto</h3><p>${tot ? "Gli annunci dell’anno giusto sono troppo pochi: ne servono almeno 3 (meglio più di 10)." : "Per stimare il prezzo servono gli annunci di auto simili alla tua."}</p><p>Apri <b>Aggiungi o sostituisci con annunci tuoi</b> qui a sinistra: puoi incollare i risultati di una ricerca o caricare un file.</p>`
          + (!compra && r.costi.acquistoNoto ? `<p class="muted small">Intanto: per guadagnare almeno ${eur(X.S.imp.margine_min || 0)} dopo la trattativa del ${X.S.imp.trattativa}% non scendere sotto <b>${eur(Calc().prezzoMinimo({ costi: r.costi, margineMin: X.S.imp.margine_min, trattativa: X.S.imp.trattativa / 100 }))}</b>.</p>` : "");
      ST.ultimo = null; return;
    }
    // schede dei tre approcci
    const migliore = r.piani.filter((p) => p.piano && p.piano.guadagnoGiorno != null && p.piano.guadagnoGiorno > 0).sort((x, y) => y.piano.guadagnoGiorno - x.piano.guadagnoGiorno)[0];
    $("#s-cards").innerHTML = r.piani.map((p) => {
      const pi = p.piano, pg = p.paga, att = Math.abs(ST.q - p.q) < 0.02;
      if (compra) return `<button type="button" class="st-card ${att ? "on" : ""}" data-q="${p.q}" aria-pressed="${att}">
  <span class="st-n">${esc(p.nome)}</span><b class="st-p">${eurH(pg.massimo)}</b>
  <span class="st-m">al massimo · rivendi a ${eur(pi.prezzo)}${pi.giorni != null ? " in circa " + pi.giorni + " giorni" : ""}</span>
</button>`;
      return `<button type="button" class="st-card ${att ? "on" : ""}" data-q="${p.q}" aria-pressed="${att}">
  <span class="st-n">${esc(p.nome)}</span><b class="st-p">${eurH(pi.prezzo)}</b>
  <span class="st-m">${pi.giorni != null ? "circa " + pi.giorni + " giorni" : "tempo non stimabile"}</span>
  <span class="st-g ${pi.guadagno < 0 ? "late" : ""}">${r.costi.acquistoNoto ? "guadagno " + eur(pi.guadagno) : esc(p.breve)}</span>
  ${migliore && migliore.id === p.id && r.costi.acquistoNoto ? '<span class="st-best">Più redditizio al giorno</span>' : ""}
</button>`;
    }).join("");
    const s = r.scelto;
    ST.ultimo = s;
    $("#s-qtxt").innerHTML = `Rivendendo a <b>${eur(s.prezzo)}</b> sei più economico del <b>${pct(s.piuEconomicoDi)}</b> degli annunci simili.`;
    $("#s-grafico").innerHTML = grafico(r);
    $("#s-note").innerHTML = `<b>Affidabilità ${esc(m.affidabilita)}</b>: ${m.n} annunci${m.tolleranza ? ` dell’anno ${a.anno ? a.anno - m.tolleranza + "-" + (a.anno + m.tolleranza) : ""}` : ""}, da ${eur(m.stat.min)} a ${eur(m.stat.max)}, la metà tra ${eur(m.stat.p25)} e ${eur(m.stat.p75)}.` + m.note.map((n) => " " + esc(n)).join("");

    if (compra) { disegnaPagare(r); return; }
    // costi e guadagno
    const c = r.costi, righe = [];
    const R = (t, v, cls) => righe.push(`<div class="st-r ${cls || ""}"><dt>${t}</dt><dd>${v}</dd></div>`);
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

  /* quanto pagare: tre livelli (apertura, obiettivo, massimo), come ci si arriva e, se c'è, il giudizio sul prezzo chiesto */
  function disegnaPagare(r) {
    const g = r.paga, imp = X.S.imp, c = r.costi;
    if (!g) { $("#s-compra").innerHTML = ""; return; }
    const lvl = (cls, titolo, v, nota) => `<div class="pg-l ${cls}"><span>${titolo}</span><b>${eurH(v)}</b><small>${nota}</small></div>`;
    let verdetto = "";
    if (g.richiesta != null) {
      const testo = g.verdetto === "ottimo" ? `Ti chiedono <b>${eur(g.richiesta)}</b>: è sotto il tuo obiettivo. Se l’auto è davvero come dice l’annuncio, conviene.`
        : g.verdetto === "trattabile" ? `Ti chiedono <b>${eur(g.richiesta)}</b>: va bene solo se scendi verso ${eur(g.obiettivo)}; oltre ${eur(g.massimo)} non resta il margine minimo.`
        : `Ti chiedono <b>${eur(g.richiesta)}</b>: è troppo. Per tenere il margine minimo devi ottenere almeno <b>${eur(g.scontoNecessario)}</b> di sconto (${pct(g.scontoPercento, 1)}), oppure lasciar perdere.`;
      verdetto = `<p class="pg-v ${g.verdetto}" role="status"><b>${g.verdetto === "ottimo" ? "Conviene" : g.verdetto === "trattabile" ? "Da trattare" : "Troppo caro"}.</b> ${testo}</p>`;
    }
    const ness = g.nonConviene ? `<p class="pg-v caro" role="status"><b>Non conviene a nessun prezzo.</b> Con questi costi e questo prezzo di rivendita non resta il margine minimo nemmeno regalata. Prova a ridurre i lavori previsti o a cambiare approccio.</p>` : "";
    const righe = [];
    const R = (t, v, cls) => righe.push(`<div class="st-r ${cls || ""}"><dt>${t}</dt><dd>${v}</dd></div>`);
    R("Prezzo a cui la rivendi", eur(g.prezzoVendita));
    R(`Dopo la trattativa (−${imp.trattativa}%)`, eur(g.chiuso));
    if (c.extra || c.lavori) R("Lavori e costi previsti", "− " + eur(c.extra + c.lavori), "costo");
    if (c.vendita) R("Costi di vendita", "− " + eur(c.vendita), "costo");
    if (g.giacenza) R(`Giacenza (${g.giorni} giorni × ${eur(imp.costo_giorno)})`, "− " + eur(g.giacenza), "costo");
    R("Guadagno minimo che vuoi", "− " + eur(g.margineMin), "costo");
    R("Massimo da pagare", `<b>${eur(g.massimo)}</b>`, "gain");
    $("#s-compra").innerHTML = ness + verdetto +
      `<div class="pg-liv">${lvl("ap", "Apri con", g.apertura, "guadagno previsto " + eur(g.lordo - g.apertura))}${lvl("ob", "Punta a", g.obiettivo, "guadagno previsto " + eur(g.lordo - g.obiettivo))}${lvl("mx", "Non oltre", g.massimo, "guadagno previsto " + eur(g.lordo - g.massimo))}</div>`
      + `<h3 class="st-h">Come ci arrivo</h3><dl class="st-conti">${righe.join("")}</dl>`
      + `<p class="small muted">Apertura e obiettivo sono una regola pratica (2× e 1,5× il guadagno minimo). Il prezzo di rivendita dipende dall’approccio scelto qui sopra.</p>`;
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
    const cerca = (() => { let tm; return () => { clearTimeout(tm); tm = setTimeout(() => cercaMercato(), 450); }; })();
    ["s-marca", "s-modello", "s-anno", "s-km", "s-acq", "s-extra"].forEach((id) => $("#" + id).addEventListener("input", (e) => {
      if ((id === "s-marca" || id === "s-modello") && ST) { const k = chiave($("#s-marca").value, $("#s-modello").value); const sv = salvati()[k]; if (sv && !ST.comps.length) { ST.comps = sv.annunci.slice(); ST.fonte = sv.data; } }
      if (["s-marca", "s-modello", "s-anno"].includes(id)) cerca();
      rid();
    }));
    $("#s-m-vendi").onclick = () => { if (ST && ST.modo !== "vendi") { ST.modo = "vendi"; impostaModo(); aggiorna(); } };
    $("#s-m-compra").onclick = () => { if (ST && ST.modo !== "compra") { ST.modo = "compra"; impostaModo(); aggiorna(); } };
    $("#s-ricarica").onclick = () => { delete CACHE[chiaveFonte(leggiAuto())]; cercaMercato(true); };
    $("#s-manuale > summary").addEventListener("click", () => { if (ST) ST.manTocca = true; });
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
    $("#s-svuota").onclick = () => { ST.comps = []; ST.esclusi = new Set(); ST.fonte = ""; memorizza(); aggiorna(); };   // cancella solo gli annunci inseriti a mano
    $("#s-tab").addEventListener("change", (e) => { const i = e.target.dataset.i; if (i == null) return; if (e.target.checked) ST.esclusi.delete(+i); else ST.esclusi.add(+i); aggiorna(); });
    $("#s-cards").addEventListener("click", (e) => { const b = e.target.closest("[data-q]"); if (!b) return; ST.q = +b.dataset.q; $("#s-q").value = Math.round(ST.q * 100); aggiorna(); });
    $("#s-q").addEventListener("input", (e) => { ST.q = +e.target.value / 100; aggiorna(); });
    $("#s-usa").onclick = () => {
      if (!ST || !ST.ultimo || !ST.onUsa) return;
      ST.onUsa(ST.ultimo.prezzo); $("#d-stima").close(); X.toast("Prezzo impostato: " + eur(ST.ultimo.prezzo) + ".");
    };
    let tm; window.addEventListener("resize", () => { if ($("#d-stima").open) { clearTimeout(tm); tm = setTimeout(aggiorna, 150); } });
  }

  GT.Stima = { init, apri, quantoPagare: () => apri({ modo: "compra", valori: {}, lavori: 0 }) };
})();
