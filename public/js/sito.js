/* Borzi Auto · comportamento del sito (nessuna libreria esterna). */
(function () {
  "use strict";

  /* ============ DATI DELL'AZIENDA: l'unico punto da compilare ============
     Quello che resta vuoto ("") non compare sul sito: pulsanti «Chiama» e WhatsApp, mappa, orari, piè di pagina
     e dati per Google si aggiornano da soli. */
  const CONFIG = {
    nome: "Borzi Auto",
    ragioneSociale: "",            // es. "Borzi Auto S.r.l." (se vuoto, nel piè di pagina compare il nome)
    tel: "+393398893539",          // numero da chiamare, con prefisso: "+390612345678"
    telVisibile: "339 889 3539",   // come lo leggono i clienti: "06 1234 5678" (se vuoto si usa tel)
    whatsapp: "393398893539",      // numero senza + e senza spazi: "393331234567"
    email: "",
    indirizzo: "Via dei Legatori, 74/76",   // via e numero civico: "Via Roma 1"
    cap: "00128", citta: "Roma", provincia: "RM",   // "00100", "Roma", "RM"
    piva: "",                      // solo le cifre: "01234567890"
    mappa: "",                     // facoltativo: link alla posizione su Google Maps (se vuoto si usa l'indirizzo)
    instagram: "",                 // link completo: "https://www.instagram.com/nomepagina/"
    autoscout: "",                 // link alla pagina del concessionario su AutoScout24
    google: "https://share.google/WuTIHVY3SAZBkdLh1",   // link alla scheda Google (recensioni e indicazioni)
    orari: [                       // giorni: 0 = domenica … 6 = sabato. Nessuna riga = nessun orario sul sito.
      { giorni: [1, 2, 3, 4, 5], nome: "Lunedì – Venerdì", fasce: "10:00–19:30" },
      { giorni: [6], nome: "Sabato", fasce: "10:30–13:00" },
      { giorni: [0], nome: "Domenica", fasce: "Chiuso" },
    ],
    // Titolare: nome e foto si impostano dal gestionale (voce «Titolare»). Qui restano i valori di riserva.
    titolare: { nome: "", ruolo: "Titolare", foto: [] },   // foto: ["img/nome-file.jpg", …] (prima grande, seconda piccola)
  };
  const MARCHE_ORDINE = [];        // facoltativo: marche da mostrare per prime nei filtri
  const $ = (s, r) => (r || document).querySelector(s);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- dati dell'azienda sulla pagina ---------- */
  const riga1 = CONFIG.indirizzo;
  const riga2 = [CONFIG.cap, CONFIG.citta].filter(Boolean).join(" ") + (CONFIG.provincia ? (CONFIG.citta ? " (" + CONFIG.provincia + ")" : CONFIG.provincia) : "");
  const completo = [riga1, riga2].filter(Boolean).join(", ");
  const V = {
    nome: CONFIG.nome,
    ragioneSociale: CONFIG.ragioneSociale || CONFIG.nome,
    tel: CONFIG.tel ? CONFIG.telVisibile || CONFIG.tel : "",
    whatsapp: CONFIG.whatsapp,
    email: CONFIG.email,
    riga1, riga2,
    indirizzo: riga1 || riga2,
    indirizzoCompleto: completo,
    piva: CONFIG.piva,
    instagram: CONFIG.instagram,
    instagramTesto: CONFIG.instagram ? "Instagram @" + CONFIG.instagram.replace(/[?#].*$/, "").replace(/\/+$/, "").split("/").pop() : "",
    anno: String(new Date().getFullYear()),
  };
  const HREF = {
    tel: CONFIG.tel ? "tel:" + CONFIG.tel.replace(/[^\d+]/g, "") : "",
    mail: CONFIG.email ? "mailto:" + CONFIG.email : "",
    maps: CONFIG.mappa || (completo ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(CONFIG.nome + " " + completo) : ""),
    instagram: CONFIG.instagram,
  };
  document.querySelectorAll("[data-se]").forEach((el) => { el.hidden = !V[el.dataset.se]; });
  document.querySelectorAll("[data-t]").forEach((el) => { if (el.dataset.t in V) el.textContent = V[el.dataset.t]; });
  document.querySelectorAll("[data-h]").forEach((el) => { if (HREF[el.dataset.h]) el.setAttribute("href", HREF[el.dataset.h]); });
  if (CONFIG.orari.length) {
    $("#orari-dl").innerHTML = CONFIG.orari.map((o) => `<div data-g="${o.giorni.join(",")}"><dt>${TG.esc(o.nome)}</dt><dd>${TG.esc(o.fasce)}</dd></div>`).join("");
    $("#orari").hidden = false;
  }
  // senza nessun recapito la sezione Contatti lo dice, invece di restare vuota
  function aggiornaContatti() {
    const vuoto = [...$("#contact-grid").children].every((c) => c.hidden || (c.id === "links" && ![...c.children].some((li) => !li.hidden)));
    $("#contatti-vuoto").hidden = !vuoto;
  }
  // dati strutturati per Google (schema.org), generati da CONFIG
  (function schemaOrg() {
    const o = { "@context": "https://schema.org", "@type": "AutoDealer", name: CONFIG.ragioneSociale || CONFIG.nome };
    if (/^https?:/.test(location.protocol)) o.url = location.origin + "/";
    if (CONFIG.tel) o.telephone = CONFIG.tel;
    if (CONFIG.email) o.email = CONFIG.email;
    if (CONFIG.indirizzo || CONFIG.citta) o.address = { "@type": "PostalAddress", streetAddress: CONFIG.indirizzo || undefined, postalCode: CONFIG.cap || undefined, addressLocality: CONFIG.citta || undefined, addressRegion: CONFIG.provincia || undefined, addressCountry: "IT" };
    if (/^\d{11}$/.test(CONFIG.piva)) o.vatID = "IT" + CONFIG.piva;
    const giorni = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const hh = (h, m) => String(h).padStart(2, "0") + ":" + m;
    const spec = [];
    CONFIG.orari.forEach((r) => String(r.fasce).split("·").forEach((f) => {
      const m = /(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/.exec(f);
      if (m) spec.push({ "@type": "OpeningHoursSpecification", dayOfWeek: r.giorni.map((g) => giorni[g]), opens: hh(m[1], m[2]), closes: hh(m[3], m[4]) });
    }));
    if (spec.length) o.openingHoursSpecification = spec;
    const sa = [CONFIG.instagram, CONFIG.google, CONFIG.autoscout].filter(Boolean);
    if (sa.length) o.sameAs = sa;
    const t = document.createElement("script");
    t.type = "application/ld+json";
    t.textContent = JSON.stringify(o);
    document.head.appendChild(t);
  })();

  /* ---------- testata: sfondo pieno dopo lo scroll, menu mobile ---------- */
  const top = $("#top");
  const onScroll = () => top.classList.toggle("solid", window.scrollY > 8);
  onScroll();
  addEventListener("scroll", onScroll, { passive: true });
  document.querySelectorAll(".menu a").forEach((a) => a.addEventListener("click", () => ($(".menu").open = false)));

  /* ---------- dati ---------- */
  let DISP = [], VEND = [];
  const stato = { marca: "", alim: "", ord: "recenti" };

  const art = (a) => {
    const f = TG.fotoLista(a.foto, "")[0];
    if (f) return `<img src="${TG.esc(f)}" alt="${TG.esc(TG.titolo(a) + " " + a.allestimento)}" loading="lazy" decoding="async">`;
    return TG.carArt(a);
  };
  // scheda: foto grande + miniature se ce n'è più di una
  const galleria = (a) => {
    const fs = TG.fotoLista(a.foto, "");
    if (!fs.length) return `<div class="sheet-media on">${TG.carArt(a)}</div>`;
    const alt = TG.esc(TG.titolo(a) + " " + a.allestimento);
    return `<div class="sheet-media on gal">
    <img class="gal-main" src="${TG.esc(fs[0])}" alt="${alt}" decoding="async">
    ${fs.length > 1 ? `<div class="gal-thumbs" role="group" aria-label="Altre foto">${fs.map((f, i) => `<button type="button" class="gal-t" aria-pressed="${i === 0}" aria-label="Foto ${i + 1} di ${fs.length}" data-src="${TG.esc(f)}"><img src="${TG.esc(f)}" alt="" loading="lazy"></button>`).join("")}</div>` : ""}
  </div>`;
  };

  function ordina(lista, ord) {
    const l = lista.slice(), nz = (v, d) => (v == null ? d : v);
    const cmp = {
      recenti: (a, b) => nz(b.anno, 0) - nz(a.anno, 0) || nz(a.km, 1e9) - nz(b.km, 1e9),
      "prezzo-asc": (a, b) => nz(a.prezzo, 1e12) - nz(b.prezzo, 1e12),
      "prezzo-desc": (a, b) => nz(b.prezzo, -1) - nz(a.prezzo, -1),
      "km-asc": (a, b) => nz(a.km, 1e9) - nz(b.km, 1e9),
    }[ord];
    return l.sort(cmp);
  }

  function specs(a) {
    return [a.anno, a.km != null ? TG.km(a.km) : "", a.alimentazione, a.cambio, a.cv ? a.cv + " CV" : ""].filter(Boolean).map((s) => `<li>${TG.esc(s)}</li>`).join("");
  }

  function cardAuto(a, i) {
    return `<article class="car" style="--i:${Math.min(i, 12)}">
  <div class="stage">${art(a)}${a.demo ? '<span class="tag-demo">Esempio</span>' : ""}</div>
  <div class="car-body">
    <div><h3>${TG.esc(TG.titolo(a))}</h3>${a.allestimento ? `<p class="trim">${TG.esc(a.allestimento)}</p>` : ""}</div>
    <ul class="specs">${specs(a)}</ul>
    <div class="buy"><span class="price">${TG.euroHtml(a.prezzo)}</span><span class="more">Dettagli</span></div>
  </div>
  <button type="button" class="car-hit" data-id="${TG.esc(a.id)}" aria-label="Dettagli: ${TG.esc(TG.titolo(a))} ${TG.esc(a.allestimento)}"></button>
</article>`;
  }

  function renderGriglia() {
    let l = DISP.filter((a) => (!stato.marca || a.marca === stato.marca) && (!stato.alim || a.alimentazione === stato.alim));
    l = ordina(l, stato.ord);
    $("#griglia").innerHTML = l.map(cardAuto).join("");
    $("#vuoto").hidden = l.length > 0;
    const tot = DISP.length;
    $("#conteggio").textContent = !tot ? "" : l.length === tot ? `${tot} auto` : `${l.length} di ${tot} auto`;
  }

  function costruisciFiltri() {
    const marche = [...new Set(DISP.map((a) => a.marca).filter(Boolean))];
    marche.sort((x, y) => {
      const i = MARCHE_ORDINE.indexOf(x), j = MARCHE_ORDINE.indexOf(y);
      return (i < 0 ? 99 : i) - (j < 0 ? 99 : j) || x.localeCompare(y, "it");
    });
    const chips = $("#chips");
    chips.innerHTML = ["", ...marche].map((m) => `<button type="button" class="chip" data-m="${TG.esc(m)}" aria-pressed="${m === "" ? "true" : "false"}"><span>${m || "Tutte"}</span></button>`).join("");
    chips.addEventListener("click", (e) => {
      const b = e.target.closest(".chip");
      if (!b) return;
      stato.marca = b.dataset.m;
      chips.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c === b)));
      renderGriglia();
    });
    const alim = [...new Set(DISP.map((a) => a.alimentazione).filter(Boolean))].sort((a, b) => a.localeCompare(b, "it"));
    $("#f-alim").insertAdjacentHTML("beforeend", alim.map((x) => `<option>${TG.esc(x)}</option>`).join(""));
    $("#f-alim").addEventListener("change", (e) => ((stato.alim = e.target.value), renderGriglia()));
    $("#f-ord").addEventListener("change", (e) => ((stato.ord = e.target.value), renderGriglia()));
    $("#filtri").hidden = false;
  }

  /* ---------- vendute ---------- */
  function renderVendute() {
    const sec = $("#vendute");
    if (!VEND.length) {
      sec.hidden = true;
      document.querySelectorAll('a[href="#vendute"]').forEach((a) => (a.hidden = true));
      return;
    }
    const l = VEND.slice().sort((a, b) => (b.data_vendita || "").localeCompare(a.data_vendita || ""));
    $("#rail").innerHTML = l.map((a) => `<article class="sold-card">
  <div class="stage">${art(a)}${a.demo ? '<span class="tag-demo">Esempio</span>' : ""}</div>
  <div class="sold-body">
    <h3>${TG.esc(TG.titolo(a))}</h3>
    ${a.allestimento ? `<p class="trim">${TG.esc(a.allestimento)}</p>` : ""}
    <ul class="specs">${[a.anno, a.alimentazione].filter(Boolean).map((s) => `<li>${TG.esc(s)}</li>`).join("")}</ul>
    <p class="sold-flag">Venduta${a.data_vendita ? " · " + TG.esc(TG.mese(a.data_vendita)) : ""}</p>
  </div>
  <i class="tail"></i>
</article>`).join("");
    const n = l.length;
    $("#sold-lead").innerHTML = `${n} ${n === 1 ? "auto ha già trovato" : "auto hanno già trovato"} un nuovo proprietario.${V.tel ? ` Ne cerchi una simile? <a href="${HREF.tel}">Chiamaci</a>.` : ""}`;
    const rail = $("#rail");
    const nav = $("#rail-nav");
    const step = () => Math.max(260, rail.clientWidth * 0.7);
    $("#r-prev").onclick = () => rail.scrollBy({ left: -step(), behavior: reduce ? "auto" : "smooth" });
    $("#r-next").onclick = () => rail.scrollBy({ left: step(), behavior: reduce ? "auto" : "smooth" });
    const aggiornaNav = () => (nav.hidden = rail.scrollWidth <= rail.clientWidth + 4);
    aggiornaNav();
    addEventListener("resize", aggiornaNav);
    const cards = rail.querySelectorAll(".sold-card");
    if ("IntersectionObserver" in window && !reduce) {
      const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("seen"); io.unobserve(e.target); } }), { root: rail, threshold: 0.6 });
      cards.forEach((c) => io.observe(c));
    } else cards.forEach((c) => c.classList.add("seen"));
  }

  /* ---------- scheda auto ---------- */
  const dlg = $("#scheda");
  let ultimoFocus = null;
  function apriScheda(id) {
    const a = DISP.find((x) => x.id === id);
    if (!a) return;
    ultimoFocus = document.activeElement;
    const titolo = TG.titolo(a);
    const righe = [["Anno", a.anno], ["Chilometri", a.km != null ? TG.km(a.km) : ""], ["Alimentazione", a.alimentazione], ["Cambio", a.cambio], ["Potenza", a.cv ? a.cv + " CV" : ""], ["Colore", a.colore], ["Carrozzeria", a.carrozzeria]]
      .filter((r) => r[1]).map((r) => `<dt>${r[0]}</dt><dd>${TG.esc(r[1])}</dd>`).join("");
    const msg = `Buongiorno, vorrei informazioni su ${titolo}${a.allestimento ? " " + a.allestimento : ""}${a.anno ? " del " + a.anno : ""}.`;
    dlg.innerHTML = `<div class="sheet">
  <button type="button" class="close" aria-label="Chiudi la scheda"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg></button>
  ${galleria(a)}
  <div class="sheet-info">
    <div><h2 id="scheda-titolo">${TG.esc(titolo)}</h2>${a.allestimento ? `<p class="trim">${TG.esc(a.allestimento)}</p>` : ""}</div>
    <p class="sheet-price">${TG.euroHtml(a.prezzo)}</p>
    <dl>${righe}</dl>
    ${a.descrizione ? `<p class="sheet-text">${TG.esc(a.descrizione)}</p>` : ""}
    <div class="sheet-actions">
      ${V.tel ? `<a class="btn btn-primary" href="${HREF.tel}">Chiama</a>` : ""}
      ${CONFIG.whatsapp ? `<a class="btn btn-soft" href="https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
      ${CONFIG.email ? `<a class="btn btn-soft" href="mailto:${CONFIG.email}?subject=${encodeURIComponent("Informazioni: " + titolo)}&body=${encodeURIComponent(msg)}">Email</a>` : ""}
      ${a.autoscout_url ? `<a class="txt" href="${TG.esc(a.autoscout_url)}" target="_blank" rel="noopener">Vedi su AutoScout24</a>` : ""}
    </div>
  </div>
</div>`;
    dlg.showModal();
    document.documentElement.style.overflow = "hidden";
  }
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg || e.target.closest(".close")) return dlg.close();
    const t = e.target.closest(".gal-t");
    if (t) {
      dlg.querySelector(".gal-main").src = t.dataset.src;
      dlg.querySelectorAll(".gal-t").forEach((x) => x.setAttribute("aria-pressed", String(x === t)));
    }
  });
  dlg.addEventListener("close", () => {
    document.documentElement.style.overflow = "";
    if (ultimoFocus && ultimoFocus.focus) ultimoFocus.focus({ preventScroll: true });
  });
  $("#griglia").addEventListener("click", (e) => { const b = e.target.closest(".car-hit"); if (b) apriScheda(b.dataset.id); });


  /* ---------- titolare e recensioni di Google ----------
     Le recensioni arrivano da /api/recensioni (Worker di Cloudflare, vedi README). Se non è configurato
     o non risponde, il sito usa data/recensioni.json. Se anche quello manca, la sezione mostra solo il titolare. */
  /* Titolare: nome e foto arrivano dal gestionale (API) o da CONFIG. Senza foto la sezione resta con testo e pulsanti. */
  const sezTit = $("#titolare");
  function mostraTitolare(t) {
    t = t || {};
    const nome = String(t.nome || CONFIG.titolare.nome || "").trim();
    const ruolo = CONFIG.titolare.ruolo || "Titolare";
    $("#o-nome").textContent = nome || "Il " + ruolo.toLowerCase();
    $("#o-sub").textContent = (nome ? ruolo + " di " : "") + CONFIG.nome + (CONFIG.citta ? " · " + CONFIG.citta + (CONFIG.provincia ? " (" + CONFIG.provincia + ")" : "") : "");
    if (CONFIG.whatsapp) $("#o-wa").href = "https://wa.me/" + CONFIG.whatsapp;
    const foto = (Array.isArray(t.foto) && t.foto.length ? t.foto : CONFIG.titolare.foto || []).filter(Boolean).slice(0, 2);
    const duo = $("#duo");
    const h = $("#t-titolare"), hp = $("#t-titolare-p");
    if (!foto.length) {
      duo.hidden = true; duo.innerHTML = ""; sezTit.classList.add("no-foto");
      h.textContent = "Dicono di noi";
      const via = [V.tel && "chiama", CONFIG.whatsapp && "scrivi su WhatsApp"].filter(Boolean).join(" o ");
      hp.textContent = "Le recensioni dei clienti su Google." + (via ? " Per parlare direttamente con il titolare " + via + "." : "");
      return;
    }
    h.textContent = "Ci mettiamo la faccia.";
    const modi = [V.tel && "chiamarlo", CONFIG.whatsapp && "scrivergli su WhatsApp", completo && "venire a trovarlo in " + completo].filter(Boolean);
    hp.textContent = "Dietro ogni auto in vetrina c’è il titolare." + (modi.length ? " Puoi " + (modi.length > 1 ? modi.slice(0, -1).join(", ") + " o " + modi[modi.length - 1] : modi[0]) + "." : "");
    const alt = "Il " + ruolo.toLowerCase() + " di " + CONFIG.nome + (nome ? ", " + nome : "");
    duo.className = "duo" + (foto.length === 1 ? " solo" : "");
    duo.innerHTML = `<div class="ph ph-main"><img src="${TG.esc(foto[0])}" alt="${TG.esc(alt)}" decoding="async"></div>` +
      (foto[1] ? `<div class="ph ph-side"><img src="${TG.esc(foto[1])}" alt="${TG.esc(alt)}" loading="lazy" decoding="async"></div>` : "");
    duo.hidden = false;
    sezTit.classList.remove("no-foto");
  }
  mostraTitolare(null);
  if ("IntersectionObserver" in window && !reduce) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { sezTit.classList.add("in"); io.disconnect(); } }), { threshold: 0.28 });
    io.observe(sezTit);
  }

  /* orari: evidenzia la riga di oggi (giorno secondo l'ora italiana) */
  (function orari() {
    const g = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[new Date().toLocaleDateString("en-US", { weekday: "short", timeZone: "Europe/Rome" })];
    document.querySelectorAll("#orari [data-g]").forEach((r) => {
      if (r.dataset.g.split(",").map(Number).includes(g)) { r.classList.add("oggi"); r.setAttribute("aria-current", "date"); }
    });
  })();

  const https = (u) => (/^https:\/\//i.test(String(u || "")) ? String(u) : "");
  const voto1 = (n) => (Math.round(n * 10) / 10).toFixed(1).replace(".", ",");
  const pct = (n) => Math.max(0, Math.min(100, (n / 5) * 100)).toFixed(0) + "%";

  async function caricaRecensioni() {
    if (window.__REC__) return window.__REC__;              // pagina dimostrativa: dati incorporati
    const prova = async (u) => {
      const r = await fetch(u, { headers: { accept: "application/json" } });
      if (!r.ok) throw new Error(String(r.status));
      const d = await r.json();
      if (!d || !Array.isArray(d.recensioni) || !d.recensioni.length) throw new Error("vuoto");
      return d;
    };
    try { return await prova("/api/recensioni"); } catch (e) { return prova("data/recensioni.json"); }
  }

  function tagliaTesto(s, max) {
    s = String(s || "").replace(/\s+/g, " ").trim();
    if (s.length <= max) return s;
    return s.slice(0, max).replace(/\s+\S*$/, "") + "…";
  }

  function cardRecensione(r, demo) {
    const nome = tagliaTesto(r.autore || "Cliente", 60);
    const prof = https(r.profilo), foto = https(r.foto);
    const stelle = Math.max(1, Math.min(5, Math.round(+r.stelle || 5)));
    const av = foto
      ? `<span class="av"><img src="${TG.esc(foto)}" alt="" width="38" height="38" loading="lazy" referrerpolicy="no-referrer"></span>`
      : `<span class="av" aria-hidden="true">${TG.esc(nome.charAt(0).toUpperCase())}</span>`;
    const chi = prof ? `<a href="${TG.esc(prof)}" target="_blank" rel="noopener">${TG.esc(nome)}</a>` : `<b>${TG.esc(nome)}</b>`;
    return `<article class="rev" role="listitem">
  <span class="stars" style="--p:${pct(stelle)}" role="img" aria-label="${stelle} stelle su 5"></span>
  <blockquote><p>${TG.esc(tagliaTesto(r.testo, 520))}</p></blockquote>
  <footer class="rev-by">${av}<span>${chi}<small>${TG.esc([r.quando, "Google"].filter(Boolean).join(" · "))}</small></span></footer>
  ${r.demo || demo ? '<span class="tag-demo">Esempio</span>' : ""}
</article>`;
  }

  caricaRecensioni().then((d) => {
    const lista = d.recensioni.slice(0, 6);
    const demo = !!d.demo;
    $("#revs").innerHTML = lista.map((r) => cardRecensione(r, demo)).join("");
    $("#people-grid").style.setProperty("--rows", Math.ceil(lista.length / 2));
    if (+d.voto > 0) {
      $("#rate-n").textContent = voto1(+d.voto);
      const st = $("#rate-stars");
      st.style.setProperty("--p", pct(+d.voto));
      st.setAttribute("aria-label", `${voto1(+d.voto)} stelle su 5`);
      $("#rate-tot").textContent = +d.totale > 0 ? `${d.totale} recensioni su Google` : "Recensioni su Google";
      const tutte = https(d.tutte || d.mappa || CONFIG.google);
      if (tutte) { const a = $("#rate-all"); a.href = tutte; a.hidden = false; }
      $("#rate").hidden = false;
    }
    $("#rate-demo").hidden = !demo;
    const scrivi = https(d.scrivi || CONFIG.google);
    if (scrivi) { $("#rev-write").href = scrivi; $("#rev-foot").hidden = false; }
  }).catch(() => { /* nessuna recensione disponibile: resta il titolare */ });

  /* ---------- avvio ---------- */
  if (CONFIG.autoscout) { $("#as24").href = CONFIG.autoscout; $("#li-as24").hidden = false; $("#as24-top").href = CONFIG.autoscout; $("#as24-top").hidden = false; }
  if (CONFIG.google) { $("#g-link").href = CONFIG.google; $("#li-google").hidden = false; }
  aggiornaContatti();

  /* le auto arrivano dall'archivio online (api/auto) se esiste; altrimenti dal file data/auto.json pubblicato a mano */
  TG.carica("api/auto").catch(() => TG.carica("data/auto.json")).then((d) => {
    if (d.titolare && (d.titolare.nome || d.titolare.foto.length)) mostraTitolare({ nome: d.titolare.nome, foto: d.titolare.foto.map((f) => TG.foto(f, "")) });
    DISP = d.auto.filter((a) => a.stato === "disponibile" && a.marca);
    VEND = d.auto.filter((a) => a.stato === "venduta" && a.marca);
    $("#nota-demo").hidden = !d.auto.some((a) => a.demo);
    if (!DISP.length) {
      $("#griglia").innerHTML = `<p class="empty" style="grid-column:1/-1">Al momento non ci sono auto in vetrina.${V.tel ? ` Chiamaci al <a href="${HREF.tel}">${TG.esc(V.tel)}</a>.` : ""}</p>`;
    } else {
      costruisciFiltri();
      renderGriglia();
    }
    renderVendute();
  }).catch(() => {
    $("#griglia").innerHTML = `<p class="empty" style="grid-column:1/-1">Non riesco a caricare l’elenco delle auto.${V.tel ? ` Chiamaci al <a href="${HREF.tel}">${TG.esc(V.tel)}</a>.` : ""}</p>`;
    $("#vendute").hidden = true;
  });
})();
