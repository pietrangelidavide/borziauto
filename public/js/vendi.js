/* Borzi Auto · «Vendi la tua auto» (lato cliente): modulo con i dati dell'auto, le foto e i contatti.
   Due modi, scelti da soli:
     - online: se /api/vendi risponde «attivo» (Worker + database D1 + garage.json › moduli › vendi), le foto si riducono nel browser
       e la richiesta viaggia al Worker (src/richieste.js) fino al gestionale (scheda «Valutazioni»).
     - senza server: niente foto da caricare; la richiesta diventa un messaggio WhatsApp (o un'email) già scritto, con tutti i dati.
   Le regole sono quelle di js/richieste-core.js, le stesse che il Worker ricontrolla. */
(function () {
  "use strict";
  const AP = (window.AP = window.AP || {});
  const R = AP.Richieste;
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => TG.esc(s);
  const S = { c: {}, online: false, foto: [], min: R ? R.FOTO_MIN : 4, max: R ? R.FOTO_MAX : 10, byte: R ? R.FOTO_BYTE : 700 * 1024, occupato: false };
  const CAMPI = ["marca", "modello", "versione", "targa", "anno", "km", "alimentazione", "cambio", "condizioni", "incidenti", "finanziata", "tagliandi", "difetti", "cosa", "prezzo", "quando", "nome", "telefono", "email", "contatto_pref", "note"];
  const lab = (lista, k) => (lista.find((x) => x[0] === k) || [0, ""])[1];
  const num = (n) => new Intl.NumberFormat("it-IT").format(n);
  const wa = () => String(S.c.whatsapp || "").replace(/\D/g, "");
  const form = () => $("#vd-form");
  const campo = (k) => (k === "foto" ? $("#vd-foto-box") : form().elements[k === "consenso" ? "privacy" : k]);

  /* ---------- errori ---------- */
  function errore(msg, chiavi) {
    const e = $("#vd-err"); e.textContent = msg || ""; e.hidden = !msg;
    document.querySelectorAll("#vd-form [aria-invalid]").forEach((x) => x.removeAttribute("aria-invalid"));
    const els = (chiavi || []).map(campo).filter(Boolean).sort((a, b) => (a.compareDocumentPosition(b) & 4 ? -1 : 1));    // dall'alto verso il basso
    els.forEach((el) => el.setAttribute("aria-invalid", "true"));
    if (els[0] && els[0].focus) els[0].focus();
  }

  /* ---------- lettura e controllo del modulo ---------- */
  function leggi() {
    const f = form(), p = {};
    CAMPI.forEach((k) => { p[k] = f.elements[k].value; });
    p.consenso_privacy = S.online ? f.elements.privacy.checked : true;           // senza server i dati restano nel messaggio che invia il cliente
    p.sito = f.elements.sito.value;
    return p;
  }
  function controlla(p) {
    const v = R.valida(p, S.online ? S.foto.length : null);
    if (!v.ok) {
      const k = Object.keys(v.errori), els = k.map((x) => [x, campo(x)]).sort((a, b) => (a[1] && b[1] ? (a[1].compareDocumentPosition(b[1]) & 4 ? -1 : 1) : 0));
      errore(v.errori[els[0][0]] + (k.length > 1 ? " Controlla anche gli altri campi evidenziati." : ""), k);
    }
    return v;
  }

  /* ---------- foto (solo online) ---------- */
  async function riduci(file) {
    let img;
    try { img = await createImageBitmap(file, { imageOrientation: "from-image" }); }
    catch (e) {
      img = await new Promise((ok, ko) => { const u = URL.createObjectURL(file), i = new Image(); i.onload = () => { URL.revokeObjectURL(u); ok(i); }; i.onerror = () => { URL.revokeObjectURL(u); ko(new Error("immagine")); }; i.src = u; });
    }
    const w0 = img.width || img.naturalWidth, h0 = img.height || img.naturalHeight;
    if (!w0 || !h0) throw new Error("immagine");
    let lato = 1600, q = 0.84, blob = null;
    for (let i = 0; i < 9; i++) {
      const k = Math.min(1, lato / Math.max(w0, h0)), c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(w0 * k)); c.height = Math.max(1, Math.round(h0 * k));
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      blob = await new Promise((ok) => c.toBlob(ok, "image/jpeg", q));
      if (!blob) throw new Error("jpeg");
      if (blob.size <= S.byte) break;
      if (q > 0.6) q -= 0.08; else lato = Math.round(lato * 0.8);
    }
    if (img.close) img.close();
    if (blob.size > S.byte) throw new Error("peso");
    return blob;
  }
  function disegnaFoto() {
    const n = S.foto.length, c = $("#vd-cnt");
    $("#vd-thumbs").innerHTML = S.foto.map((f, i) => `<li class="vd-th"><img src="${f.url}" alt="Foto ${i + 1}"><button type="button" data-i="${i}" aria-label="Togli la foto ${i + 1}">×</button></li>`).join("");
    c.textContent = n >= S.min ? `${n} foto aggiunte. Puoi metterne fino a ${S.max}.` : `${n} di ${S.min} foto: ne servono almeno ${S.min} (al massimo ${S.max}).`;
    c.classList.toggle("ok", n >= S.min);
    $("#vd-foto-box").removeAttribute("aria-invalid");
    $("#vd-add").hidden = n >= S.max;
  }
  async function aggiungi(files) {
    const lista = [...files].filter((f) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name));
    let male = 0, troppe = false;
    const btn = $("#vd-add span"), txt = btn.textContent; btn.textContent = "Preparo le foto…";
    for (const f of lista) {
      if (S.foto.length >= S.max) { troppe = true; break; }
      try { const blob = await riduci(f); S.foto.push({ blob, url: URL.createObjectURL(blob) }); disegnaFoto(); } catch (e) { male++; }
    }
    btn.textContent = txt;
    if (male) errore(`Non riesco a leggere ${male === 1 ? "una foto" : male + " foto"}: prova con file JPEG o PNG.`, []);
    else if (troppe) errore(`Al massimo ${S.max} foto.`, []);
    else errore("");
  }

  /* ---------- senza server: messaggio già scritto ---------- */
  function testo(v) {
    const cosa = v.cosa === "permuta" ? "darla in permuta" : v.cosa === "valutare" ? "sapere quanto vale" : "venderla";
    const r = [`Buongiorno, sono ${v.nome}. Vorrei ${cosa}: la mia auto è una ${[v.marca, v.modello, v.versione].filter(Boolean).join(" ")}, anno ${v.anno}, ${num(v.km)} km, ${v.alimentazione.toLowerCase()}, cambio ${v.cambio.toLowerCase()}.`];
    r.push(`Condizioni: ${lab(R.CONDIZIONI, v.condizioni).toLowerCase()}. Incidenti: ${lab(R.INCIDENTI, v.incidenti).toLowerCase()}. Finanziamento o leasing: ${lab(R.FINANZIATA, v.finanziata).charAt(0).toLowerCase() + lab(R.FINANZIATA, v.finanziata).slice(1)}.`);
    if (v.tagliandi) r.push(`Tagliandi: ${lab(R.TAGLIANDI, v.tagliandi).toLowerCase()}.`);
    if (v.targa) r.push(`Targa: ${v.targa}.`);
    if (v.difetti) r.push(`Da sistemare: ${v.difetti}`);
    if (v.prezzo) r.push(`Prezzo che avevo in mente: ${num(v.prezzo)} €.`);
    if (v.quando) r.push(`Tempi: ${lab(R.QUANDO, v.quando).toLowerCase()}.`);
    r.push(`Il mio numero è ${v.telefono}${v.contatto_pref ? " (preferisco " + lab(R.CONTATTO, v.contatto_pref).toLowerCase() + ")" : ""}.${v.note ? " " + v.note : ""}`);
    r.push("Vi mando le foto qui di seguito. Grazie.");
    return r.join("\n");
  }
  function mostraMessaggio(v) {
    const msg = testo(v.valori), n = wa(), c = S.c, titolo = [v.valori.marca, v.valori.modello, v.valori.anno].filter(Boolean).join(" ");
    const box = $("#vd-ok");
    form().hidden = true; box.hidden = false;
    box.innerHTML = `<h3 id="vd-ok-t" tabindex="-1">Ultimo passo: invia la richiesta</h3>
      <p>${n ? "Si apre WhatsApp con il messaggio già scritto, con tutti i dati della tua auto. Premi «Invia» e mandaci anche le foto: davanti, dietro, un lato, gli interni e il cruscotto con i chilometri." : c.email ? "Si apre la tua posta con la richiesta già scritta. Allega le foto: davanti, dietro, un lato, gli interni e il cruscotto con i chilometri." : "Chiamaci e ti diciamo come fare."}</p>
      <div class="vd-az">${n ? `<a class="btn btn-primary" id="vd-wa-go" href="https://wa.me/${n}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">Invia su WhatsApp</a>` : ""}${c.email ? `<a class="btn ${n ? "btn-line" : "btn-primary"}" href="mailto:${esc(c.email)}?subject=${encodeURIComponent("Valutazione auto: " + titolo)}&body=${encodeURIComponent(msg)}">Invia per email</a>` : ""}${!n && !c.email && c.tel ? `<a class="btn btn-primary" href="tel:${esc(String(c.tel).replace(/[^+\d]/g, ""))}">Chiama ${esc(c.tel)}</a>` : ""}<button type="button" class="btn btn-line" id="vd-indietro">Modifica i dati</button></div>
      <p class="pr-nota">Finché non ti rispondiamo, la tua è solo una richiesta di valutazione: non ti impegna a nulla.</p>`;
    $("#vd-ok-t").focus();
  }

  /* ---------- online: invio al Worker ---------- */
  function mostraOk(nome) {
    const box = $("#vd-ok");
    form().hidden = true; box.hidden = false;
    box.innerHTML = `<h3 id="vd-ok-t" tabindex="-1">Richiesta inviata. Grazie${nome ? ", " + esc(nome.split(" ")[0]) : ""}!</h3>
      <p>Abbiamo ricevuto i dati e le foto della tua auto. Ti contattiamo noi, al numero che hai lasciato, con una valutazione.</p>
      <div class="vd-az"><button type="button" class="btn btn-line" id="vd-altra">Valuta un’altra auto</button></div>`;
    $("#vd-ok-t").focus();
  }
  async function invia(ev) {
    ev.preventDefault();
    if (S.occupato) return;
    errore("");
    const p = leggi(), v = controlla(p);
    if (!v.ok) return;
    if (!S.online) return mostraMessaggio(v);
    const btn = $("#vd-invia");
    S.occupato = true; btn.disabled = true; btn.textContent = "Invio in corso…";
    try {
      const fd = new FormData();
      fd.append("dati", JSON.stringify(Object.assign({}, p, { consenso_privacy: true, consenso_marketing: false })));
      S.foto.forEach((f, i) => fd.append("foto", f.blob, `foto-${i + 1}.jpg`));
      const res = await fetch("api/vendi", { method: "POST", body: fd });
      let j = {}; try { j = await res.json(); } catch (e) { /* risposta senza JSON */ }
      if (res.status === 201 || (res.ok && j.ok)) { reset(); return mostraOk(p.nome); }
      if (res.status === 422 && j.errori) { const k = Object.keys(j.errori); return errore(j.errori[k[0]], k); }
      errore(j.messaggio || `Non siamo riusciti a inviare la richiesta. Riprova o chiamaci${S.c.tel ? " al " + S.c.tel : ""}.`);
    } catch (e) { errore("Connessione assente: la richiesta non è partita. Riprova tra poco."); }
    finally { S.occupato = false; btn.disabled = false; btn.textContent = "Invia la richiesta"; }
  }
  function reset() {
    form().reset();
    S.foto.forEach((f) => URL.revokeObjectURL(f.url)); S.foto = [];
    if (S.online) disegnaFoto();
    errore("");
  }

  /* ---------- avvio ---------- */
  AP.Vendi = {
    async init(o) {
      S.c = o || {};
      if (!$("#vendi") || !R) return;
      const mostra = (on) => document.querySelectorAll("[data-modulo=vendi]").forEach((e) => (e.hidden = !on));
      let cfg = {};
      try { const r = await fetch("garage.json", { cache: "no-cache" }); if (r.ok) cfg = await r.json(); } catch (e) { /* senza garage.json il modulo resta acceso */ }
      if (cfg.moduli && cfg.moduli.vendi === false) return mostra(false);          // spento da garage.json: sezione, menu e collegamenti spariscono
      try {
        const r = await fetch("api/vendi", { headers: { accept: "application/json" }, cache: "no-store" });
        const j = r.ok ? await r.json() : null;
        if (j && j.attivo === true) { S.online = true; if (j.foto) { S.min = j.foto.min || S.min; S.max = j.foto.max || S.max; S.byte = j.foto.byte || S.byte; } }
      } catch (e) { /* nessun server: si va avanti con WhatsApp */ }

      const f = form(), opz = (nome, voci) => voci.forEach((v) => { const o2 = document.createElement("option"); o2.value = Array.isArray(v) ? v[0] : v; o2.textContent = Array.isArray(v) ? v[1] : v; f.elements[nome].appendChild(o2); });
      opz("alimentazione", R.ALIMENTAZIONI); opz("cambio", R.CAMBI); opz("condizioni", R.CONDIZIONI); opz("incidenti", R.INCIDENTI); opz("finanziata", R.FINANZIATA);
      opz("tagliandi", R.TAGLIANDI); opz("cosa", R.COSA); opz("quando", R.QUANDO); opz("contatto_pref", R.CONTATTO);

      const tel = $("#vd-tel"), w = $("#vd-wa");
      if (S.c.tel) { tel.href = "tel:" + String(S.c.tel).replace(/[^+\d]/g, ""); tel.hidden = false; }
      if (wa()) { w.href = "https://wa.me/" + wa(); w.hidden = false; }
      $("#vd-o").hidden = !(S.c.tel && wa());
      $("#vd-alt").hidden = !(S.c.tel || wa());

      if (S.online) {
        $("#vd-foto-box").hidden = false; $("#vd-chk").hidden = false; disegnaFoto();
        $("#vd-file").addEventListener("change", (e) => { const l = [...e.target.files]; e.target.value = ""; aggiungi(l); });
        $("#vd-thumbs").addEventListener("click", (e) => {
          const b = e.target.closest("button[data-i]"); if (!b) return;
          const x = S.foto.splice(+b.dataset.i, 1)[0]; if (x) URL.revokeObjectURL(x.url);
          disegnaFoto();
        });
      } else {
        $("#vd-foto-nota").hidden = false; $("#vd-priv").hidden = false;
        $("#vd-invia").textContent = "Prepara la richiesta";
        $("#vd-nota").textContent = "La valutazione è senza impegno. Al passo dopo si apre WhatsApp con il messaggio già scritto.";
        if (!wa() && S.c.email) $("#vd-nota").textContent = "La valutazione è senza impegno. Al passo dopo si apre la tua posta con la richiesta già scritta.";
      }
      f.addEventListener("submit", invia);
      f.addEventListener("input", (e) => { if (e.target.getAttribute && e.target.getAttribute("aria-invalid")) e.target.removeAttribute("aria-invalid"); });
      $("#vd-ok").addEventListener("click", (e) => {
        const id = e.target.id;
        if (id === "vd-indietro" || id === "vd-altra") { $("#vd-ok").hidden = true; form().hidden = false; form().scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); }
      });
      mostra(true);
    },
    senzaServer: () => !S.online,
  };
})();
