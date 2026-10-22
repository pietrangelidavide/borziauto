/* Borzi Auto · inserimento di un'auto pensato per chi la vende, non per chi programma.
   Si parte dalle foto, poi si sceglie la marca dal suo logo, il modello da un elenco, l'anno, i chilometri e il motore con un tocco.
   Mentre si scrive compaiono il prezzo consigliato (stima di riferimento, catalogo.js) e l'anteprima di come l'auto apparirà sul sito.
   Il passo «Acquisto e controlli» tiene insieme quanto costa l'auto, i controlli (lista di cose da guardare, GT.Check) e i costi extra:
   il totale dei lavori da fare si aggiunge ai costi extra con un tocco, senza contarlo due volte nel margine.
   Il modulo resta quello di sempre (stessi campi, stesso salvataggio): qui si aggiungono solo scorciatoie e consigli. */
(function () {
  "use strict";
  const GT = (window.GT = window.GT || {});
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => TG.esc(s);
  const Cat = () => AP.Catalogo;
  const eur = (n) => (n == null || !isFinite(n) ? "–" : (n < 0 ? "−" : "") + TG.euro(Math.round(Math.abs(n))).replace(" ", " "));
  let X = null, F = null, prev = null, bozza = null;   // bozza: i controlli fatti su un'auto nuova, prima che sia salvata
  const PIU_USATE = ["fiat", "volkswagen", "bmw", "audi", "mercedes-benz", "toyota", "renault", "peugeot", "ford", "opel", "jeep", "alfa-romeo", "citroen", "mini", "lancia", "dacia"];
  const ALIM = ["Benzina", "Diesel", "Ibrida", "Elettrica", "GPL", "Metano"];

  const val = (n) => F.elements[n].value;
  const imposta = (n, v) => { const el = F.elements[n]; el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); };
  const dati = () => ({ marca: val("marca").trim(), modello: val("modello").trim(), anno: X.numero(val("anno")), km: X.numero(val("km")), alimentazione: val("alimentazione"), cambio: val("cambio"), prezzo: X.numero(val("prezzo")) });

  /* le marche che usi di più per prime, poi quelle più diffuse in Italia */
  function marcheRapide() {
    const uso = {};
    X.S.auto.forEach((a) => { const m = Cat().marca(a.marca); if (m) uso[m.id] = (uso[m.id] || 0) + 1; });
    const mie = Object.keys(uso).sort((a, b) => uso[b] - uso[a]);
    return mie.concat(PIU_USATE.filter((id) => !(id in uso))).slice(0, 14).map((id) => Cat().MARCHE.find((m) => m.id === id)).filter(Boolean);
  }
  function modelliRapidi(m, testo) {
    const mie = []; const viste = new Set();
    X.S.auto.forEach((a) => { if (Cat().marca(a.marca) === m && a.modello && !viste.has(TG.norm(a.modello))) { viste.add(TG.norm(a.modello)); mie.push(a.modello); } });
    const cat = Cat().suggerisciModelli(m, testo, 24).map((x) => x.nome).filter((n) => !viste.has(TG.norm(n)));
    const t = TG.norm(testo);
    return mie.filter((n) => !t || TG.norm(n).includes(t)).concat(cat).slice(0, 12);
  }
  const chip = (txt, data, on, img) => `<button type="button" class="fa-chip${on ? " on" : ""}" ${data} aria-pressed="${!!on}">${img ? `<img src="${esc(img)}" alt="" width="22" height="22">` : ""}<span>${esc(txt)}</span></button>`;

  function disegnaMarca() {
    const t = val("marca").trim(), m = Cat().marca(t), logo = $("#fa-logo");
    if (m) { logo.src = Cat().logo(m, "../"); logo.alt = m.nome; logo.hidden = false; } else logo.hidden = true;
    const lista = t && !m ? Cat().suggerisciMarche(t, 8) : marcheRapide();
    $("#fa-marche").innerHTML = lista.map((x) => chip(x.nome, `data-m="${esc(x.nome)}"`, m === x, Cat().logo(x, "../"))).join("") + (t && !m && !lista.length ? '<span class="fa-aiuto">Marca non in elenco: va bene anche scritta a mano.</span>' : "");
  }
  function disegnaModelli() {
    const m = Cat().marca(val("marca")), t = val("modello").trim();
    const cont = $("#fa-modelli");
    if (!m) { cont.innerHTML = '<span class="fa-aiuto">Scegli prima la marca: ti propongo i modelli più diffusi.</span>'; return; }
    const lista = modelliRapidi(m, Cat().modello(m, t) && TG.norm(Cat().modello(m, t).nome) === TG.norm(t) ? "" : t);
    cont.innerHTML = lista.map((n) => chip(n, `data-mo="${esc(n)}"`, TG.norm(n) === TG.norm(t))).join("");
  }
  function disegnaAnni() {
    const y = new Date().getFullYear(), a = X.numero(val("anno"));
    $("#fa-anni").innerHTML = Array.from({ length: 10 }, (_, i) => y - i).map((n) => chip(String(n), `data-y="${n}"`, a === n)).join("");
  }
  function segmenti() {
    for (const [nome, el, opz] of [["alimentazione", "#fa-alim", ALIM], ["cambio", "#fa-cambio", ["Manuale", "Automatico"]], ["stato", "#fa-stato", null]]) {
      const sel = F.elements[nome];
      const voci = opz || Array.from(sel.options).map((o) => [o.value, o.text]);
      $(el).innerHTML = voci.map((v) => { const [valore, testo] = Array.isArray(v) ? v : [v, v]; return `<button type="button" role="radio" data-v="${esc(valore)}" aria-checked="${sel.value === valore}">${esc(testo)}</button>`; }).join("");
    }
  }
  function aggiornaSegmenti() {
    for (const [nome, el] of [["alimentazione", "#fa-alim"], ["cambio", "#fa-cambio"], ["stato", "#fa-stato"]]) {
      const v = val(nome);
      $(el).querySelectorAll("button").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.v === v)));
    }
    $("#fa-venduta").hidden = val("stato") !== "venduta";
  }

  /* anteprima della scheda sul sito */
  function anteprima() {
    const d = dati(), foto = GT.Foto.lista(val("foto")), venduta = val("stato") === "venduta";
    const titolo = [d.marca, d.modello].filter(Boolean).join(" ") || "Marca e modello";
    const riga = [d.anno, d.km != null ? TG.num(d.km) + " km" : "", d.alimentazione, d.cambio].filter(Boolean).join(" · ");
    const img = foto.length ? `<img src="${esc(GT.Foto.src(foto[0], "../"))}" alt="">` : `<span class="fa-nofoto" aria-hidden="true">Nessuna foto</span>`;
    $("#fa-prev").innerHTML = `<div class="fa-pf">${img}<span class="fa-pbadge ${venduta ? "v" : ""}">${venduta ? "Venduta" : "In vendita"}</span>${foto.length > 1 ? `<span class="fa-pn">${foto.length} foto</span>` : ""}</div>
<div class="fa-pt"><b>${esc(titolo)}</b><small>${val("allestimento") ? esc(val("allestimento")) : "&nbsp;"}</small><span>${esc(riga || "Anno · km · alimentazione")}</span><strong>${venduta ? "" : d.prezzo != null ? eurH(d.prezzo) : "Su richiesta"}</strong></div>`;
    const vis = $("#fa-visibile").checked;
    $("#fa-vis-nota").textContent = venduta ? "Le auto vendute compaiono nella sezione «Vendute» del sito, senza prezzo." : vis ? (foto.length < 4 ? "Con almeno 4 foto l’auto attira molte più richieste." : "Visibile sul sito appena aggiorni il sito.") : "Nascosta: la vedi solo tu, finché non la mostri.";
  }
  const eurH = (n) => (n == null || !isFinite(n) ? "–" : TG.euroHtml(Math.round(n)));

  /* prezzo consigliato */
  function consiglio() {
    const box = $("#fa-prezzo"), d = dati();
    const costo = X.numero(val("costo_acquisto")), extra = X.numero(val("costi_extra"));
    if (!d.marca || !d.anno) { box.innerHTML = '<p class="fa-aiuto">Scrivi marca, modello e anno: ti suggerisco subito un prezzo di vendita.</p>'; box.dataset.pronto = ""; return; }
    const lavori = GT.Calc.lavoriDaFare(prev || bozza || {});
    const r = GT.Stima.rapido(d, { acquisto: costo, extra, lavori });
    if (!r) { box.innerHTML = '<p class="fa-aiuto">Controlla l’anno: non riesco a stimare questa auto.</p>'; return; }
    box.dataset.pronto = "1";
    const eq = r.piani[1].piano, vel = r.piani[0].piano, mar = r.piani[2].piano, m = r.mercato;
    let conf = "";
    if (d.prezzo) {
      const diff = d.prezzo / m.prezzoA(0.5) - 1, stato = diff > 0.1 ? "sopra" : diff < -0.1 ? "sotto" : "in linea", p = Math.abs(Math.round(diff * 100));
      conf = `<p class="fa-conf ${stato}" role="status">${stato === "in linea" ? "Il tuo prezzo è in linea con il mercato." : stato === "sopra" ? `Il tuo prezzo è circa <b>${p}% sopra</b> il mercato: potrebbe restare invenduta.` : `Il tuo prezzo è circa <b>${p}% sotto</b> il mercato: vendi in fretta, ma forse lasci soldi sul tavolo.`}</p>`;
    }
    let sotto = "";
    if (r.paga && costo == null) sotto = `<p class="fa-pag">Se la devi ancora comprare, <b>non pagarla oltre ${eur(r.paga.massimo)}</b> per guadagnare almeno ${eur(X.S.imp.margine_min || 0)}.</p>`;
    else if (costo != null && d.prezzo) { const guad = Math.round(d.prezzo * (1 - (X.S.imp.trattativa || 0) / 100)) - r.costi.diretti; sotto = `<p class="fa-pag">Con questo prezzo, dopo la trattativa, ${guad < 0 ? `<b class="late">ci perdi ${eur(-guad)}</b>` : `guadagni circa <b>${eur(guad)}</b>`} (costi inclusi).</p>`; }
    box.innerHTML = `<div class="fa-sug"><div class="fa-sug-main"><span class="fa-l">Prezzo consigliato</span><b>${eurH(eq.prezzo)}</b><small>Tra ${eur(m.prezzoA(0.25))} e ${eur(m.prezzoA(0.75))} sul mercato${r.cal && r.cal.attiva ? " · corretto sulle tue vendite" : ""}</small></div>
<div class="fa-sug-3" role="group" aria-label="Scegli il prezzo"><button type="button" data-p="${vel.prezzo}"><span>Vendi in fretta</span><b>${eur(vel.prezzo)}</b></button><button type="button" data-p="${eq.prezzo}" class="on"><span>Equilibrato</span><b>${eur(eq.prezzo)}</b></button><button type="button" data-p="${mar.prezzo}"><span>Più margine</span><b>${eur(mar.prezzo)}</b></button></div>
${conf}${sotto}<p class="fa-fonte">Stima di riferimento${r.noto ? "" : " (modello fuori elenco, più incerta)"}: non viene da nessun portale. <button type="button" class="lnk" data-calc>Apri il calcolo completo</button></p></div>`;
  }

  /* ---------- acquisto e controlli ---------- */
  const lavoroAuto = () => Object.assign(prev ? JSON.parse(JSON.stringify(prev)) : { id: "", checklist: bozza && bozza.checklist, verifiche: bozza && bozza.verifiche, preparazione: bozza && bozza.preparazione === true }, {
    marca: val("marca").trim(), modello: val("modello").trim(), allestimento: val("allestimento").trim(), anno: X.numero(val("anno")), km: X.numero(val("km")),
    targa: val("targa"), telaio: val("telaio"), costi_extra: X.numero(val("costi_extra")) });
  function controlli() {
    const box = $("#fa-ctl"); if (!box) return;
    const a = lavoroAuto(), p = GT.Check.preventivo(a), extra = X.numero(val("costi_extra")) || 0;
    const metti = (html) => { if (box.dataset.h !== html) { box.innerHTML = html; box.dataset.h = html; } };     // non ridisegna se non è cambiato niente: il fuoco resta dov'è
    if (!p.fatta) {
      metti(`<div class="fa-ctl-testa"><b>Controlli</b><span class="fa-ctl-st">non ancora fatti</span></div>
<p class="fa-aiuto">Documenti, meccanica, elettronica, carrozzeria: per ogni lavoro che serve scrivi quanto costa. Il totale ti dice quanto mettere nei costi extra, e se l’auto vale il prezzo che chiedono.</p>
<div class="fa-ctl-az"><button type="button" class="btn btn-light sm" data-ctl="apri">Fai i controlli</button></div>`);
      return;
    }
    const lavori = p.daFare ? `<b>${p.daFare}</b> ${p.daFare === 1 ? "lavoro" : "lavori"} da fare, <b>${eur(p.totale)}</b> stimati` : "Nessun lavoro da fare";
    const fatti = p.fatti ? ` · ${p.fatti} già ${p.fatti === 1 ? "fatto" : "fatti"} (${eur(p.speso)})` : "";
    const sug = p.residuo > 0
      ? `<p class="fa-ctl-sug">Con questi lavori i costi extra diventano <b>${eur(extra + p.residuo)}</b>. <button type="button" class="btn btn-light sm" data-ctl="extra">Aggiungi ${eur(p.residuo)} ai costi extra</button></p>`
      : p.incluso > 0 ? `<p class="fa-ctl-ok" role="status">I ${eur(p.incluso)} dei lavori da fare sono già nei costi extra.</p>` : "";
    metti(`<div class="fa-ctl-testa"><b>Controlli</b><span class="fa-ctl-st">${p.controllate} ${p.controllate === 1 ? "voce controllata" : "voci controllate"}</span></div>
<p class="fa-ctl-sum">${lavori}${fatti}</p>${sug}
<div class="fa-ctl-az"><button type="button" class="btn btn-line sm" data-ctl="apri">Rivedi i controlli</button></div>`);
  }
  function apriControlli() {
    GT.Check.apri(lavoroAuto(), {
      acquisto: true, originale: prev || (bozza = bozza || {}),
      dopoVerifica: (x) => { imposta("targa", x.targa || ""); imposta("telaio", x.telaio || ""); },
      dopo: (c) => {
        const o = prev || bozza; o.checklist = c.checklist; o.preparazione = c.preparazione;
        if (prev) prev.costi_extra = c.costi_extra;
        $("#fa-visibile").checked = !c.preparazione;
        imposta("costi_extra", c.costi_extra == null ? "" : c.costi_extra);
        if (prev) { X.salva(); X.ridisegna(); }
        const b = $("#fa-ctl [data-ctl=apri]"); if (b) b.focus();
      },
    });
  }
  function extraDaControlli() {
    const r = GT.Check.aggiungiAiExtra(lavoroAuto()), o = prev || (bozza = bozza || {}), aggiunti = r.costi_extra - (X.numero(val("costi_extra")) || 0);
    o.checklist = r.checklist;
    if (prev) { prev.costi_extra = r.costi_extra; X.salva(); X.ridisegna(); }
    imposta("costi_extra", r.costi_extra);
    const b = $("#fa-ctl [data-ctl=apri]"); if (b) b.focus();
    X.toast(`Aggiunti ${eur(aggiunti)} ai costi extra.`);
  }

  let tm;
  function aggiorna() { disegnaMarca(); disegnaModelli(); disegnaAnni(); aggiornaSegmenti(); anteprima(); controlli(); clearTimeout(tm); tm = setTimeout(consiglio, 80); }

  function init(ctx, form) {
    X = ctx; F = form;
    segmenti();
    $("#fa-marche").addEventListener("click", (e) => { const b = e.target.closest("[data-m]"); if (b) { imposta("marca", b.dataset.m); imposta("modello", ""); $("#form").elements.modello.focus(); } });
    $("#fa-modelli").addEventListener("click", (e) => { const b = e.target.closest("[data-mo]"); if (b) imposta("modello", b.dataset.mo); });
    $("#fa-anni").addEventListener("click", (e) => { const b = e.target.closest("[data-y]"); if (b) imposta("anno", b.dataset.y); });
    for (const [nome, el] of [["alimentazione", "#fa-alim"], ["cambio", "#fa-cambio"], ["stato", "#fa-stato"]]) {
      $(el).addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; const v = b.dataset.v, sel = F.elements[nome]; imposta(nome, sel.value === v && nome !== "stato" ? "" : v); });
    }
    $("#fa-prezzo").addEventListener("click", (e) => {
      const p = e.target.closest("[data-p]"); if (p) { imposta("prezzo", p.dataset.p); $("#fa-prezzo").querySelectorAll("[data-p]").forEach((b) => b.classList.toggle("on", b === p)); return; }
      if (e.target.closest("[data-calc]")) $("#f-stima").click();
    });
    $("#fa-ctl").addEventListener("click", (e) => { const b = e.target.closest("[data-ctl]"); if (!b) return; if (b.dataset.ctl === "apri") apriControlli(); else extraDaControlli(); });
    $("#fa-visibile").addEventListener("change", anteprima);
    F.addEventListener("input", aggiorna);
    F.addEventListener("change", aggiorna);
  }
  /* alla apertura del modulo: prev = auto che si modifica (o null) */
  function apertura(a) { prev = a || null; bozza = null; $("#fa-visibile").checked = !(a && a.preparazione); aggiorna(); }
  /* i controlli fatti su un'auto nuova, da salvare insieme all'auto */
  const daSalvare = () => (prev || !bozza ? {} : Object.fromEntries(["checklist", "verifiche"].filter((k) => bozza[k]).map((k) => [k, bozza[k]])));

  GT.Aggiungi = { init, apertura, aggiorna, daSalvare };
})();
