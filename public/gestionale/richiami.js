/* Borzi Auto · richiami dopo la vendita.
   Chi compra un’auto non sparisce: dopo una settimana si chiede se va tutto bene, poi (solo se il cliente è d’accordo) si torna a farsi vivi a 11 mesi
   (tagliando e controlli) e a 23 mesi (cambio auto). I richiami stanno dentro il contatto del cliente, accanto al suo storico, e restano in questo browser
   come tutto il resto del CRM. Il gestionale non manda nulla da solo: apre un messaggio WhatsApp già scritto, che il titolare legge e invia a mano.
   Privacy: il primo richiamo (7 giorni) è un contatto legato alla vendita appena fatta; gli altri due sono promozionali e partono solo se il titolare spunta
   che il cliente ha acconsentito (la data del consenso resta scritta nel contatto). L’ultimo richiamo cade prima del limite di conservazione dei contatti. */
(function () {
  "use strict";
  const GT = (window.GT = window.GT || {});
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => TG.esc(s);
  let X = null;   // contesto del gestionale: { S, salva, ridisegna, toast, oggi, titolo, ... }

  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const pad = (n) => String(n).padStart(2, "0");
  const fmtData = (iso) => { const m = ISO.exec(iso || ""); return m ? `${m[0].slice(8, 10)}/${m[0].slice(5, 7)}/${m[0].slice(0, 4)}` : ""; };
  const fmtBreve = (iso) => (ISO.test(iso || "") ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "");
  const giorni = (a, b) => Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 864e5);
  const piuGiorni = (iso, n) => { const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + n)); return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()); };
  /* mesi di calendario; se il giorno non esiste nel mese d’arrivo (31 gennaio + 1 mese) si prende l’ultimo giorno */
  const piuMesi = (iso, n) => {
    const m0 = +iso.slice(5, 7) - 1 + n, y = +iso.slice(0, 4) + Math.floor(m0 / 12), m = ((m0 % 12) + 12) % 12;
    const ultimo = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return y + "-" + pad(m + 1) + "-" + pad(Math.min(+iso.slice(8, 10), ultimo));
  };
  const adesso = () => new Date().toISOString().slice(0, 16);
  let seq = 0;
  const nuovoId = () => "r" + Date.now().toString(36) + (seq++).toString(36);

  /* i tre richiami: dopo quanto, e se serve il consenso del cliente */
  const TIPI = {
    controllo: { titolo: "Come va con l’auto?", giorni: 7, consenso: false },
    tagliando: { titolo: "Tagliando e controlli", mesi: 11, consenso: true },
    cambio: { titolo: "Cambio auto", mesi: 23, consenso: true },
  };
  const ORDINE = ["controllo", "tagliando", "cambio"];
  const nomeTipo = (t) => (TIPI[t] ? TIPI[t].titolo : t);

  /* l’ultimo richiamo cade almeno un mese prima del limite di conservazione dei contatti (24 mesi di solito) */
  const limiteMesi = () => Math.max(1, ((GT.Crm && GT.Crm.mesiConservazione && GT.Crm.mesiConservazione()) || 24) - 1);
  const mesiDi = (tipo) => Math.min(TIPI[tipo].mesi, limiteMesi());

  /* quali richiami servono a un cliente, e per quale giorno: [{ tipo, data }] */
  function piano(c) {
    const v = c.venduta_il, out = [{ tipo: "controllo", data: piuGiorni(v, TIPI.controllo.giorni) }];
    if (c.consenso_richiami) {
      out.push({ tipo: "tagliando", data: piuMesi(v, mesiDi("tagliando")) });
      if (mesiDi("cambio") > mesiDi("tagliando")) out.push({ tipo: "cambio", data: piuMesi(v, mesiDi("cambio")) });
    }
    return out;
  }

  const norm = (r) => {
    if (!r || !TIPI[r.tipo] || !ISO.test(r.data || "")) return null;
    return { id: String(r.id || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 24) || nuovoId(), tipo: r.tipo, data: r.data, fatto: ISO.test(r.fatto || "") ? r.fatto : "", nota: String(r.nota || "").slice(0, 200), man: r.man === true };
  };
  const normLista = (l) => {
    const visti = {};
    return (Array.isArray(l) ? l : []).map(norm).filter((r) => r && !visti[r.tipo] && (visti[r.tipo] = 1)).sort((a, b) => ORDINE.indexOf(a.tipo) - ORDINE.indexOf(b.tipo));
  };

  /* rimette in ordine i richiami di un contatto dopo che è cambiato qualcosa (fase, data di vendita, consenso).
     I richiami già fatti restano come storico; quelli ancora da fare spariscono se non servono più o seguono la nuova data
     (a meno che il titolare li abbia rimandati a mano). */
  function sincronizza(c) {
    const attivo = c.stato === "venduto" && ISO.test(c.venduta_il || "");
    const voluti = attivo ? piano(c) : [];
    const lista = normLista(c.richiami).filter((r) => r.fatto || voluti.some((v) => v.tipo === r.tipo));
    voluti.forEach((v) => {
      const r = lista.find((x) => x.tipo === v.tipo);
      if (!r) lista.push({ id: nuovoId(), tipo: v.tipo, data: v.data, fatto: "", nota: "", man: false });
      else if (!r.fatto && !r.man) r.data = v.data;
    });
    c.richiami = lista.sort((a, b) => ORDINE.indexOf(a.tipo) - ORDINE.indexOf(b.tipo));
    return c;
  }

  /* ---------- cosa c’è da fare ---------- */
  const acquirenti = () => X.S.contatti.filter((c) => c.stato === "venduto" && ISO.test(c.venduta_il || ""));
  const daFare = (c) => (c.richiami || []).filter((r) => !r.fatto).sort((a, b) => (a.data > b.data ? 1 : -1));
  /* tutti i richiami ancora da fare, dal più vecchio */
  function elenco() {
    const out = [];
    acquirenti().forEach((c) => daFare(c).forEach((r) => out.push({ c, r })));
    return out.sort((a, b) => (a.r.data > b.r.data ? 1 : a.r.data < b.r.data ? -1 : 0));
  }
  const dovuti = () => elenco().filter((x) => x.r.data <= X.oggi());   // oggi o in ritardo

  /* ---------- messaggio WhatsApp ---------- */
  const cfg = () => (window.AP && AP.Config && AP.Config.cfg) || {};
  function autoTesto(c) {
    const a = c.auto_id ? X.S.auto.find((x) => x.id === c.auto_id) : null;
    const t = a ? X.titolo(a) : String(c.auto_testo || "").trim();
    return "l’auto" + (t ? ` (${t})` : "");
  }
  function testo(c, r) {
    const k = cfg(), sede = k.nomeBreve || k.nome || "il garage", tit = (X.S.titolare && X.S.titolare.nome) || "";
    const nome = String(c.nome || "").trim().split(/\s+/)[0], tel = (k.contatti && k.contatti.telefono) || "";
    const io = tit ? `sono ${tit} di ${sede}` : `ti scrivo da ${sede}`, chiudi = "Se preferisci non ricevere più nostri messaggi, dimmelo e ti tolgo dall’elenco.";
    const passati = r.tipo === "controllo" ? "È passata una settimana" : `Sono passati ${mesiDi(r.tipo)} mesi`;
    const ciao = `Ciao ${nome}, ${io}. ${passati} da quando hai ritirato ${autoTesto(c)}`;
    if (r.tipo === "controllo") return `${ciao}: volevo sapere se va tutto bene.${tel ? ` Se ti serve qualcosa scrivici qui o chiamaci al ${tel}.` : " Se ti serve qualcosa scrivici qui."} Grazie e buona strada!`;
    if (r.tipo === "tagliando") return `${ciao}. Se ti serve un consiglio per il tagliando o un controllo, siamo a disposizione. ${chiudi}`;
    return `${ciao}. Se ti interessa sapere quanto vale oggi o stai pensando di cambiarla, ne parliamo senza impegno. ${chiudi}`;
  }
  /* numero per wa.me: solo cifre, con il prefisso italiano se manca; null se non sembra un numero */
  function waNumero(tel) {
    const t = String(tel || "").replace(/[^\d+]/g, "").replace(/^\+/, "").replace(/^00/, "");
    if (t.length < 8) return null;
    return /^3\d{8,9}$/.test(t) ? "39" + t : t;
  }
  const waLink = (c, r) => { const n = waNumero(c.telefono); return n ? `https://wa.me/${n}?text=${encodeURIComponent(testo(c, r))}` : null; };

  /* ---------- le azioni ---------- */
  function fatto(c, r) {
    r.fatto = X.oggi();
    c.attivita.push({ d: adesso(), t: "nota", x: `Richiamo dopo la vendita: ${nomeTipo(r.tipo)}` });   // l’attività azzera anche il conto della conservazione
    X.salva(); X.ridisegna(); X.toast("Richiamo segnato come fatto.");
  }
  function rimanda(c, r) {
    r.data = piuGiorni(r.data > X.oggi() ? r.data : X.oggi(), 7); r.man = true;
    X.salva(); X.ridisegna(); X.toast("Rimandato al " + fmtData(r.data) + ".");
  }

  /* ---------- la vista «Dopo la vendita»: una scheda per cliente ---------- */
  function disegna(el, q, vuoto) {
    const oggi = X.oggi(), auto = GT.Crm.descAuto;
    const l = acquirenti().filter((c) => !q || TG.norm([c.nome, c.telefono, auto(c)].join(" ")).includes(q)).map((c) => ({ c, p: daFare(c)[0] || null }));
    l.sort((a, b) => (a.p && b.p ? (a.p.data > b.p.data ? 1 : -1) : a.p ? -1 : b.p ? 1 : a.c.venduta_il < b.c.venduta_il ? 1 : -1));
    vuoto.hidden = l.length > 0;
    if (!l.length) vuoto.textContent = acquirenti().length ? "Nessun cliente corrisponde alla ricerca." : "Ancora nessun cliente da seguire dopo la vendita. Quando segni un’auto come venduta e scrivi chi l’ha comprata, qui compaiono i richiami: dopo una settimana per sapere se va tutto bene e, se il cliente è d’accordo, a 11 e 23 mesi.";
    el.innerHTML = l.map(({ c, p }) => {
      const sc = p ? giorni(oggi, p.data) : null, fatti = (c.richiami || []).filter((r) => r.fatto);
      const wa = p ? waLink(c, p) : null, tel = String(c.telefono || "").replace(/[^\d+]/g, "");
      const prox = p ? `<div class="rc-next${sc < 0 ? " rit" : ""}"><b>${esc(nomeTipo(p.tipo))}</b><span>${esc(fmtData(p.data))}${sc < 0 ? ' · <span class="late">in ritardo</span>' : sc === 0 ? ' · <span class="today">oggi</span>' : ""}</span></div>` : '<small>Nessun richiamo in programma.</small>';
      const gia = fatti.length ? `<small>Già fatti: ${fatti.map((r) => esc(nomeTipo(r.tipo) + " (" + fmtBreve(r.fatto) + ")")).join(", ")}</small>` : "";
      const az = p ? `${wa ? `<a class="lnk" href="${esc(wa)}" target="_blank" rel="noopener">Scrivi</a>` : ""}${tel ? `<a class="lnk" href="tel:${esc(tel)}">Chiama</a>` : ""}<button type="button" class="lnk" data-ric="fatto" data-c="${esc(c.id)}" data-r="${esc(p.id)}">Fatto</button><button type="button" class="lnk" data-ric="rimanda" data-c="${esc(c.id)}" data-r="${esc(p.id)}">Rimanda</button>` : "";
      return `<article class="rc" tabindex="0" data-id="${esc(c.id)}" aria-label="${esc(c.nome)}">
  <div class="rc-t"><b>${esc(c.nome)}</b>${c.demo ? '<span class="tag">Esempio</span>' : ""}${c.telefono ? `<small>${esc(c.telefono)}</small>` : ""}</div>
  <small>${esc(auto(c) || "Auto non indicata")} · venduta il ${esc(fmtData(c.venduta_il))}</small>
  ${prox}${gia}
  <small>${c.consenso_richiami ? "Ha accettato i messaggi successivi, dal " + esc(fmtData(c.consenso_richiami)) : "Non ha accettato i messaggi a 11 e 23 mesi"}.</small>
  ${az ? `<div class="rc-az">${az}</div>` : ""}
</article>`;
    }).join("");
  }

  /* elenco dei richiami nella finestra del contatto (anche in anteprima, prima di salvare) */
  function elencoHtml(c) {
    const l = normLista(c.richiami);
    if (!l.length) return '<li class="att-vuoto">Nessun richiamo in programma.</li>';
    return l.map((r) => `<li><span class="att-d">${esc(fmtData(r.data))}</span><span class="att-t">${esc(nomeTipo(r.tipo))}</span><span class="att-x">${r.fatto ? "fatto il " + esc(fmtData(r.fatto)) : "da fare"}</span></li>`).join("");
  }

  GT.Richiami = {
    TIPI, init(ctx) {
      X = ctx;
      const t = $("#crm-post");
      t.addEventListener("click", (e) => {
        const b = e.target.closest("[data-ric]");
        if (b) {
          e.stopPropagation();
          const c = X.S.contatti.find((x) => x.id === b.dataset.c), r = c && (c.richiami || []).find((x) => x.id === b.dataset.r);
          if (c && r) (b.dataset.ric === "fatto" ? fatto : rimanda)(c, r);
          return;
        }
        if (e.target.closest("a")) return;
        const k = e.target.closest(".rc[data-id]"); if (k) GT.Crm.apriId(k.dataset.id);
      });
      t.addEventListener("keydown", (e) => { const k = e.target.closest && e.target.closest(".rc[data-id]"); if (k && e.target === k && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); GT.Crm.apriId(k.dataset.id); } });
    },
    norm, normLista, sincronizza, piano, elenco, dovuti, acquirenti, testo, waNumero, waLink, disegna, elencoHtml, nomeTipo, piuMesi, piuGiorni,
  };
})();
