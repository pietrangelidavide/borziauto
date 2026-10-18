/* AutoProfit · foto delle auto caricate a mano.
   Le foto si scelgono dalla galleria del telefono, dalla fotocamera o dal computer, si ridimensionano nel browser
   (max 1600 px, JPEG, sotto 850 KB) e restano in questo browser (IndexedDB). Con l'archivio online partono da sole
   verso il server; in modalità locale il pacchetto .zip le contiene in img/auto/. */
(function () {
  "use strict";
  const GT = (window.GT = window.GT || {});
  const DBN = "autoprofit.foto.v1", ST = "foto";
  const URLS = {};      // nome → indirizzo temporaneo per l'anteprima
  const BLOBS = {};     // nome → Blob (copia in memoria: funziona anche se IndexedDB non è disponibile)
  let db = null, dbOk = true;
  const LEGGERA = 850 * 1024;      // il server accetta fino a 900 KB per foto

  const apriDb = () => new Promise((ok, ko) => {
    if (db) return ok(db);
    let r;
    try { r = indexedDB.open(DBN, 1); } catch (e) { return ko(e); }
    r.onupgradeneeded = () => r.result.createObjectStore(ST, { keyPath: "name" });
    r.onsuccess = () => { db = r.result; ok(db); };
    r.onerror = () => ko(r.error);
    r.onblocked = () => ko(new Error("blocked"));
  });
  const richiesta = (modo, fn) => apriDb().then((d) => new Promise((ok, ko) => {
    const t = d.transaction(ST, modo), req = fn(t.objectStore(ST));
    t.oncomplete = () => ok(req ? req.result : undefined);
    t.onerror = t.onabort = () => ko(t.error);
  }));

  const imposta = (nome, blob) => { BLOBS[nome] = blob; if (URLS[nome]) URL.revokeObjectURL(URLS[nome]); URLS[nome] = URL.createObjectURL(blob); };

  const Foto = (GT.Foto = {
    /* legge tutte le foto salvate */
    async carica() {
      try {
        const tutte = await richiesta("readonly", (s) => s.getAll());
        (tutte || []).forEach((r) => imposta(r.name, r.blob));
      } catch (e) { dbOk = false; }
      return Object.keys(BLOBS);
    },
    online: false,       // true quando c'è l'archivio online: le foto non salvate qui si leggono dal server
    persistente: () => dbOk,
    ha: (nome) => !!BLOBS[nome],
    blob: (nome) => BLOBS[nome] || null,
    nomi: () => Object.keys(BLOBS),
    async salva(nome, blob) {
      imposta(nome, blob);
      if (dbOk) try { await richiesta("readwrite", (s) => s.put({ name: nome, blob })); } catch (e) { dbOk = false; }
    },
    async elimina(nome) {
      if (URLS[nome]) URL.revokeObjectURL(URLS[nome]);
      delete URLS[nome]; delete BLOBS[nome];
      if (dbOk) try { await richiesta("readwrite", (s) => s.delete(nome)); } catch (e) {}
    },

    /* elenco con "|" tra un nome e l'altro; la prima è la copertina */
    lista: (s) => String(s || "").split("|").map((x) => x.trim()).filter(Boolean),
    unisci: (a) => a.join("|"),
    /* indirizzo da mostrare: foto locale, link completo o file già pubblicato nel sito */
    src(nome, base) {
      if (URLS[nome]) return URLS[nome];
      if (Foto.online && /^[a-z0-9][a-z0-9._-]{2,90}\.(?:jpe?g|png|webp)$/.test(nome)) return (base || "") + "foto/" + nome;
      return TG.foto(nome, base || "");
    },
    /* la foto come file: quella salvata qui oppure, con l'archivio online, quella sul server (per backup e pubblicazione) */
    async ottieni(nome) {
      if (BLOBS[nome]) return BLOBS[nome];
      if (!Foto.online || !/^[a-z0-9][a-z0-9._-]{2,90}\.(?:jpe?g|png|webp)$/.test(nome)) return null;
      try { const r = await fetch("../foto/" + encodeURIComponent(nome)); return r.ok ? await r.blob() : null; } catch (e) { return null; }
    },
    /* svuota le foto di questo browser (uscita dall'archivio online) */
    async svuota() { for (const n of Object.keys(BLOBS)) await Foto.elimina(n); },
    /* ricomprime una foto troppo pesante, con lo stesso nome */
    async compatta(nome) {
      const b = BLOBS[nome]; if (!b) return null;
      let nuovo = b;
      for (const [m, q] of [[1400, 0.76], [1200, 0.72], [1000, 0.68], [800, 0.64]]) { nuovo = await ridimensiona(b, m, q); if (nuovo.size <= LEGGERA) break; }
      await Foto.salva(nome, nuovo);
      return nuovo;
    },

    /* ridimensiona e salva; restituisce il nome del file */
    async aggiungi(file, titolo) {
      if (!/^image\//.test(file.type) && !/\.(jpe?g|png|webp|gif|avif|bmp)$/i.test(file.name)) throw new Error(`«${file.name}» non è un’immagine (usa JPG o PNG).`);
      let blob;
      for (const [m, q] of [[1600, 0.82], [1400, 0.78], [1200, 0.74], [1000, 0.7], [800, 0.66]]) { blob = await ridimensiona(file, m, q); if (blob.size <= LEGGERA) break; }
      const base = TG.norm(titolo || "auto").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "auto";
      let nome;
      do { nome = base + "-" + Math.random().toString(36).slice(2, 8) + ".jpg"; } while (BLOBS[nome]);
      await Foto.salva(nome, blob);
      return nome;
    },
    /* da un backup: rimette la foto con il suo nome */
    async ripristina(nome, blob) { await Foto.salva(nome, blob); },
  });

  async function ridimensiona(file, max = 1600, q = 0.82) {
    let img, w, h, rilascia = () => {};
    try {
      img = await createImageBitmap(file, { imageOrientation: "from-image" });
      w = img.width; h = img.height; rilascia = () => img.close && img.close();
    } catch (e) {
      const u = URL.createObjectURL(file);
      img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error(`Non riesco a leggere «${file.name || "la foto"}». Prova con un file JPG o PNG (le foto HEIC dell’iPhone: Impostazioni › Fotocamera › Formati › Più compatibile).`)); i.src = u; });
      w = img.naturalWidth; h = img.naturalHeight; rilascia = () => URL.revokeObjectURL(u);
    }
    const k = Math.min(1, max / Math.max(w, h));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
    const g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);   // le PNG trasparenti diventano su fondo bianco
    g.imageSmoothingQuality = "high";
    g.drawImage(img, 0, 0, c.width, c.height);
    rilascia();
    const blob = await new Promise((ok) => c.toBlob(ok, "image/jpeg", q));
    if (!blob) throw new Error(`Non riesco a elaborare «${file.name || "la foto"}».`);
    return blob;
  }

  /* ---------- editor delle foto dentro la scheda dell'auto ----------
     root: contenitore; input: campo nascosto "foto" (nomi separati da |); titolo(): testo per il nome dei file */
  Foto.editor = function (root, input, titolo, toast, opz) {
    const max = (opz && opz.max) || 40, tocco = !!(window.matchMedia && matchMedia("(pointer:coarse)").matches);
    let nomi = Foto.lista(input.value);
    const scrivi = () => { input.value = Foto.unisci(nomi); };
    const avviso = (m) => (toast ? toast(m) : console.warn(m));

    function disegna() {
      root.innerHTML = `<div class="fe-grid">${nomi.map((n, i) => `<figure class="fe-t" data-i="${i}">
  <img src="${TG.esc(Foto.src(n, "../"))}" alt="Foto ${i + 1}" loading="lazy">
  ${i === 0 ? '<span class="fe-cop">Copertina</span>' : ""}
  <figcaption>
    ${i > 0 ? `<button type="button" data-a="cop" title="Usa come copertina">★</button><button type="button" data-a="su" title="Sposta prima">◀</button>` : ""}
    ${i < nomi.length - 1 ? `<button type="button" data-a="giu" title="Sposta dopo">▶</button>` : ""}
    <button type="button" data-a="del" title="Togli" class="fe-x">✕</button>
  </figcaption>
</figure>`).join("")}
  ${nomi.length < max ? `<label class="fe-add" tabindex="0">
    <input type="file" accept="image/*" ${max > 1 ? "multiple" : ""}>
    <span><b>+ ${tocco ? "Dalla galleria" : "Aggiungi foto"}</b><small>${tocco ? "Scegli una o più foto" : "Scegli dal computer o trascina qui"}</small></span>
  </label>${tocco ? `<label class="fe-add fe-cam" tabindex="0">
    <input type="file" accept="image/*" capture="environment">
    <span><b>+ Scatta</b><small>Usa la fotocamera</small></span>
  </label>` : ""}` : ""}
</div>
${nomi.length < max ? `<div class="fe-link"><input type="url" inputmode="url" placeholder="Oppure incolla il link (https://) di una foto già online" aria-label="Link della foto"><button type="button" class="btn btn-line sm">Aggiungi link</button></div>` : `<p class="fe-nota">Massimo ${max} foto: togline una per aggiungerne un’altra.</p>`}
<p class="fe-nota">${!Foto.persistente() ? "Attenzione: questo browser non permette di salvare le foto oltre questa sessione." : Foto.online ? "Le foto partono sul server appena salvi, e compaiono sul sito." : "Le foto restano in questo browser finché non pubblichi: il pacchetto .zip le porta nel sito."}</p>`;
    }

    async function aggiungiFile(files) {
      let lista = Array.from(files || []);
      if (!lista.length) return;
      if (nomi.length + lista.length > max) { lista = lista.slice(0, Math.max(0, max - nomi.length)); avviso(`Massimo ${max} foto: ne ho aggiunte solo alcune.`); }
      if (!lista.length) return;
      root.classList.add("busy");
      let ok = 0;
      for (const f of lista) {
        try { nomi.push(await Foto.aggiungi(f, titolo())); ok++; } catch (e) { avviso(e.message); }
      }
      root.classList.remove("busy");
      scrivi(); disegna();
      if (ok) avviso(ok === 1 ? "Foto aggiunta." : `${ok} foto aggiunte.`);
    }

    root.addEventListener("change", (e) => { if (e.target.matches('.fe-add input[type="file"]')) { aggiungiFile(e.target.files); e.target.value = ""; } });
    root.addEventListener("keydown", (e) => { const l = e.target.closest && e.target.closest(".fe-add"); if (l && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); l.querySelector("input").click(); } });
    root.addEventListener("click", (e) => {
      const b = e.target.closest("[data-a]");
      if (b) {
        const i = +b.closest(".fe-t").dataset.i, a = b.dataset.a;
        if (a === "del") nomi.splice(i, 1);
        else if (a === "cop") nomi.unshift(nomi.splice(i, 1)[0]);
        else if (a === "su") nomi.splice(i - 1, 0, nomi.splice(i, 1)[0]);
        else if (a === "giu") nomi.splice(i + 1, 0, nomi.splice(i, 1)[0]);
        scrivi(); return disegna();
      }
      if (e.target.closest(".fe-link button")) {
        const inp = root.querySelector(".fe-link input"), v = inp.value.trim();
        if (!v) return;
        if (!/^https:\/\//i.test(v)) return avviso("Il link deve iniziare con https://");
        nomi.push(v); scrivi(); disegna();
      }
    });
    ["dragenter", "dragover"].forEach((ev) => root.addEventListener(ev, (e) => { if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files")) { e.preventDefault(); root.classList.add("over"); } }));
    ["dragleave", "drop"].forEach((ev) => root.addEventListener(ev, () => root.classList.remove("over")));
    root.addEventListener("drop", (e) => { if (e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); aggiungiFile(e.dataTransfer.files); } });

    return { carica(v) { input.value = v || ""; nomi = Foto.lista(input.value); disegna(); } };
  };
})();
