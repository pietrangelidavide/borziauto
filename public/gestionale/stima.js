/* Borzi Auto · quanto vendere e quanto pagare.
   Due risposte nella stessa schermata, dagli stessi dati:
     - VENDILA A…     il prezzo di vendita per tre approcci (in fretta · equilibrato · margine) e il guadagno che ne esce;
     - PAGALA AL MASSIMO…   quanto si può pagare un'auto per rivenderla con il guadagno minimo voluto, e se il prezzo chiesto va bene.
   Il prezzo di mercato compare da solo: arriva dalla «stima di riferimento» (catalogo.js: listino × svalutazione × km),
   che non legge nessun portale. Se il titolare inserisce almeno 6 annunci veri, o collega una fonte autorizzata (mercato.js),
   la stima passa a quelli. Con le vendite già fatte dal garage la stima di riferimento si corregge da sola.
   È una stima, non una valutazione ufficiale. */
(function () {
  "use strict";
  const GT = (window.GT = window.GT || {});
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => TG.esc(s);
  const Calc = () => GT.Calc;
  const Cat = () => AP.Catalogo;
  const MIN_ANNUNCI = 6;                 // da qui in su gli annunci veri sostituiscono la stima di riferimento
  let X = null;          // contesto: { S, salva, toast, apri, oggi, titolo, numero, ridisegna }
  let ST = null;         // { id, onUsa, auto[] (dalla fonte), comps[] (inseriti a mano), esclusi:Set, q, … }

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
  const eur = (n) => (n == null || !isFinite(n) ? "–" : (n < 0 ? "−" : "") + TG.euro(Math.round(Math.abs(n))).replace(" ", " "));
  const eurH = (n) => (n == null || !isFinite(n) ? "–" : (n < 0 ? "−" : "") + TG.euroHtml(Math.round(Math.abs(n))));
  const pct = (x, d = 0) => (x == null || !isFinite(x) ? "–" : (x * 100).toFixed(d).replace(".", ",") + "%");
  const num = (v) => { const n = X.numero(v); return n == null || !isFinite(n) ? null : n; };

  const leggiAuto = () => ({
    marca: $("#s-marca").value.trim(), modello: $("#s-modello").value.trim(), anno: num($("#s-anno").value), km: num($("#s-km").value),
    alimentazione: $("#s-alim").value, cambio: $("#s-cambio").value,
    acquisto: num($("#s-acq").value), extra: num($("#s-extra").value),
  });

  /* ---------- storia dell'azienda (per tempi di vendita, vendite simili e correzione della stima) ---------- */
  const storia = () => Calc().storia(X.S.auto, X.S.storico);
  function simili(a) {
    const k = chiave(a.marca, a.modello);
    return storia().filter((r) => chiave(r.marca, r.modello) === k && (!a.anno || !r.anno || Math.abs(r.anno - a.anno) <= 2));
  }
  const calibrazione = () => Cat().calibra(storia(), { trattativa: (X.S.imp.trattativa || 0) / 100, oggi: X.oggi() });

  /* Prezzo di riferimento di un'auto del garage, per confrontarlo con quello in vetrina (usato da elenco e riepilogo). */
  function riferimento(a) {
    if (!X || !a || !a.marca || !a.anno) return null;
    const v = Cat().valore(a, { oggi: X.oggi(), calibrazione: calibrazione() });
    if (!v) return null;
    const diff = a.prezzo != null && a.prezzo > 0 ? a.prezzo / v.valore - 1 : null;
    return { valore: v.valore, diff, stato: diff == null ? "" : diff > 0.1 ? "sopra" : diff < -0.1 ? "sotto" : "in linea", incerto: !v.noto };
  }

  const elenco = () => ST.auto.concat(ST.comps);        // gli indici di «esclusi» valgono su questo elenco

  /* ---------- apertura ---------- */
  function apri(o) {
    const v = o.valori || {};
    ST = { id: o.id || null, onUsa: o.onUsa, auto: [], comps: [], esclusi: new Set(), q: 0.5, lavori: o.lavori || 0, prezzoAttuale: v.prezzo == null ? null : v.prezzo, fonte: "", fonteAuto: null, carico: 0, token: 0, focus: o.modo === "compra" ? "compra" : "vendi" };
    $("#s-marca").value = v.marca || ""; $("#s-modello").value = v.modello || "";
    $("#s-anno").value = v.anno == null ? "" : v.anno; $("#s-km").value = v.km == null ? "" : v.km;
    $("#s-alim").value = v.alimentazione || ""; $("#s-cambio").value = v.cambio || "";
    $("#s-acq").value = v.costo_acquisto == null ? "" : v.costo_acquisto; $("#s-extra").value = v.costi_extra == null ? "" : v.costi_extra;
    const imp = X.S.imp;
    $("#s-trat").value = imp.trattativa; $("#s-cvend").value = imp.costi_vendita || ""; $("#s-cgiorno").value = imp.costo_giorno || ""; $("#s-mmin").value = imp.margine_min || "";
    $("#s-incolla").value = ""; $("#s-q").value = 50;
    $("#s-manuale").open = false; ST.manTocca = false;
    $("#d-stima").dataset.focus = ST.focus;
    $("#s-ctl").hidden = ST.focus !== "compra"; ctlTesto();
    $("#s-acq-l").firstChild.nodeValue = ST.focus === "compra" ? "Prezzo che ti chiedono (€)" : "Prezzo di acquisto: pagato o richiesto (€)";
    caricaSalvati();
    modelliPer($("#s-marca").value);
    X.apri($("#d-stima"));
    cercaMercato();            // se c'è una fonte collegata la interroga; altrimenti resta la stima di riferimento
    aggiorna();
  }
  /* controlli all'acquisto: servono a capire quanto mettere nei costi extra, prima ancora di comprare (non salvano nessuna auto) */
  function ctlTesto() {
    const p = GT.Check.preventivo({ checklist: ST && ST.checklist });
    $("#s-ctl-b").textContent = p.fatta ? "Rivedi i controlli" : "Fai i controlli";
    $("#s-ctl-t").textContent = !p.fatta ? "Passa in rassegna l’auto: i lavori che servono ti dicono quanto mettere nei costi extra."
      : p.daFare ? `${p.daFare} ${p.daFare === 1 ? "lavoro" : "lavori"} da fare, ${eur(p.totale)}: già nei costi extra.` : "Nessun lavoro da fare.";
  }
  function apriControlli() {
    const a = leggiAuto();
    GT.Check.apri({ id: "", marca: a.marca, modello: a.modello, anno: a.anno, km: a.km, checklist: ST.checklist || null, costi_extra: a.extra }, {
      acquisto: true, senzaAuto: true,
      dopo: (c) => { ST.checklist = c.checklist; $("#s-extra").value = c.costi_extra == null ? "" : c.costi_extra; $("#s-extra").dispatchEvent(new Event("input", { bubbles: true })); ctlTesto(); },
    });
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
  /* i modelli suggeriti per la marca scritta */
  function modelliPer(marca) {
    const m = Cat().marca(marca), dl = $("#l-modelli-s");
    dl.innerHTML = m ? Cat().modelli(m).map((x) => `<option value="${esc(x.nome)}">`).join("") : "";
  }

  /* ---------- fonte esterna dei prezzi (facoltativa: feed autorizzato) ---------- */
  const CACHE = {};
  const chiaveFonte = (a) => [chiave(a.marca, a.modello), a.anno || ""].join("|");
  async function cercaMercato(forza) {
    const a = leggiAuto(); if (!ST) return;
    if (!a.marca) { ST.auto = []; ST.fonteAuto = null; ST.carico = 0; return aggiorna(); }
    const cfg = (window.AP && AP.Config.cfg.mercato) || {};
    const conFeed = cfg.fonte === "feed" || (cfg.fonte === "auto" && X.S.online);          // senza feed collegato non c'è niente da cercare
    if (!conFeed) { ST.auto = []; ST.fonteAuto = null; ST.erroreFonte = ""; ST.carico = 0; return aggiorna(); }
    const k = chiaveFonte(a), mio = ++ST.token;
    if (!forza && CACHE[k]) { applicaFonte(CACHE[k]); return aggiorna(); }
    ST.carico = 1; aggiorna();
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

  /* ---------- calcolo ---------- */
  function calcola() {
    const a = leggiAuto(), imp = X.S.imp, st = storia();
    const reale = Calc().stimaMercato({ anno: a.anno, km: a.km, comps: elenco(), esclusi: [...ST.esclusi] });
    let mercato = reale, origine = "annunci", cal = null;
    if (reale.n < MIN_ANNUNCI && a.marca && a.anno) {
      cal = calibrazione();
      const rif = Cat().mercato(a, { oggi: X.oggi(), calibrazione: cal });
      if (rif) { mercato = rif; origine = "riferimento"; }
    }
    const g = Calc().giacenza(st);
    const costi = Calc().costiAuto({ costo_acquisto: a.acquisto, costi_extra: a.extra, checklist: { voci: [{ s: "da_fare", costo: ST.lavori }] } }, imp);
    const base = { mercato, costi, giorniBase: g.n >= 5 ? g.mediana : null, costoGiorno: imp.costo_giorno, trattativa: (imp.trattativa || 0) / 100, margineMin: imp.margine_min };
    const richiesta = a.acquisto;
    const piani = Calc().APPROCCI.map((p) => ({ ...p, piano: Calc().piano({ ...base, q: p.q }), paga: Calc().pagare({ ...base, q: p.q, richiesta }) }));
    const scelto = Calc().piano({ ...base, q: ST.q });
    const paga = Calc().pagare({ ...base, q: ST.q, richiesta });
    return { a, mercato, origine, cal, reale, costi, g, piani, scelto, paga, base, richiesta };
  }

  const dataIt = (iso) => (iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "");

  /* riga sotto i due prezzi: da dove arrivano */
  function disegnaFonte(r) {
    const el = $("#s-fonte"), f = ST.fonteAuto, a = r.a;
    let h = "";
    if (ST.carico) h = '<span class="fonte-c">Cerco gli annunci simili…</span>';
    else if (!a.marca) h = '<span class="fonte-c muted">Scrivi marca e modello: i prezzi compaiono da soli.</span>';
    else if (r.origine === "annunci") {
      const n = r.mercato.n, man = ST.comps.length;
      h = f && f.id !== "manuale" && ST.auto.length
        ? `<span class="chip ${f.reale ? "ok" : "ex"}">${f.reale ? "Fonte" : "Esempio"}: ${esc(f.nome)}</span> <span class="fonte-c">${ST.auto.length} annunci${f.aggiornato ? ", aggiornati al " + dataIt(f.aggiornato) : ""}${man ? ` + ${man} inseriti da te` : ""}.</span>`
        : `<span class="chip ok">Annunci veri</span> <span class="fonte-c">${n} annunci inseriti da te${ST.fonte ? ", salvati il " + dataIt(ST.fonte) : ""}.</span>`;
      if (f && f.nota) h += `<small class="fonte-n">${esc(f.nota)}</small>`;
    } else {
      const d = r.mercato.dettaglio, tot = ST.auto.length + ST.comps.length;
      h = `<span class="chip ex">Stima di riferimento</span> <span class="fonte-c">Calcolata da marca, modello, anno e chilometri: <b>±${Math.round(d.sigma * 67)}%</b> tra i prezzi più bassi e più alti dei simili.${r.cal && r.cal.attiva ? ` Corretta sulle tue ${r.cal.n} vendite (${r.cal.fattore > 1 ? "+" : ""}${((r.cal.fattore - 1) * 100).toFixed(0).replace("-", "−")}%).` : ""}</span>`
        + `<small class="fonte-n">Non viene da nessun portale di annunci. ${tot ? `Hai inserito ${tot} annunci: ne servono ${MIN_ANNUNCI} per sostituire la stima. ` : ""}Per renderla più precisa apri <b>Affina con annunci veri</b> qui sotto.${d.note.length ? " " + esc(d.note.join(" ")) : ""}</small>`;
    }
    el.innerHTML = h; el.hidden = false;
    const man = $("#s-manuale");
    $("#s-ricarica").hidden = !(f && f.id !== "manuale");
    $("#s-ricarica").disabled = !!ST.carico;
    $("#s-man-t").textContent = r.origine === "annunci" ? "Aggiungi o cambia gli annunci veri" : "Affina con annunci veri (facoltativo)";
    if (!man.open && ST.manTocca) man.open = true;
  }

  function aggiorna() {
    if (!ST) return;
    const r = calcola(), { a, mercato: m } = r;
    $("#s-link").href = Calc().linkRicerca(a);
    const mm = Cat().marca(a.marca);
    const logo = $("#s-logo");
    if (mm) { logo.src = Cat().logo(mm, "../"); logo.alt = mm.nome; logo.hidden = false; } else logo.hidden = true;
    $("#s-auto").textContent = [a.marca, a.modello, a.anno, a.km != null ? TG.num(a.km) + " km" : ""].filter(Boolean).join(" · ") || "Scrivi i dati dell’auto";
    disegnaFonte(r);

    // annunci inseriti o trovati
    const tutti = elenco(), tot = tutti.length, man = ST.comps.length;
    const real = r.reale;
    $("#s-conta").textContent = ST.carico ? "" : !tot ? "" : `${tot} annunci${man ? ` (${man} inseriti da te${ST.fonte ? ", salvati il " + dataIt(ST.fonte) : ""})` : ""}${real.n !== tot ? ` · ${real.n} usati per la stima` : ""}.`;
    $("#s-det").hidden = !tot;
    $("#s-det > summary").textContent = `Annunci usati (${tot}): togli quelli che non c’entrano`;
    $("#s-tab").innerHTML = "<thead><tr><th></th><th class='num'>Prezzo</th><th class='num'>Km</th><th class='num'>Anno</th><th class='num'>Corretto</th><th>Stato</th></tr></thead><tbody>" +
      real.comps.slice().sort((x, y) => x.corretto - y.corretto).map((c) => `<tr class="${c.usata ? "" : "off"}"><td><input type="checkbox" data-i="${c.i}" ${ST.esclusi.has(c.i) ? "" : "checked"} aria-label="Usa questo annuncio"></td><td class="num">${eur(c.prezzo)}</td><td class="num">${c.km != null ? TG.num(c.km) : "–"}</td><td class="num">${c.anno || "–"}</td><td class="num">${c.usata || c.motivo === "prezzo anomalo" ? eur(c.corretto) : "–"}</td><td>${esc(c.usata ? "usato" : c.motivo)}</td></tr>`).join("") + "</tbody>";

    // vendite simili del garage
    const sim = simili(a);
    $("#s-miei").hidden = !sim.length;
    if (sim.length) {
      const pv = sim.filter((x) => x.prezzo_vendita != null).map((x) => x.prezzo_vendita), gg = sim.filter((x) => x.giorni != null).map((x) => x.giorni);
      $("#s-miei").innerHTML = `<b>Le tue vendite di ${esc(a.marca)} ${esc(a.modello)}</b>: ${sim.length} auto${pv.length ? `, venduta in media a ${eur(Calc().stat.media(pv))}` : ""}${gg.length ? `, in ${Math.round(Calc().stat.media(gg))} giorni` : ""}. <span class="muted">Sono prezzi di vendita veri, di solito più bassi di quelli di annuncio.</span>`;
    }

    const manca = !m || m.affidabilita === "insufficiente";
    $("#s-vuoto").hidden = !manca; $("#s-ris").hidden = manca;
    $("#s-usa").hidden = manca || !ST.onUsa; $("#s-usa").disabled = manca;
    if (manca) {
      const attesa = ST.carico && a.marca;
      $("#s-vuoto").innerHTML = attesa ? "<h3>Sto cercando gli annunci…</h3><p class='muted'>Ci vuole un attimo.</p>"
        : !a.marca ? "<h3>Scrivi l’auto, i prezzi arrivano da soli</h3><p>Basta marca, modello, anno e chilometri: compaiono subito il prezzo a cui venderla e il massimo da pagare.</p>"
        : !a.anno ? "<h3>Manca l’anno</h3><p>Scrivi l’anno di immatricolazione: serve a stimare quanto vale oggi.</p>"
        : "<h3>Non riesco a stimare questa auto</h3><p>Controlla marca, modello e anno.</p>";
      ST.ultimo = null; return;
    }
    // le due risposte
    const s = r.scelto, g = r.paga, c = r.costi, imp = X.S.imp, nome = r.piani.find((p) => Math.abs(p.q - ST.q) < 0.02);
    ST.ultimo = s;
    const gg = s.giorni != null ? ` · circa ${s.giorni} giorni` : "";
    $("#s-v-prezzo").innerHTML = eurH(s.prezzo);
    $("#s-v-sub").textContent = `Tra ${eur(m.prezzoA(0.25))} e ${eur(m.prezzoA(0.75))} sul mercato${gg}`;
    $("#s-v-gain").className = "st-gain" + (c.acquistoNoto && s.guadagno < 0 ? " late" : "");
    $("#s-v-gain").innerHTML = c.acquistoNoto ? `${s.guadagno < 0 ? "Ci perdi" : "Ci guadagni"} <b>${eur(Math.abs(s.guadagno))}</b> dopo la trattativa` : "Scrivi quanto l’hai pagata per vedere il guadagno";
    $("#s-c-prezzo").innerHTML = g ? eurH(g.massimo) : "–";
    $("#s-c-sub").innerHTML = !g ? "" : g.nonConviene ? "<b class='late'>Non conviene a nessun prezzo</b> con questi costi" : `Apri a ${eur(g.apertura)} · punta a ${eur(g.obiettivo)}`;
    const ver = $("#s-c-verdetto");
    if (g && g.richiesta != null && !g.nonConviene) {
      ver.hidden = false; ver.className = "st-ver " + g.verdetto;
      ver.innerHTML = g.verdetto === "ottimo" ? `<b>Conviene.</b> ${eur(g.richiesta)} è sotto il tuo obiettivo.`
        : g.verdetto === "trattabile" ? `<b>Da trattare.</b> ${eur(g.richiesta)} va bene solo se scendi verso ${eur(g.obiettivo)}.`
        : `<b>Troppo caro.</b> Chiedi almeno ${eur(g.scontoNecessario)} di sconto (${pct(g.scontoPercento, 1)}), oppure lascia perdere.`;
    } else { ver.hidden = true; ver.textContent = ""; }

    // approcci
    const migliore = r.piani.filter((p) => p.piano && p.piano.guadagnoGiorno != null && p.piano.guadagnoGiorno > 0).sort((x, y) => y.piano.guadagnoGiorno - x.piano.guadagnoGiorno)[0];
    $("#s-cards").innerHTML = r.piani.map((p) => {
      const pi = p.piano, att = Math.abs(ST.q - p.q) < 0.02;
      return `<button type="button" class="st-card ${att ? "on" : ""}" data-q="${p.q}" aria-pressed="${att}">
  <span class="st-n">${esc(p.nome)}</span><b class="st-p">${eurH(pi.prezzo)}</b>
  <span class="st-m">${pi.giorni != null ? "circa " + pi.giorni + " giorni" : esc(p.breve)}</span>
  ${migliore && migliore.id === p.id && c.acquistoNoto ? '<span class="st-best">Più redditizio al giorno</span>' : ""}
</button>`;
    }).join("");
    $("#s-qtxt").innerHTML = `Con <b>${esc(nome ? nome.nome.toLowerCase() : "questo")}</b> la vendi a <b>${eur(s.prezzo)}</b>: costa meno del <b>${pct(s.piuEconomicoDi)}</b> delle auto simili.` + (ST.prezzoAttuale ? ` Ora in vetrina è a <b>${eur(ST.prezzoAttuale)}</b>.` : "");
    $("#s-grafico").innerHTML = m.modello ? graficoRange(r) : grafico(r);
    $("#s-note").innerHTML = m.modello
      ? `<b>Stima di riferimento</b>, non annunci veri: prezzi da ${eur(m.stat.min)} a ${eur(m.stat.max)}, la metà tra ${eur(m.stat.p25)} e ${eur(m.stat.p75)}.`
      : `<b>Affidabilità ${esc(m.affidabilita)}</b>: ${m.n} annunci${m.tolleranza ? ` dell’anno ${a.anno ? a.anno - m.tolleranza + "-" + (a.anno + m.tolleranza) : ""}` : ""}, da ${eur(m.stat.min)} a ${eur(m.stat.max)}, la metà tra ${eur(m.stat.p25)} e ${eur(m.stat.p75)}.` + m.note.map((n) => " " + esc(n)).join("");

    // come ci arrivo: guadagno se vendi, massimo se compri
    const righe = [], R = (t, v, cls) => righe.push(`<div class="st-r ${cls || ""}"><dt>${t}</dt><dd>${v}</dd></div>`);
    R("Prezzo di annuncio", eur(s.prezzo));
    R(`Dopo la trattativa (−${imp.trattativa}%)`, eur(s.chiuso));
    R("Costo di acquisto", c.acquistoNoto ? eur(c.acquisto) : '<span class="late">non inserito</span>', "costo");
    if (c.extra) R("Spese già sostenute", eur(c.extra), "costo");
    if (c.lavori) R("Lavori da fare (controlli)", eur(c.lavori), "costo");
    if (c.vendita) R("Costi di vendita", eur(c.vendita), "costo");
    if (s.giacenza) R(`Giacenza (${s.giorni} giorni × ${eur(imp.costo_giorno)})`, eur(s.giacenza), "costo");
    if (c.acquistoNoto) {
      R("Costi totali", eur(s.costiTotali), "tot");
      R("Guadagno ipotetico", `<b class="${s.guadagno < 0 ? "late" : "ok"}">${eur(s.guadagno)}</b>${s.margineSuCosti != null ? ` <small>(${pct(s.margineSuCosti, 1)} sui costi)</small>` : ""}`, "gain");
      if (s.guadagnoGiorno != null) R("Guadagno al giorno in garage", eur(s.guadagnoGiorno), "");
      R(`Prezzo minimo per guadagnare almeno ${eur(imp.margine_min || 0)}`, eur(Calc().prezzoMinimo({ costi: { diretti: c.diretti + s.giacenza }, margineMin: imp.margine_min, trattativa: imp.trattativa / 100 })), "");
    } else R("Guadagno ipotetico", "scrivi il costo di acquisto", "gain");
    $("#s-conti").innerHTML = righe.join("");
    $("#s-compra").innerHTML = disegnaPagare(r);
    $("#s-usa").textContent = "Usa " + eur(s.prezzo) + " come prezzo";
  }

  /* quanto pagare: come ci si arriva */
  function disegnaPagare(r) {
    const g = r.paga, imp = X.S.imp, c = r.costi;
    if (!g) return "";
    const righe = [], R = (t, v, cls) => righe.push(`<div class="st-r ${cls || ""}"><dt>${t}</dt><dd>${v}</dd></div>`);
    R("Prezzo a cui la rivendi", eur(g.prezzoVendita));
    R(`Dopo la trattativa (−${imp.trattativa}%)`, eur(g.chiuso));
    if (c.extra || c.lavori) R("Lavori e spese previste", "− " + eur(c.extra + c.lavori), "costo");
    if (c.vendita) R("Costi di vendita", "− " + eur(c.vendita), "costo");
    if (g.giacenza) R(`Giacenza (${g.giorni} giorni × ${eur(imp.costo_giorno)})`, "− " + eur(g.giacenza), "costo");
    R("Guadagno minimo che vuoi", "− " + eur(g.margineMin), "costo");
    R("Massimo da pagare", `<b>${eur(g.massimo)}</b>`, "gain");
    return `<dl class="st-conti">${righe.join("")}</dl><p class="small muted">«Apri a» e «punta a» lasciano più margine del minimo (2× e 1,5× il guadagno minimo): è una regola pratica. Il prezzo di rivendita dipende dall’approccio scelto sopra.</p>`;
  }

  /* ---------- grafici ---------- */
  const bello = (x) => { const e = Math.pow(10, Math.floor(Math.log10(x))), f = x / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e; };
  /* stima di riferimento: una barra con la fascia in cui cade la metà delle auto simili, i tre approcci e il prezzo attuale */
  function graficoRange(r) {
    const el = $("#s-grafico"), W = Math.max(300, Math.min(760, el.clientWidth || 560)), m = r.mercato, s = r.scelto;
    const attuale = ST.prezzoAttuale;
    const lo = Math.min(m.stat.min, s.prezzo, attuale || Infinity), hi = Math.max(m.stat.max, s.prezzo, attuale || 0), pad = (hi - lo) * 0.06;
    const x0 = lo - pad, x1 = hi + pad, ml = 14, mr = 14, X_ = (p) => ml + ((p - x0) / (x1 - x0)) * (W - ml - mr);
    const y = 54, h = 26, H = 138;
    let t = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Dove cadono i prezzi: la metà delle auto simili costa tra ${eur(m.stat.p25)} e ${eur(m.stat.p75)}.">`;
    t += `<rect x="${X_(m.stat.min).toFixed(1)}" y="${y}" width="${(X_(m.stat.max) - X_(m.stat.min)).toFixed(1)}" height="${h}" class="g-fascia"/>`;
    t += `<rect x="${X_(m.stat.p25).toFixed(1)}" y="${y}" width="${Math.max(2, X_(m.stat.p75) - X_(m.stat.p25)).toFixed(1)}" height="${h}" class="g-meta"/>`;
    t += `<line x1="${X_(m.stat.mediana).toFixed(1)}" x2="${X_(m.stat.mediana).toFixed(1)}" y1="${y - 4}" y2="${y + h + 4}" class="g-med"/>`;
    [[m.stat.min, "start"], [m.stat.max, "end"]].forEach(([p, an]) => { t += `<text x="${X_(p).toFixed(1)}" y="${y + h + 18}" class="g-tx" text-anchor="${an === "start" ? "start" : "end"}">${eur(p)}</text>`; });
    // i tre approcci sopra la barra
    const eti = r.piani.map((p) => ({ x: X_(p.piano.prezzo), n: p.id === "fretta" ? "In fretta" : p.id === "margine" ? "Margine" : "Equilibrato" }));
    eti.forEach((e, i) => { const riga = i === 1 && (e.x - eti[0].x < 64 || eti[2].x - e.x < 64) ? 0 : 1; t += `<line x1="${e.x.toFixed(1)}" x2="${e.x.toFixed(1)}" y1="${y - 4 - (riga ? 0 : 14)}" y2="${y}" class="g-ass"/><circle cx="${e.x.toFixed(1)}" cy="${y - 4 - (riga ? 0 : 14)}" r="3" class="g-app"/><text x="${e.x.toFixed(1)}" y="${y - 10 - (riga ? 0 : 14)}" class="g-tx" text-anchor="middle">${e.n}</text>`; });
    // prezzo scelto e prezzo attuale
    const sx = X_(s.prezzo).toFixed(1);
    t += `<line x1="${sx}" x2="${sx}" y1="${y + h}" y2="${y + h + 36}" class="g-sel"/><circle cx="${sx}" cy="${y + h + 36}" r="4.5" class="g-seld"/>`;
    if (attuale) { const ax = X_(attuale).toFixed(1); t += `<path d="M${ax} ${y + h + 2}l-5 9h10z" class="g-att"/><text x="${ax}" y="${y + h + 34}" class="g-tx2" text-anchor="${ax > W - 80 ? "end" : "middle"}">ora ${eur(attuale)}</text>`; }
    return t + "</svg>";
  }
  /* annunci veri: dove cade il prezzo scelto tra gli annunci (prezzi corretti per i km) */
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
    const eti = r.piani.map((p) => ({ x: X_(p.piano.prezzo), n: p.id === "fretta" ? "In fretta" : p.id === "margine" ? "Margine" : "Equilibrato" }));
    eti.forEach((e, i) => { const riga = i === 1 && (e.x - eti[0].x < 56 || eti[2].x - e.x < 56) ? 1 : 0; t += `<line x1="${e.x.toFixed(1)}" x2="${e.x.toFixed(1)}" y1="${base + 22}" y2="${base + 27 + riga * 12}" class="g-ass"/><text x="${e.x.toFixed(1)}" y="${base + 38 + riga * 12}" class="g-tx" text-anchor="middle">${e.n}</text>`; });
    const sx = X_(s.prezzo).toFixed(1), ancora = sx < 70 ? "start" : sx > W - 70 ? "end" : "middle";
    t += `<line x1="${sx}" x2="${sx}" y1="${top - 4}" y2="${base}" class="g-sel"/><circle cx="${sx}" cy="${top - 4}" r="4.5" class="g-seld"/><text x="${sx}" y="${top - 12}" class="g-tx2" text-anchor="${ancora}">${eur(s.prezzo)}</text>`;
    return t + "</svg>";
  }

  /* ---------- eventi ---------- */
  function init(ctx) {
    X = ctx;
    $("#l-marche-s").innerHTML = Cat().MARCHE.map((m) => `<option value="${esc(m.nome)}">`).join("");
    const rid = (() => { let tm; return () => { clearTimeout(tm); tm = setTimeout(aggiorna, 90); }; })();
    const cerca = (() => { let tm; return () => { clearTimeout(tm); tm = setTimeout(() => cercaMercato(), 450); }; })();
    ["s-marca", "s-modello", "s-anno", "s-km", "s-alim", "s-cambio", "s-acq", "s-extra"].forEach((id) => $("#" + id).addEventListener(id === "s-alim" || id === "s-cambio" ? "change" : "input", () => {
      if (id === "s-marca") modelliPer($("#s-marca").value);
      if ((id === "s-marca" || id === "s-modello") && ST) { const k = chiave($("#s-marca").value, $("#s-modello").value); const sv = salvati()[k]; if (sv && !ST.comps.length) { ST.comps = sv.annunci.slice(); ST.fonte = sv.data; } }
      if (["s-marca", "s-modello", "s-anno"].includes(id)) cerca();
      rid();
    }));
    $("#s-ctl-b").onclick = apriControlli;
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

  /* calcolo senza interfaccia, per il modulo di inserimento: prezzi e massimo da pagare per i dati dati */
  function rapido(a, costi) {
    if (!X || !a || !a.marca || !a.anno) return null;
    const imp = X.S.imp, st = storia(), cal = calibrazione();
    const mercato = Cat().mercato(a, { oggi: X.oggi(), calibrazione: cal });
    if (!mercato) return null;
    const g = Calc().giacenza(st);
    const c = Calc().costiAuto({ costo_acquisto: costi && costi.acquisto, costi_extra: costi && costi.extra, checklist: { voci: [{ s: "da_fare", costo: (costi && costi.lavori) || 0 }] } }, imp);
    const base = { mercato, costi: c, giorniBase: g.n >= 5 ? g.mediana : null, costoGiorno: imp.costo_giorno, trattativa: (imp.trattativa || 0) / 100, margineMin: imp.margine_min };
    const piani = Calc().APPROCCI.map((p) => ({ ...p, piano: Calc().piano({ ...base, q: p.q }) }));
    const paga = Calc().pagare({ ...base, q: 0.5, richiesta: costi && costi.acquisto != null ? costi.acquisto : null });
    return { mercato, piani, paga, costi: c, cal, sigma: mercato.dettaglio.sigma, noto: mercato.dettaglio.noto };
  }

  GT.Stima = { init, apri, quantoPagare: () => apri({ modo: "compra", valori: {}, lavori: 0 }), riferimento, rapido };
})();
