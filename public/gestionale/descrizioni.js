/* Borzi Auto · testo dell’annuncio.
   Dai dati della scheda dell’auto prepara la descrizione per AutoScout24, Instagram, Facebook e per il sito, da rileggere e copiare.
   Non inventa nulla: usa solo quello che c’è nella scheda e quello che scrive il titolare (punti di forza, garanzia, altre righe).
   Le frasi sui controlli vengono dalla lista «Controlli» dell’auto e solo per le voci segnate «a posto» o «fatto».
   Garanzie e finanziamenti non vengono mai scritti da soli. */
(function () {
  "use strict";
  const GT = (window.GT = window.GT || {});
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => TG.esc(s);
  let X = null;        // contesto del gestionale: { toast, apri, numero, ... }
  const LS = "borziauto.descrizioni.v1";

  const FORMATI = [
    { k: "autoscout", nome: "AutoScout24", nota: "Testo semplice, senza emoji: incollalo nel campo descrizione dell’annuncio." },
    { k: "instagram", nome: "Instagram", nota: "Didascalia per post o Reel. Instagram accetta fino a 2.200 caratteri e 30 hashtag.", max: 2200 },
    { k: "facebook", nome: "Facebook", nota: "Per un post della pagina o per Marketplace." },
    { k: "sito", nome: "Sito", nota: "Poche righe: sul sito dati, prezzo e contatti sono già accanto alla descrizione. Qui contano i punti di forza." },
  ];

  /* frasi per i controlli segnati a posto, dalla più importante: se ne usano al massimo sei */
  const FRASI = [
    ["pra", "Nessun fermo, ipoteca o gravame"], ["revisione", "Revisione in regola"], ["km", "Chilometraggio verificato"], ["tagliando", "Tagliando in regola"],
    ["distribuzione", "Distribuzione controllata"], ["freni", "Freni in buono stato"], ["gomme", "Pneumatici in buono stato"], ["perdite", "Nessuna perdita di olio o liquidi"],
    ["spie", "Diagnosi senza errori"], ["frizione", "Frizione e cambio controllati"], ["clima", "Climatizzatore funzionante"], ["batteria", "Batteria e impianto elettrico controllati"],
    ["sospensioni", "Sospensioni controllate"], ["bollo", "Bollo pagato"], ["manuale", "Libretto uso e manutenzione e seconda chiave"], ["interni", "Interni in buono stato"],
  ];
  const MAX_CONTROLLI = 6;

  const cfg = () => (window.AP && AP.Config && AP.Config.cfg) || {};
  const sede = () => {
    const k = cfg(), c = k.contatti || {}, tel = String(c.telefono || ""), wa = String(c.whatsapp || "").replace(/\D/g, "");
    return { nome: k.nomeBreve || k.nome || "", tel, ind: [c.indirizzo, c.citta].filter(Boolean).join(", "), citta: String(c.citta || "").replace(/^\d{5}\s*/, "").replace(/\s*\(.*\)\s*$/, "").trim(), waOk: !!tel && wa.endsWith(tel.replace(/\D/g, "")) };
  };

  const maiusc = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
  const nomeAuto = (d) => [d.marca, d.modello, d.allestimento].map((x) => String(x || "").trim()).filter(Boolean).join(" ");
  const righe = (t) => String(t || "").split(/\r?\n/).map((x) => x.trim().replace(/^[-•*✔]\s*/, "")).filter(Boolean).map(maiusc);

  /* dati dell’auto in righe corte: anno, km, motore, cambio, potenza, colore, carrozzeria */
  function specs(d) {
    const p = [];
    if (d.anno) p.push(String(d.anno));
    if (d.km != null) p.push(TG.num(d.km) + " km");
    if (d.alimentazione) p.push(d.alimentazione);
    if (d.cambio) p.push("cambio " + String(d.cambio).toLowerCase());
    if (d.cv) p.push(d.cv + " CV");
    if (d.colore) p.push("colore " + String(d.colore).toLowerCase());
    if (d.carrozzeria) p.push(String(d.carrozzeria).toLowerCase());
    return p;
  }

  /* controlli segnati a posto (o già sistemati) → frasi */
  function frasiControlli(d) {
    const c = GT.Check && d.checklist ? GT.Check.norm(d.checklist) : null;
    if (!c) return [];
    const ok = {}; c.voci.forEach((v) => { if (v.s === "ok" || v.s === "fatto") ok[v.k] = v.s; });
    return FRASI.filter(([k]) => ok[k]).map(([k, t]) => (k === "tagliando" && ok[k] === "fatto" ? "Tagliando appena eseguito" : t)).slice(0, MAX_CONTROLLI);
  }
  /* i punti di forza: prima quelli scritti dal titolare, poi i controlli */
  const punti = (d, o) => righe(o.forza).concat(o.controlli ? frasiControlli(d) : []).filter((x, i, l) => l.findIndex((y) => y.toLowerCase() === x.toLowerCase()) === i);
  const prezzoTesto = (d) => (d.prezzo != null ? TG.euro(d.prezzo) : "su richiesta");
  const conPunto = (t) => (/[.!?]$/.test(t) ? t : t + ".");

  /* ---------- i quattro testi ---------- */
  const TESTI = {
    autoscout(d, o, s) {
      const L = [nomeAuto(d)], sp = specs(d), pf = punti(d, o), ex = righe(o.extra);
      if (sp.length) L.push(maiusc(sp.join(" · ")));
      if (pf.length) L.push("", "Cosa trovi in questa auto", ...pf.map((x) => "- " + x));
      if (o.garanzia.trim() || ex.length) L.push("", ...(o.garanzia.trim() ? [conPunto(o.garanzia.trim())] : []), ...ex.map(conPunto));
      if (o.prezzo) L.push("", "Prezzo: " + prezzoTesto(d));
      L.push("", "Puoi vederla e provarla su appuntamento.", [s.nome, s.ind].filter(Boolean).join(" - "));
      if (s.tel) L.push("Tel. " + s.tel + (s.waOk ? " (anche WhatsApp)" : ""));
      return L.filter((x, i, l) => x !== undefined && !(x === "" && (l[i - 1] === "" || i === l.length - 1))).join("\n");
    },
    instagram(d, o, s) {
      const L = ["🚗 " + nomeAuto(d)], sp = specs(d), pf = punti(d, o), ex = righe(o.extra);
      if (sp.length) L.push(maiusc(sp.join(" · ")));
      if (pf.length) L.push("", ...pf.map((x) => "✔ " + x));
      if (o.garanzia.trim() || ex.length) L.push("", ...(o.garanzia.trim() ? [conPunto(o.garanzia.trim())] : []), ...ex.map(conPunto));
      L.push("");
      if (o.prezzo) L.push("💶 " + prezzoTesto(d));
      if (s.ind) L.push("📍 " + [s.nome, s.ind].filter(Boolean).join(", "));
      if (s.tel) L.push("📞 " + s.tel);
      L.push("Scrivici in DM o passa a trovarci su appuntamento.", "", tag(d, s).map((x) => "#" + x).join(" "));
      return L.filter((x, i, l) => !(x === "" && (l[i - 1] === "" || i === l.length - 1))).join("\n");
    },
    facebook(d, o, s) {
      const L = [`Disponibile${s.nome ? " da " + s.nome : ""}: ${nomeAuto(d)}`], sp = specs(d), pf = punti(d, o), ex = righe(o.extra);
      if (sp.length) L.push("", maiusc(sp.join(", ")) + ".");
      if (pf.length) L.push("", "Da sapere:", ...pf.map((x) => "• " + x));
      if (o.garanzia.trim() || ex.length) L.push("", ...(o.garanzia.trim() ? [conPunto(o.garanzia.trim())] : []), ...ex.map(conPunto));
      if (o.prezzo) L.push("", "Prezzo: " + prezzoTesto(d));
      L.push("", `Per vederla o provarla scrivici qui${s.tel ? " o chiama il " + s.tel : ""}.`);
      if (s.ind) L.push("📍 " + s.ind);
      return L.join("\n");
    },
    sito(d, o) {
      const pf = punti(d, o), ex = righe(o.extra), p = pf.map(conPunto).concat(o.garanzia.trim() ? [conPunto(o.garanzia.trim())] : [], ex.map(conPunto));
      if (!p.length) { const sp = specs(d); if (sp.length) p.push(conPunto(maiusc(sp.join(", ")))); }
      p.push("Puoi vederla in sede su appuntamento.");
      return p.join(" ");
    },
  };
  /* hashtag: il garage, marca e modello, il tipo di auto, la città */
  function tag(d, s) {
    const sl = (t) => TG.norm(t).replace(/[^a-z0-9]/g, "");
    const l = [sl(s.nome), sl(d.marca), sl(d.marca + d.modello), "autousate", s.citta ? "autousate" + sl(s.citta) : "", sl(d.carrozzeria), sl(d.alimentazione), sl(s.citta)];
    return l.filter((x, i) => x && x.length > 2 && l.indexOf(x) === i).slice(0, 12);
  }

  /* ---------- finestra ---------- */
  let D = null, CB = null, tab = "autoscout", testi = {}, mod = {};
  const salvato = () => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } };
  const ricorda = () => { try { localStorage.setItem(LS, JSON.stringify({ garanzia: $("#ds-garanzia").value, extra: $("#ds-extra").value, tab })); } catch (e) {} };
  const opzioni = () => ({ forza: $("#ds-forza").value, garanzia: $("#ds-garanzia").value, extra: $("#ds-extra").value, controlli: $("#ds-ctl").checked, prezzo: $("#ds-prezzo").checked });
  const fm = () => FORMATI.find((f) => f.k === tab);

  function mostra() {
    const f = fm(), out = $("#ds-out");
    out.value = testi[tab] || "";
    $("#ds-nome").textContent = "Testo per " + f.nome;
    $("#ds-nota").textContent = f.nota;
    $("#ds-mod").hidden = !mod[tab];
    $("#ds-usa").hidden = !(CB && CB.usa && tab === "sito");
    document.querySelectorAll("#ds-tab button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.k === tab)));
    conta();
  }
  function conta() {
    const f = fm(), n = $("#ds-out").value.length, c = $("#ds-conta");
    c.textContent = f.max ? `${TG.num(n)} / ${TG.num(f.max)} caratteri` : `${TG.num(n)} caratteri`;
    c.className = f.max && n > f.max ? "late" : "";
  }
  /* rifà i testi dalle opzioni; quelli che il titolare ha cambiato a mano restano com’è */
  function rigenera() {
    if (!D) return;
    const o = opzioni(), s = sede();
    FORMATI.forEach((f) => { if (!mod[f.k]) testi[f.k] = TESTI[f.k](D, o, s); });
    mostra();
  }

  function apri(d, cb) {
    D = d; CB = cb || null; testi = {}; mod = {};
    const m = salvato(); tab = FORMATI.some((f) => f.k === m.tab) ? m.tab : "autoscout";
    $("#ds-auto").textContent = nomeAuto(d) + (d.anno ? " · " + d.anno : "");
    $("#ds-forza").value = ""; $("#ds-garanzia").value = m.garanzia || ""; $("#ds-extra").value = m.extra || "";
    const nc = frasiControlli(d).length;
    $("#ds-ctl").checked = nc > 0; $("#ds-ctl").disabled = nc === 0;
    $("#ds-ctl").nextElementSibling.textContent = nc ? `Scrivi i controlli che hai segnato «a posto» (${nc})` : "Nessun controllo segnato «a posto» per questa auto";
    $("#ds-prezzo").checked = true;
    rigenera();
    X.apri($("#d-desc"));
  }
  /* dal modulo di aggiunta/modifica: usa i valori scritti ora, anche se l’auto non è ancora salvata */
  function dalModulo(F, esistente) {
    const g = (n) => (F[n] ? String(F[n].value || "").trim() : "");
    const d = { marca: g("marca"), modello: g("modello"), allestimento: g("allestimento"), anno: X.numero(g("anno")), km: X.numero(g("km")), alimentazione: g("alimentazione"), cambio: g("cambio"),
      cv: X.numero(g("cv")), colore: g("colore"), carrozzeria: g("carrozzeria"), prezzo: X.numero(g("prezzo")), checklist: esistente ? esistente.checklist : null, descrizione: g("descrizione") };
    if (!d.marca && !d.modello) return X.toast("Scrivi prima marca e modello.");
    apri(d, { usa: (t) => { F.descrizione.value = t; const det = F.descrizione.closest("details"); if (det) det.open = true; X.toast("Testo scritto nella descrizione: salva l’auto per tenerlo."); } });
  }

  GT.Desc = {
    FORMATI, TESTI, specs, punti, tag, frasiControlli, dalModulo,
    apri(a, cb) { apri(a, cb); },
    init(ctx) {
      X = ctx;
      $("#ds-tab").innerHTML = FORMATI.map((f) => `<button type="button" data-k="${f.k}" aria-pressed="false">${esc(f.nome)}</button>`).join("");
      $("#ds-tab").addEventListener("click", (e) => { const b = e.target.closest("button[data-k]"); if (!b) return; tab = b.dataset.k; ricorda(); mostra(); });
      ["#ds-forza", "#ds-garanzia", "#ds-extra"].forEach((s) => $(s).addEventListener("input", () => { ricorda(); rigenera(); }));
      ["#ds-ctl", "#ds-prezzo"].forEach((s) => $(s).addEventListener("change", rigenera));
      $("#ds-out").addEventListener("input", () => { testi[tab] = $("#ds-out").value; mod[tab] = true; $("#ds-mod").hidden = false; conta(); });
      $("#ds-rigenera").onclick = () => { mod[tab] = false; rigenera(); };
      $("#ds-copia").onclick = () => GT.Verifica.copia($("#ds-out").value).then((ok) => X.toast(ok ? "Testo copiato." : "Non riesco a copiare qui: selezionalo e copialo a mano."));
      $("#ds-usa").onclick = () => {
        if (!CB || !CB.usa) return;
        if (D.descrizione && D.descrizione.trim() && D.descrizione.trim() !== $("#ds-out").value.trim() && !confirm("Sostituire la descrizione che c’è ora sul sito?")) return;
        CB.usa($("#ds-out").value.trim()); $("#d-desc").close();
      };
    },
  };
})();
