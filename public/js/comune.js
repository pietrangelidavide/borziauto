/* AutoProfit · funzioni condivise tra sito e gestionale (nessuna dipendenza). */
(function () {
  const TG = (window.TG = {});

  /* ---------- testo e numeri ---------- */
  TG.norm = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const nf = new Intl.NumberFormat("it-IT");
  TG.euro = (n) => (n || n === 0 ? "€ " + nf.format(n) : "Su richiesta");
  // il simbolo € del carattere dei titoli è poco leggibile: lo scrivo con il carattere dei testi
  TG.euroHtml = (n) => (n || n === 0 ? '<span class="eur">€</span>' + nf.format(n) : "Su richiesta");
  TG.num = (n) => nf.format(n);
  TG.km = (n) => (n || n === 0 ? nf.format(n) + " km" : "");
  const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  TG.mese = (iso) => {
    const m = /^(\d{4})-(\d{2})/.exec(iso || "");
    return m ? MESI[+m[2] - 1] + " " + m[1] : "";
  };
  TG.esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- foto ---------- */
  // "golf-1.jpg" → img/auto/golf-1.jpg ; indirizzi completi o che iniziano con "/" restano invariati.
  TG.foto = (f, base) => {
    f = String(f || "").trim();
    if (!f) return "";
    if (/^(https?:)?\/\//.test(f) || f[0] === "/") return f;
    return (base || "") + "img/auto/" + f.replace(/^\/+/, "");
  };

  // più foto nello stesso campo, separate da "|": la prima è la copertina
  TG.fotoLista = (f, base) => String(f || "").split("|").map((x) => x.trim()).filter(Boolean).map((x) => TG.foto(x, base));

  /* ---------- colori carrozzeria ---------- */
  const COLORI = { nero: "#171a21", bianco: "#eceff3", grigio: "#7d8594", argento: "#b4bac5", antracite: "#3a404c", blu: "#2a55c4", azzurro: "#5aa0e6", rosso: "#c4202f", bordeaux: "#6f1d2b", verde: "#2f7355", giallo: "#e6b916", arancione: "#e4731f", marrone: "#6e4c37", beige: "#cdbfa5", oro: "#c9a24a" };
  TG.coloreHex = (nome) => {
    const n = TG.norm(nome);
    for (const k in COLORI) if (n.includes(k)) return COLORI[k];
    return COLORI.grigio;
  };
  const mix = (hex, to, t) => {
    const a = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const b = [1, 3, 5].map((i) => parseInt(to.slice(i, i + 2), 16));
    return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, "0")).join("");
  };

  /* ---------- sagome delle auto (illustrazione di riserva, quando manca la foto) ----------
     Ogni sagoma è un poligono con raggi di raccordo; il muso è a destra, come nel logo. */
  const SHAPES = {
    berlina: { w: [128, 372], r: 31, pts: [[52,156,6],[52,124,10],[62,108,10],[106,98,8],[132,66,20],[164,56,40],[292,56,50],[340,74,40],[386,98,18],[436,108,16],[454,122,16],[454,156,4]],
      glass: [[116,98],[138,69],[165,60],[290,60],[333,76],[372,98]], pillars: [214], belt: 98 },
    suv: { w: [132, 376], r: 33, pts: [[50,160,6],[50,118,10],[60,100,10],[102,92,8],[124,52,18],[152,40,40],[318,40,50],[374,62,40],[400,92,18],[440,102,16],[458,118,16],[458,160,4]],
      glass: [[110,92],[128,56],[154,45],[316,45],[366,64],[388,92]], pillars: [216], belt: 92 },
    citycar: { w: [146, 380], r: 30, pts: [[96,156,6],[96,116,12],[106,100,10],[128,60,16],[156,44,40],[266,44,50],[318,66,34],[350,98,16],[404,108,16],[432,122,16],[432,156,4]],
      glass: [[118,98],[134,64],[158,49],[264,49],[311,68],[338,98]], pillars: [212], belt: 98 },
    coupe: { w: [126, 378], r: 32, pts: [[50,156,6],[50,130,10],[62,116,10],[120,106,14],[192,80,30],[244,66,40],[304,64,40],[352,78,34],[396,100,16],[442,108,16],[458,122,16],[458,156,4]],
      glass: [[150,104],[196,82],[246,70],[302,68],[346,82],[380,104]], pillars: [], belt: 104 },
    station: { w: [124, 380], r: 31, pts: [[50,156,6],[50,112,10],[60,100,10],[108,94,8],[130,56,20],[160,48,40],[334,48,50],[384,74,38],[400,96,18],[442,106,16],[456,120,16],[456,156,4]],
      glass: [[114,94],[134,60],[162,52],[332,52],[374,74],[388,94]], pillars: [196, 262], belt: 94 },
  };
  // le sagome sono state disegnate larghe: le accorcio un po' per avere proporzioni da auto vera
  (() => {
    const K = 0.84, CX = 255, f = (x) => CX + (x - CX) * K;
    Object.keys(SHAPES).forEach((k) => {
      const s = SHAPES[k];
      s.pts.forEach((p) => (p[0] = f(p[0])));
      s.glass.forEach((p) => (p[0] = f(p[0])));
      s.pillars = s.pillars.map(f);
      s.w = s.w.map(f);
    });
  })();
  const tipoDa = (a) => {
    const c = TG.norm(a.carrozzeria), m = TG.norm(a.marca + " " + a.modello);
    if (/suv|fuoristrada|crossover/.test(c) || /\b(x1|x2|x3|q2|q3|q5|gla|glb|glc|t-roc|tiguan|countryman|t-cross)\b/.test(m)) return "suv";
    if (/city|citycar|utilitaria/.test(c) || /\b(smart|polo|fortwo|forfour|cooper|up)\b/.test(m)) return "citycar";
    if (/coupe|cabrio|spider/.test(c)) return "coupe";
    if (/station|wagon|touring|avant|variant|sw/.test(c)) return "station";
    return "berlina";
  };
  const rounded = (pts) => {
    // pts: [x,y,raggio]; unisce con curve quadratiche agli angoli
    const n = pts.length, out = [];
    for (let i = 0; i < n; i++) {
      const p = pts[i], a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
      const r = p[2] || 0;
      const d1 = Math.hypot(a[0] - p[0], a[1] - p[1]), d2 = Math.hypot(b[0] - p[0], b[1] - p[1]);
      const t1 = Math.min(r, d1 / 2) / d1, t2 = Math.min(r, d2 / 2) / d2;
      out.push([p[0] + (a[0] - p[0]) * t1, p[1] + (a[1] - p[1]) * t1, p[0], p[1], p[0] + (b[0] - p[0]) * t2, p[1] + (b[1] - p[1]) * t2]);
    }
    return "M" + out.map((o, i) => (i ? "L" : "") + o[0].toFixed(1) + " " + o[1].toFixed(1) + "Q" + o[2] + " " + o[3] + " " + o[4].toFixed(1) + " " + o[5].toFixed(1)).join("") + "Z";
  };
  let uid = 0;
  TG.carArt = (auto, opts) => {
    opts = opts || {};
    const id = "ca" + ++uid, S = SHAPES[tipoDa(auto)], col = TG.coloreHex(auto.colore);
    const top = mix(col, "#ffffff", 0.32), bot = mix(col, "#000000", 0.38);
    const d = rounded(S.pts), fx = S.pts[S.pts.length - 2][0], noseY = S.pts[S.pts.length - 3][1];
    const front = S.pts[S.pts.length - 1][0];
    const wheel = (cx) => `<g transform="translate(${cx} 155)"><circle r="${S.r}" fill="#0a0c10"/><circle r="${S.r * 0.64}" fill="url(#${id}r)"/><circle r="${S.r * 0.64}" fill="none" stroke="#0a0c10" stroke-width="1.5" opacity=".5"/>${[0, 72, 144, 216, 288].map((a) => `<path d="M0 0L0 ${-S.r * 0.62}" stroke="#0a0c10" stroke-width="3.2" stroke-linecap="round" transform="rotate(${a})" opacity=".55"/>`).join("")}<circle r="${S.r * 0.14}" fill="#0a0c10" opacity=".8"/></g>`;
    const glass = "M" + S.glass.map((p) => p.join(" ")).join("L") + "Z";
    const pill = S.pillars.map((x) => `<rect x="${x}" y="${S.glass[2][1] - 6}" width="5" height="${S.belt - S.glass[2][1] + 8}" fill="${col}"/>`).join("");
    const lampY = S.belt + 10;
    return `<svg class="art" viewBox="66 34 372 160" style="overflow:visible" role="img" aria-label="${TG.esc(auto.marca + " " + auto.modello)}" focusable="false">
<defs>
<linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset=".55" stop-color="${col}"/><stop offset="1" stop-color="${bot}"/></linearGradient>
<linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#27303f"/><stop offset="1" stop-color="#0c1017"/></linearGradient>
<radialGradient id="${id}r" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#e6eaf0"/><stop offset="1" stop-color="#7f8897"/></radialGradient>
<linearGradient id="${id}l" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#cfe6ff" stop-opacity=".95"/><stop offset=".35" stop-color="#8cc4ff" stop-opacity=".35"/><stop offset="1" stop-color="#8cc4ff" stop-opacity="0"/></linearGradient>
<radialGradient id="${id}s" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".5"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<clipPath id="${id}c"><path d="${d}"/></clipPath>
</defs>
<ellipse cx="${(S.pts[0][0] + front) / 2}" cy="187" rx="${(front - S.pts[0][0]) / 2 + 14}" ry="9" fill="url(#${id}s)"/>
<g class="beam" opacity="0"><path d="M${front - 4} ${lampY - 8} L${front + 100} ${lampY - 34} L${front + 100} ${lampY + 40} L${front - 4} ${lampY + 6}Z" fill="url(#${id}l)"/></g>
<path d="${d}" fill="url(#${id}b)"/>
<g clip-path="url(#${id}c)"><circle cx="${S.w[0]}" cy="155" r="${S.r + 8}" fill="#090b0f" opacity=".92"/><circle cx="${S.w[1]}" cy="155" r="${S.r + 8}" fill="#090b0f" opacity=".92"/><rect x="40" y="146" width="430" height="12" fill="#000" opacity=".28"/><path d="M60 ${S.belt + 6}H${front - 6}" stroke="#fff" stroke-opacity=".22" stroke-width="2"/></g>
<path d="${glass}" fill="url(#${id}g)"/><path d="${glass}" fill="#fff" opacity=".06"/>${pill}
<path d="M${S.glass[1][0] + 40} ${S.belt}V152M${S.pillars[0] ? S.pillars[0] + 2 : 240} ${S.belt}V152" stroke="#000" stroke-opacity=".22" stroke-width="1.2"/>
${wheel(S.w[0])}${wheel(S.w[1])}
<g class="lamp-f"><rect x="${front - 15}" y="${lampY - 9}" width="14" height="9" rx="3" fill="#dcebff"/><rect x="${front - 15}" y="${lampY - 9}" width="14" height="9" rx="3" fill="#cfe6ff" class="glow"/></g>
<rect x="${S.pts[0][0] + 1}" y="${S.pts[1][1] + 2}" width="9" height="8" rx="2" fill="#ff3347" opacity=".9" class="lamp-r"/>
</svg>`;
  };

  /* ---------- dati ---------- */
  TG.pulisci = (a) => {
    const n = (v) => (v === "" || v == null || isNaN(+v) ? null : +v);
    return {
      id: String(a.id || ""), stato: a.stato === "venduta" ? "venduta" : "disponibile",
      marca: String(a.marca || "").trim(), modello: String(a.modello || "").trim(), allestimento: String(a.allestimento || "").trim(),
      anno: n(a.anno), km: n(a.km), alimentazione: String(a.alimentazione || "").trim(), cambio: String(a.cambio || "").trim(),
      cv: n(a.cv), colore: String(a.colore || "").trim(), carrozzeria: String(a.carrozzeria || "").trim(),
      prezzo: n(a.prezzo), data_vendita: String(a.data_vendita || "").trim(), foto: String(a.foto || "").trim(),
      descrizione: String(a.descrizione || "").trim(), autoscout_url: String(a.autoscout_url || "").trim(), demo: !!a.demo,
    };
  };
  /* sito.titolare: nome e fino a 2 foto (nomi di file o indirizzi) per la sezione «Chi siamo» */
  TG.titolareDa = (j) => {
    const t = (j && j.sito && j.sito.titolare) || {};
    const l = Array.isArray(t.foto) ? t.foto : String(t.foto || "").split("|");
    return { nome: String(t.nome || "").trim().slice(0, 80), foto: l.map((x) => String(x).trim()).filter(Boolean).slice(0, 2) };
  };
  TG.carica = async (url) => {
    const r = await fetch(url, { cache: "no-cache" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const j = await r.json();
    if (!j || !Array.isArray(j.auto)) throw new Error("dati non validi");
    return { aggiornato: j.aggiornato || "", auto: j.auto.map(TG.pulisci), titolare: TG.titolareDa(j) };
  };
  /* testo stabile (chiavi in ordine) per confrontare due documenti */
  TG.canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, c) => ((o[c] = x[c]), o), {}) : x));
  TG.titolo = (a) => (a.marca + " " + a.modello).trim();
})();
