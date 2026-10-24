/* Borzi Auto · schermata Riepilogo: il report che si apre per primo.
   Mette in cima quello che serve al titolare per decidere oggi: cosa fare ora, le cifre della flotta, come vanno le vendite,
   da quanto tempo le auto sono ferme, come sono i prezzi rispetto al mercato, le trattative e le prossime visite.
   Legge solo dati che il gestionale ha già (auto, contatti, visite, richieste, storico): non chiede nulla di nuovo al titolare. */
(function () {
  "use strict";
  const GT = (window.GT = window.GT || {});
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => TG.esc(s);
  let X = null;
  const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  const MESI3 = MESI.map((m) => m.slice(0, 3));
  const eur = (n) => (n == null || !isFinite(n) ? "–" : (n < 0 ? "−" : "") + TG.euro(Math.round(Math.abs(n))).replace(" ", " "));
  const eurH = (n) => (n == null || !isFinite(n) ? "–" : (n < 0 ? "−" : "") + TG.euroHtml(Math.round(Math.abs(n))));
  const eurK = (n) => (n == null || !isFinite(n) ? "–" : Math.abs(n) >= 100000 ? Math.round(n / 1000) + "k €" : Math.abs(n) >= 10000 ? (n / 1000).toFixed(1).replace(".", ",") + "k €" : eur(n));
  const un = (n, s, p) => `${n} ${n === 1 ? s : p}`;
  const Fl = () => GT.Crm.Flotta;
  const giorniTra = (a, b) => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 864e5);
  const mesePrec = (m, k) => { let y = +m.slice(0, 4), mm = +m.slice(5, 7) - 1 + k; y += Math.floor(mm / 12); mm = ((mm % 12) + 12) % 12; return y + "-" + String(mm + 1).padStart(2, "0"); };

  /* ---------- i numeri ---------- */
  function numeri() {
    const S = X.S, oggi = X.oggi(), disp = S.auto.filter((a) => a.stato === "disponibile"), st = GT.Calc.storia(S.auto, S.storico), mese = oggi.slice(0, 7), prec = mesePrec(mese, -1);
    const n = { oggi, disp, st };
    n.valoreStock = disp.reduce((s, a) => s + (a.prezzo || 0), 0);
    const conCosto = disp.filter((a) => Fl().margine(a) != null);
    n.margine = conCosto.reduce((s, a) => s + Fl().margine(a), 0); n.conCosto = conCosto.length; n.senzaCosto = disp.length - conCosto.length;
    const gg = disp.map((a) => ({ a, g: Fl().giorniStock(a) })).filter((x) => x.g != null);
    n.giorni = gg; n.giorniMedi = gg.length ? Math.round(gg.reduce((s, x) => s + x.g, 0) / gg.length) : null; n.lunghe = gg.filter((x) => x.g > 60);
    const vm = (m) => st.filter((r) => r.data_vendita.slice(0, 7) === m);
    n.venduteMese = vm(mese); n.vendutePrec = vm(prec);
    n.incassoMese = n.venduteMese.reduce((s, r) => s + (r.prezzo_vendita || 0), 0);
    n.margineMese = n.venduteMese.filter((r) => r.margine != null).reduce((s, r) => s + r.margine, 0);
    n.tempoVendita = GT.Calc.giacenza(st);
    const ap = GT.Crm.aperti();
    n.aperti = ap; n.daRichiamare = ap.filter((c) => c.prossimo && c.prossimo <= oggi);
    n.richiami = GT.Richiami.dovuti();   // clienti che hanno comprato: da sentire dopo la vendita
    n.fasi = GT.Crm.STATI.map(([k, t]) => ({ k, t, n: S.contatti.filter((c) => c.stato === k).length }));
    const att = S.visite.filter((v) => AP.Visite.ATTIVE.includes(v.stato)), lun = AP.Visite.piu(oggi, -((AP.Visite.giornoSett(oggi) + 6) % 7)), dom = AP.Visite.piu(lun, 6);
    n.visiteOggi = att.filter((v) => v.data === oggi).sort((a, b) => (a.ora > b.ora ? 1 : -1));
    n.visiteSett = att.filter((v) => v.data >= lun && v.data <= dom).length;
    n.visiteFuture = att.filter((v) => v.data >= oggi).sort((a, b) => (a.data + a.ora > b.data + b.ora ? 1 : -1));
    n.daConfermare = S.visite.filter((v) => v.stato === "richiesta").length;
    n.ricNuove = GT.Richieste.attiva() ? GT.Richieste.nuove() : 0;
    n.rif = disp.map((a) => ({ a, r: GT.Stima.riferimento(a) })).filter((x) => x.r && x.r.diff != null);
    n.sopra = n.rif.filter((x) => x.r.stato === "sopra").sort((a, b) => b.r.diff - a.r.diff); n.sotto = n.rif.filter((x) => x.r.stato === "sotto"); n.inLinea = n.rif.filter((x) => x.r.stato === "in linea");
    n.revisioni = disp.filter((a) => { const r = Fl().revisione(a); return r != null && r <= 30; }).sort((a, b) => Fl().revisione(a) - Fl().revisione(b));
    n.senzaFoto = disp.filter((a) => !GT.Foto.lista(a.foto).length && a.preparazione !== true);
    n.pocheFoto = disp.filter((a) => { const k = GT.Foto.lista(a.foto).length; return k > 0 && k < 4 && a.preparazione !== true; });
    n.senzaPrezzo = disp.filter((a) => a.prezzo == null && a.preparazione !== true);
    n.inPrep = disp.filter((a) => a.preparazione === true);
    n.verAtt = disp.filter((a) => GT.Verifica.riepilogo(a).att);
    n.posti = S.imp.posti;
    return n;
  }

  /* ---------- cosa fare ora ---------- */
  function azioni(n) {
    const a = [], nomi = (l, f) => { const t = l.slice(0, 2).map(f).join(", "); return t + (l.length > 2 ? ` e altre ${l.length - 2}` : ""); };
    const T = X.titolo;
    if (n.visiteOggi.length) a.push({ t: "alto", ic: "cal", titolo: `${un(n.visiteOggi.length, "visita", "visite")} oggi`, dett: nomi(n.visiteOggi, (v) => `${v.ora} ${v.nome || "cliente"}`), vai: "visite", cta: "Apri l’agenda" });
    if (n.daConfermare) a.push({ t: "alto", ic: "cal", titolo: `${un(n.daConfermare, "visita", "visite")} da confermare`, dett: "Il cliente aspetta una risposta: confermare o proporre un altro orario.", vai: "visite", cta: "Conferma" });
    if (n.ricNuove) a.push({ t: "alto", ic: "tag", titolo: `${n.ricNuove === 1 ? "Una nuova valutazione" : n.ricNuove + " nuove valutazioni"} dal sito`, dett: "Qualcuno vuole vendere la sua auto: più rispondi in fretta, più è facile comprarla.", vai: "valutazioni", cta: "Guarda" });
    if (n.daRichiamare.length) a.push({ t: "alto", ic: "tel", titolo: `${un(n.daRichiamare.length, "contatto", "contatti")} da richiamare`, dett: nomi(n.daRichiamare, (c) => c.nome), vai: "crm", cta: "Apri i contatti" });
    if (n.richiami.length) a.push({ t: "medio", ic: "tel", titolo: `${un(n.richiami.length, "richiamo", "richiami")} dopo la vendita`, dett: nomi(n.richiami, (x) => `${x.c.nome} (${GT.Richiami.nomeTipo(x.r.tipo).toLowerCase()})`), vai: "crm", post: 1, cta: "Apri i richiami" });
    const scad = n.revisioni.filter((x) => Fl().revisione(x) < 0);
    if (scad.length) a.push({ t: "alto", ic: "doc", titolo: `Revisione scaduta: ${nomi(scad, T)}`, dett: "Non si può vendere con la revisione scaduta.", vai: "disponibile", cta: "Vai alle auto" });
    else if (n.revisioni.length) a.push({ t: "medio", ic: "doc", titolo: `Revisione in scadenza: ${nomi(n.revisioni, T)}`, dett: `Tra ${Fl().revisione(n.revisioni[0])} giorni la prima.`, vai: "disponibile", cta: "Vai alle auto" });
    if (n.verAtt.length) a.push({ t: "alto", ic: "doc", titolo: `Verifica da guardare: ${nomi(n.verAtt, T)}`, dett: "Una voce di storico, assicurazione o documenti non torna: ricontrolla prima di vendere.", mod: n.verAtt[0].id, cta: "Apri l’auto" });
    if (n.lunghe.length) a.push({ t: "medio", ic: "clock", titolo: `${un(n.lunghe.length, "auto ferma", "auto ferme")} da più di 60 giorni`, dett: nomi(n.lunghe.sort((x, y) => y.g - x.g), (x) => `${T(x.a)} (${x.g} gg)`), vai: "flotta", cta: "Vedi cosa fare" });
    if (n.sopra.length) a.push({ t: "medio", ic: "prezzo", titolo: `${un(n.sopra.length, "auto è", "auto sono")} sopra il prezzo di mercato`, dett: nomi(n.sopra, (x) => `${T(x.a)} (+${Math.round(x.r.diff * 100)}%)`), stima: n.sopra[0].a.id, cta: "Rivedi il prezzo" });
    if (n.senzaPrezzo.length) a.push({ t: "medio", ic: "prezzo", titolo: `${un(n.senzaPrezzo.length, "auto", "auto")} senza prezzo`, dett: "Sul sito compare «Su richiesta»: chi cerca un prezzo passa oltre.", stima: n.senzaPrezzo[0].id, cta: "Calcola il prezzo" });
    if (n.senzaFoto.length || n.pocheFoto.length) a.push({ t: "basso", ic: "foto", titolo: n.senzaFoto.length ? `${un(n.senzaFoto.length, "auto senza foto", "auto senza foto")}` : `${un(n.pocheFoto.length, "auto con meno di 4 foto", "auto con meno di 4 foto")}`, dett: nomi(n.senzaFoto.length ? n.senzaFoto : n.pocheFoto, T), mod: (n.senzaFoto.length ? n.senzaFoto : n.pocheFoto)[0].id, cta: "Aggiungi foto" });
    if (n.posti && n.disp.length < n.posti * 0.8) a.push({ t: "basso", ic: "garage", titolo: `${un(n.posti - n.disp.length, "posto libero", "posti liberi")} in garage`, dett: "Il garage non è pieno: guarda quando e cosa comprare.", vai: "flotta", cta: "Piano acquisti" });
    const rank = { alto: 0, medio: 1, basso: 2 };
    return a.sort((x, y) => rank[x.t] - rank[y.t]);
  }

  const IC = {
    cal: '<path d="M5 6h14v14H5zM5 10h14M9 3v4M15 3v4"/>', tel: '<path d="M6 4h4l2 5-2.5 1.5a11 11 0 0 0 4.5 4.5L15 12.5l5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 4 6a2 2 0 0 1 2-2z"/>',
    tag: '<path d="M4 12V4h8l8 8-8 8zM8.5 8.5h.01"/>', doc: '<path d="M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6"/>', clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
    prezzo: '<path d="M4 18 10 11l4 4 6-8M15 7h5v5"/>', foto: '<path d="M4 7h4l1.5-2h5L16 7h4v12H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/>', garage: '<path d="M3 20V9l9-5 9 5v11M7 20v-7h10v7M7 16h10"/>', ok: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  };
  const ico = (k) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${IC[k] || ""}</svg>`;

  /* ---------- grafici ---------- */
  function graficoVendite(n) {
    const mese = n.oggi.slice(0, 7), mesi = Array.from({ length: 6 }, (_, i) => mesePrec(mese, i - 5));
    const dati = mesi.map((m) => { const r = n.st.filter((x) => x.data_vendita.slice(0, 7) === m); return { m, n: r.length, inc: r.reduce((s, x) => s + (x.prezzo_vendita || 0), 0), mar: r.filter((x) => x.margine != null).reduce((s, x) => s + x.margine, 0), parz: m === mese }; });
    const max = Math.max(3, ...dati.map((d) => d.n)), W = 380, H = 170, ml = 8, mb = 26, mt = 24, ph = H - mt - mb, banda = (W - ml * 2) / dati.length, larg = Math.min(34, banda - 14);
    if (!n.st.length) return '<p class="gt-empty">Ancora nessuna vendita registrata. Quando segni un’auto come «Venduta» compare qui.</p>';
    let t = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Auto vendute negli ultimi sei mesi: ${dati.map((d) => MESI[+d.m.slice(5) - 1] + " " + d.n).join(", ")}.">`;
    for (let i = 1; i <= 3; i++) { const y = mt + ph - (ph * i) / 3; t += `<line x1="${ml}" x2="${W - ml}" y1="${y}" y2="${y}" class="g-gr"/>`; }
    dati.forEach((d, i) => {
      const cx = ml + banda * (i + 0.5), h = Math.max(d.n ? 5 : 2, (d.n / max) * ph), y = mt + ph - h;
      t += `<rect x="${(cx - larg / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${larg.toFixed(1)}" height="${h.toFixed(1)}" class="hm-bar${d.parz ? " parz" : ""}${d.n ? "" : " zero"}" tabindex="0"><title>${MESI[+d.m.slice(5) - 1]}: ${un(d.n, "auto venduta", "auto vendute")}${d.inc ? ", incasso " + eur(d.inc) : ""}${d.mar ? ", margine " + eur(d.mar) : ""}${d.parz ? " (mese in corso)" : ""}</title></rect>`;
      t += `<text x="${cx.toFixed(1)}" y="${(y - 7).toFixed(1)}" class="hm-bn" text-anchor="middle">${d.n}</text><text x="${cx.toFixed(1)}" y="${H - 8}" class="g-tx" text-anchor="middle">${MESI3[+d.m.slice(5) - 1]}</text>`;
    });
    return t + `<line x1="${ml}" x2="${W - ml}" y1="${mt + ph}" y2="${mt + ph}" class="g-ass"/></svg>`;
  }
  const FASCE = [["0–30 giorni", 0, 30, "f1"], ["31–60", 31, 60, "f2"], ["61–90", 61, 90, "f3"], ["oltre 90", 91, 1e9, "f4"]];
  function fermate(n) {
    if (!n.giorni.length) return `<p class="gt-empty">${n.disp.length ? "Scrivi la data di acquisto delle auto per vedere da quanto sono in garage." : "Nessuna auto in vendita."}</p>`;
    const tot = n.giorni.length, bande = FASCE.map(([t, a, b, k]) => ({ t, k, n: n.giorni.filter((x) => x.g >= a && x.g <= b).length }));
    return `<div class="hm-fasce" role="img" aria-label="${bande.map((b) => b.t + ": " + b.n).join(", ")}">${bande.map((b) => (b.n ? `<i class="${b.k}" style="flex:${b.n}"><b>${b.n}</b></i>` : "")).join("")}</div>
<ul class="hm-leg">${bande.map((b) => `<li><i class="${b.k}"></i>${b.t} <b>${b.n}</b></li>`).join("")}</ul>
<p class="small muted">${n.tempoVendita.n >= 5 ? `Di solito le tue auto si vendono in circa <b>${Math.round(n.tempoVendita.mediana)} giorni</b>.` : "Con qualche vendita in più ti dico quanto ci mette di solito un’auto a vendersi."}</p>`;
  }
  function pipeline(n) {
    const f = n.fasi.filter((x) => x.k !== "perso"), max = Math.max(1, ...f.map((x) => x.n));
    if (!f.some((x) => x.n)) return '<p class="gt-empty">Nessun contatto. Aggiungi chi ti chiama o ti scrive: così non ti dimentichi di richiamarlo.</p>';
    return `<ul class="hm-pipe">${f.map((x) => `<li><span>${esc(x.t)}</span><i style="width:${Math.max(4, (x.n / max) * 100)}%" class="p-${x.k}"></i><b>${x.n}</b></li>`).join("")}</ul>`;
  }
  function prezziMercato(n) {
    if (!n.rif.length) return '<p class="gt-empty">Per confrontare i prezzi con il mercato servono prezzo e anno di immatricolazione delle auto.</p>';
    const c = (k, t, l) => `<div class="hm-conf c-${k}"><b>${l.length}</b><span>${t}</span></div>`;
    const elenco = n.sopra.concat(n.sotto).slice(0, 4);
    return `<div class="hm-confr">${c("sopra", "sopra il mercato", n.sopra)}${c("linea", "in linea", n.inLinea)}${c("sotto", "sotto il mercato", n.sotto)}</div>
${elenco.length ? `<ul class="hm-lista">${elenco.map((x) => `<li><button type="button" data-stima="${esc(x.a.id)}"><span class="hm-l1">${esc(X.titolo(x.a))}</span><span class="hm-l2">${eur(x.a.prezzo)} · mercato ${eur(x.r.valore)}</span><em class="${x.r.stato === "sopra" ? "late" : "ok"}">${x.r.diff > 0 ? "+" : "−"}${Math.abs(Math.round(x.r.diff * 100))}%</em></button></li>`).join("")}</ul>` : '<p class="small muted">Tutti i prezzi sono in linea con il mercato.</p>'}
<p class="small muted">Confronto con la stima di riferimento (listino, anno, km): è un’indicazione, non un’offerta.</p>`;
  }
  function visite(n) {
    const l = n.visiteFuture.slice(0, 4);
    if (!l.length) return '<p class="gt-empty">Nessuna visita in programma. I clienti possono prenotarla dal sito.</p>';
    const giorno = (d) => (d === n.oggi ? "Oggi" : d === AP.Visite.piu(n.oggi, 1) ? "Domani" : (() => { const x = new Date(d + "T12:00:00"); return x.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" }); })());
    return `<ul class="hm-lista">${l.map((v) => `<li><button type="button" data-go="visite"><span class="hm-l1">${esc(giorno(v.data))} · ${esc(v.ora)}</span><span class="hm-l2">${esc(v.nome || "Cliente")}${v.auto_id || v.auto_testo ? " · " + esc((() => { const a = X.S.auto.find((x) => x.id === v.auto_id); return a ? X.titolo(a) : v.auto_testo; })()) : ""}</span>${v.stato === "richiesta" ? '<em class="late">da confermare</em>' : ""}</button></li>`).join("")}</ul>`;
  }
  function ferme(n) {
    const l = n.giorni.slice().sort((a, b) => b.g - a.g).slice(0, 4);
    if (!l.length) return "";
    return `<ul class="hm-lista">${l.map((x) => { const r = GT.Stima.riferimento(x.a); return `<li><button type="button" data-mod="${esc(x.a.id)}"><span class="hm-l1">${esc(X.titolo(x.a))}</span><span class="hm-l2">${x.a.prezzo != null ? eur(x.a.prezzo) : "senza prezzo"}${r && r.diff != null ? ` · ${r.stato === "sopra" ? "sopra il mercato" : r.stato === "sotto" ? "sotto il mercato" : "prezzo in linea"}` : ""}</span><em class="${x.g > 60 ? "late" : ""}">${x.g} gg</em></button></li>`; }).join("")}</ul>`;
  }

  /* ---------- pagina ---------- */
  function kpi(l, v, sub, cls, go) {
    const tag = go ? "button" : "div";
    return `<${tag}${go ? ` type="button" data-go="${go}"` : ""} class="hm-k ${cls || ""}"><span class="hm-kl">${l}</span><b class="hm-kv">${v}</b><small>${sub}</small></${tag}>`;
  }
  function disegna() {
    if (!X) return;
    const n = numeri(), az = azioni(n), nome = (AP.Config.cfg && AP.Config.cfg.nome) || "il garage";
    const d = new Date(), data = d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
    const mm = n.venduteMese.length - n.vendutePrec.length;
    const occ = n.posti ? Math.min(100, Math.round((n.disp.length / n.posti) * 100)) : null;
    const urg = az.filter((x) => x.t === "alto").length;
    const html = `
<div class="hm-testa"><div><p class="hm-data">${esc(data)}</p><h2 class="hm-tit">${urg ? `${un(urg, "cosa da fare", "cose da fare")} oggi` : az.length ? "Oggi è tutto sotto controllo" : "Tutto in ordine"}</h2><p class="hm-sotto">${esc(nome)}: ${un(n.disp.length, "auto in vendita", "auto in vendita")}${n.valoreStock ? ", valore in vetrina " + eur(n.valoreStock) : ""}.</p></div></div>
<div class="hm-kpis">
${kpi("In vetrina", n.disp.length, n.posti ? `<span class="meter" aria-hidden="true"><i style="width:${occ}%"></i></span>${occ}% del garage (${n.posti} posti)` : n.valoreStock ? "valore " + eurK(n.valoreStock) : "nessuna auto", "", "disponibile")}
${kpi("Vendute questo mese", n.venduteMese.length, (n.venduteMese.length ? `incasso ${eurK(n.incassoMese)}${n.margineMese ? " · margine " + eurK(n.margineMese) : ""}` : "ancora nessuna") + ` · mese scorso ${n.vendutePrec.length}`, mm > 0 ? "su" : mm < 0 ? "giu" : "", "venduta")}
${kpi("Margine potenziale", n.conCosto ? eurH(n.margine) : "–", n.conCosto ? `sulle ${n.conCosto} auto con costo${n.senzaCosto ? ` · ${n.senzaCosto} senza costo` : ""}` : "scrivi il costo di acquisto", "", "disponibile")}
${kpi("Giorni medi in stock", n.giorniMedi == null ? "–" : n.giorniMedi, n.giorniMedi == null ? "scrivi la data di acquisto" : n.lunghe.length ? `${un(n.lunghe.length, "auto", "auto")} oltre 60 giorni` : "nessuna ferma da molto", n.lunghe.length ? "warn" : "", "flotta")}
${kpi("Trattative aperte", n.aperti.length, n.daRichiamare.length ? `${n.daRichiamare.length} da richiamare` : "nessun ritardo", n.daRichiamare.length ? "warn" : "", "crm")}
${kpi("Visite in settimana", n.visiteSett, n.visiteOggi.length ? `${n.visiteOggi.length} oggi` : n.daConfermare ? `${n.daConfermare} da confermare` : "nessuna oggi", n.daConfermare ? "warn" : "", "visite")}
${kpi("Prezzi vs mercato", n.rif.length ? `${n.inLinea.length}<span class="hm-su"> / ${n.rif.length}</span>` : "–", n.rif.length ? `in linea · ${n.sopra.length} sopra · ${n.sotto.length} sotto` : "servono prezzo e anno", n.sopra.length ? "warn" : "")}
${n.posti || n.ricNuove || GT.Richieste.attiva() ? (GT.Richieste.attiva() ? kpi("Valutazioni dal sito", n.ricNuove, n.ricNuove ? "da richiamare" : "nessuna in attesa", n.ricNuove ? "warn" : "", "valutazioni") : kpi("Posti liberi", Math.max(0, n.posti - n.disp.length), `su ${n.posti} nel garage`, "", "flotta")) : ""}
</div>
<div class="hm-cols">
<section class="hm-box hm-todo" aria-labelledby="hm-h-todo"><h3 id="hm-h-todo">Cosa fare ora</h3>
${az.length ? `<ul class="hm-az">${az.map((x, i) => `<li class="t-${x.t}"><span class="hm-ico">${ico(x.ic)}</span><div><b>${esc(x.titolo)}</b><small>${esc(x.dett)}</small></div><button type="button" class="btn btn-line sm" ${x.vai ? `data-go="${esc(x.vai)}"${x.post ? ' data-post="1"' : ""}` : x.stima ? `data-stima="${esc(x.stima)}"` : `data-mod="${esc(x.mod)}"`}>${esc(x.cta)}</button></li>`).join("")}</ul>` : `<p class="hm-ok">${ico("ok")}<span>Niente di urgente. Le visite sono a posto, nessuno da richiamare, le auto hanno foto e prezzo.</span></p>`}
</section>
<div class="hm-col">
<section class="hm-box" aria-labelledby="hm-h-vend"><h3 id="hm-h-vend">Vendite negli ultimi 6 mesi</h3><div class="hm-graf">${graficoVendite(n)}</div></section>
<section class="hm-box" aria-labelledby="hm-h-vis"><h3 id="hm-h-vis">Prossime visite</h3>${visite(n)}</section>
</div>
</div>
<div class="hm-cols3">
<section class="hm-box" aria-labelledby="hm-h-ferme"><h3 id="hm-h-ferme">Da quanto tempo sono ferme</h3>${fermate(n)}${ferme(n)}</section>
<section class="hm-box" aria-labelledby="hm-h-mer"><h3 id="hm-h-mer">Prezzi rispetto al mercato</h3>${prezziMercato(n)}</section>
<section class="hm-box" aria-labelledby="hm-h-pipe"><h3 id="hm-h-pipe">Trattative per fase</h3>${pipeline(n)}</section>
</div>`;
    $("#home").innerHTML = html;
    // l'auto al neon si crea una volta sola: ai ridisegni successivi non rifà l'entrata
    if (!NEON && AP.Neon) {
      NEON = document.createElement("div"); NEON.className = "hm-neon"; NEON.setAttribute("aria-hidden", "true"); NEON.innerHTML = AP.Neon.markup("");
      setTimeout(() => NEON.classList.add("fatto"), 3200);
    }
    if (NEON) $("#home .hm-testa").append(NEON);
  }
  let NEON = null;

  function init(ctx) {
    X = ctx;
    $("#home").addEventListener("click", (e) => {
      const g = e.target.closest("[data-go]"); if (g) { if (g.dataset.post) GT.Crm.vistaFiltro.vista = "post"; return X.vai(g.dataset.go); }
      const s = e.target.closest("[data-stima]"); if (s) { const a = X.S.auto.find((x) => x.id === s.dataset.stima); if (a) X.stima(a); return; }
      const m = e.target.closest("[data-mod]"); if (m) { const a = X.S.auto.find((x) => x.id === m.dataset.mod); if (a) X.modifica(a); }
    });
  }
  GT.Home = { init, disegna, numeri, azioni };
})();
