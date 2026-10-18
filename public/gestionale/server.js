/* AutoProfit · collegamento all'archivio online (Worker + database D1).
   Se il sito ha l'archivio attivo, il gestionale chiede la password e tiene auto, contatti, storico, visite, foto e impostazioni
   allineati tra telefono e computer. Se l'archivio non c'è (sito statico, file aperto dal disco), non cambia nulla:
   il gestionale resta «locale», con i dati nel browser e la pubblicazione con il pacchetto .zip.
   Le modifiche si salvano sempre prima in questo dispositivo e poi si inviano: se manca la rete restano in coda. */
(function () {
  "use strict";
  const GT = (window.GT = window.GT || {});
  const $ = (s, r) => (r || document).querySelector(s);
  const API = "../api/admin/";
  const SK = "autoprofit.sync.v1";
  const COLL = ["auto", "contatti", "storico", "visite"];
  const ID = /^[A-Za-z0-9_-]{1,64}$/;
  const NOME_FOTO = /^[a-z0-9][a-z0-9._-]{2,90}\.(?:jpe?g|png|webp)$/;
  const MAX_FOTO = 880 * 1024;
  const U = () => GT.Unione;
  let X = null;                                  // contesto fornito dal gestionale

  const St = { modo: "locale", busy: false, again: false, err: "", fase: "", sporco: false, haBase: false, base: { auto: {}, contatti: {}, storico: {}, visite: {}, titolare: undefined, flotta: undefined }, subite: new Set(), ultimo: 0, timer: null, ver: 0 };

  /* ---------- memoria dello stato di sincronizzazione (solo in questo browser) ---------- */
  function leggiSt() {
    try {
      const j = JSON.parse(localStorage.getItem(SK));
      if (j && j.base && typeof j.base === "object") {
        COLL.forEach((t) => (St.base[t] = j.base[t] && typeof j.base[t] === "object" ? j.base[t] : {}));
        St.base.titolare = j.base.titolare == null ? undefined : j.base.titolare; St.base.flotta = j.base.flotta == null ? undefined : j.base.flotta;
        St.subite = new Set(Array.isArray(j.subite) ? j.subite : []); St.haBase = !!j.haBase; St.sporco = !!j.sporco; St.ultimo = +j.ultimo || 0;
        return true;
      }
    } catch (e) { /* nessuna memoria */ }
    return false;
  }
  function scriviSt() {
    try { localStorage.setItem(SK, JSON.stringify({ haBase: St.haBase, sporco: St.sporco, ultimo: St.ultimo, base: St.base, subite: [...St.subite].slice(-2000) })); } catch (e) { /* senza memoria: si riparte come primo accesso */ }
  }
  const pulisciSt = () => { try { localStorage.removeItem(SK); } catch (e) {} };

  /* ---------- chiamate ---------- */
  const errore = (msg, codice, extra) => Object.assign(new Error(msg), { codice }, extra || {});
  async function chiama(percorso, opz) {
    let r;
    try { r = await fetch(API + percorso, Object.assign({ credentials: "same-origin", cache: "no-store" }, opz || {})); }
    catch (e) { throw errore("Nessuna connessione.", "rete"); }
    if (r.status === 401) { St.modo = "accesso"; throw errore("Sessione scaduta: accedi di nuovo.", 401); }
    let j = null; try { j = await r.json(); } catch (e) { /* senza corpo */ }
    if (!r.ok) throw errore((j && j.messaggio) || "Errore del server (" + r.status + ").", r.status, { dati: j });
    return j;
  }

  /* ---------- rilevamento ---------- */
  async function rileva() {
    leggiSt();
    try {
      const r = await fetch(API + "stato", { credentials: "same-origin", cache: "no-store" });
      if (!r.ok) return (St.modo = "locale");
      const j = await r.json();
      if (!j || j.configurato !== true) return (St.modo = "locale");
      return (St.modo = j.autenticato ? "online" : "accesso");
    } catch (e) {
      // risposta non valida o rete assente: se questo dispositivo era già collegato si lavora offline, altrimenti in locale
      return (St.modo = St.haBase ? "offline" : "locale");
    }
  }

  /* ---------- accesso ---------- */
  function mostraAccesso(msg) {
    const d = $("#d-accesso"); if (!d) return;
    document.body.classList.add("bloccato");
    $("#a-err").hidden = !msg; $("#a-err").textContent = msg || "";
    if (!d.open) d.showModal();
    setTimeout(() => $("#a-pw").focus(), 50);
    pill();
  }
  async function accedi(pw) {
    let r;
    try { r = await fetch(API + "login", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: pw }) }); }
    catch (e) { throw errore("Non riesco a collegarmi: controlla la connessione.", "rete"); }
    let j = null; try { j = await r.json(); } catch (e) {}
    if (!r.ok) throw errore((j && j.messaggio) || "Accesso non riuscito (" + r.status + ").", r.status);
    St.modo = "online";
  }
  async function esci() {
    try { await fetch(API + "logout", { method: "POST", credentials: "same-origin" }); } catch (e) { /* si esce comunque da qui */ }
    pulisciSt();
  }

  /* ---------- foto ---------- */
  const elenco = (s) => String(s || "").split("|").map((x) => x.trim()).filter(Boolean);
  const nomiFoto = (doc) => elenco(doc && doc.foto).filter((n) => NOME_FOTO.test(n));
  async function caricaFoto(nome) {
    let blob = GT.Foto.blob(nome);
    if (!blob) return;
    if (blob.size > MAX_FOTO) blob = (await GT.Foto.compatta(nome)) || blob;
    let r;
    try { r = await fetch(API + "foto/" + encodeURIComponent(nome), { method: "PUT", credentials: "same-origin", headers: { "content-type": blob.type || "image/jpeg" }, body: blob }); }
    catch (e) { throw errore("Nessuna connessione.", "rete"); }
    if (r.ok) return;
    if (r.status === 401) { St.modo = "accesso"; throw errore("Sessione scaduta: accedi di nuovo.", 401); }
    if ([400, 413, 415].includes(r.status)) throw errore("Foto non accettata.", r.status, { permanente: true });
    throw errore("Errore del server (" + r.status + ") nel caricare una foto.", r.status);
  }
  const senzaFoto = (doc, via) => { const o = Object.assign({}, doc); o.foto = elenco(doc.foto).filter((n) => !via.has(n)).join("|"); return o; };

  /* ---------- un giro di sincronizzazione ---------- */
  const vuotoT = (t) => !t || (!String(t.nome || "").trim() && !elenco(t.foto).length);
  async function ciclo() {
    const N = X.norm, d = await chiama("dati");
    const primo = !St.haBase, v0 = St.ver;
    const snap = JSON.parse(JSON.stringify(X.leggi()));                    // fotografia dei dati di questo dispositivo
    const esempi = X.haEsempi();

    const rem = {};
    COLL.forEach((t) => { rem[t] = (d[t] || []).map((x) => N[t](x)).filter((x) => x && typeof x.id === "string" && ID.test(x.id)); });
    const m = {};
    COLL.forEach((t) => { m[t] = U().collezione({ locale: snap[t].map((x) => N[t](x)).filter((x) => x && ID.test(x.id)), remoto: rem[t], base: St.base[t], primo, scarta: (x) => x.demo === true }); });

    const dT = d.impostazioni && d.impostazioni.titolare, dF = d.impostazioni && d.impostazioni.flotta;
    const remT = vuotoT(dT) ? null : N.titolare(dT), locT = vuotoT(snap.titolare) ? null : N.titolare(snap.titolare);
    const sT = U().singolo({ locale: locT, remoto: remT, base: St.base.titolare, primo });
    const predF = N.flotta({}), remF = !dF || !Object.keys(dF).length ? null : N.flotta(dF);
    let locF = U().h(N.flotta(snap.flotta)) === U().h(predF) ? null : N.flotta(snap.flotta);
    let ripartiF = false;
    if (primo && esempi && locF) { locF = null; ripartiF = true; }          // le impostazioni di esempio non vanno nell'archivio
    const sF = U().singolo({ locale: locF, remoto: remF, base: St.base.flotta, primo });

    // 1) foto da caricare prima dei documenti che le usano
    const daCaricare = new Set();
    m.auto.invia.set.forEach((a) => nomiFoto(a).forEach((n) => daCaricare.add(n)));
    if (sT.azione === "invia") nomiFoto(sT.valore).forEach((n) => daCaricare.add(n));
    const lista = [...daCaricare].filter((n) => !St.subite.has(n) && GT.Foto.ha(n));
    const scartate = new Set();
    for (let i = 0; i < lista.length; i++) {
      St.fase = lista.length > 1 ? `Carico le foto (${i + 1}/${lista.length})…` : "Carico la foto…"; pill();
      try { await caricaFoto(lista[i]); St.subite.add(lista[i]); scriviSt(); }
      catch (e) { if (e.permanente) scartate.add(lista[i]); else throw e; }
    }
    St.fase = "";
    if (scartate.size) {                                                    // foto rifiutata dal server: si toglie dall'auto, il resto prosegue
      m.auto.invia.set = m.auto.invia.set.map((a) => { if (!nomiFoto(a).some((n) => scartate.has(n))) return a; const b = senzaFoto(a, scartate); m.auto.base[a.id] = U().h(b); X.correggiFoto(a.id, scartate); return b; });
      if (sT.azione === "invia" && nomiFoto(sT.valore).some((n) => scartate.has(n))) { sT.valore = Object.assign({}, sT.valore, { foto: senzaFoto(sT.valore, scartate).foto }); sT.base = U().h(sT.valore); X.correggiFotoTitolare(scartate); }
      X.toast(`${scartate.size === 1 ? "Una foto non è stata caricata" : scartate.size + " foto non sono state caricate"} (non valide o troppo pesanti): l’ho tolta dall’auto.`);
    }

    // 2) invio all'archivio, a pezzi
    const pezzi = [];
    const taglia = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
    COLL.forEach((t) => {
      taglia(m[t].invia.set, 120).forEach((p) => pezzi.push({ [t]: { set: p } }));
      taglia(m[t].invia.del, 400).forEach((p) => pezzi.push({ [t]: { del: p } }));
    });
    const imp = {};
    if (sT.azione === "invia") imp.titolare = { nome: sT.valore.nome, foto: sT.valore.foto };
    if (sF.azione === "invia") imp.flotta = sF.valore;
    if (Object.keys(imp).length) pezzi.push({ impostazioni: imp });
    if (!d.inizializzato && m.auto.invia.set.length && pezzi.length) pezzi[pezzi.length - 1].inizializza = true;
    for (let i = 0; i < pezzi.length; i++) {
      St.fase = pezzi.length > 1 ? `Invio le modifiche (${i + 1}/${pezzi.length})…` : "Invio le modifiche…"; pill();
      await chiama("sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(pezzi[i]) });
    }
    St.fase = "";

    // 3) novità arrivate dall'archivio, applicate qui (solo dove nel frattempo non è cambiato nulla)
    const ora = X.leggi(), saltati = { auto: new Set(), contatti: new Set(), storico: new Set(), visite: new Set() };
    const hLoc = (t, id) => { const x = ora[t].find((y) => y.id === id); return x ? U().h(N[t](x)) : null; };
    const hSnap = (t, id) => { const x = snap[t].find((y) => y.id === id); return x ? U().h(N[t](x)) : null; };
    const finale = {};
    let novita = 0;
    COLL.forEach((t) => {
      const set = m[t].applica.set.filter((x) => (hLoc(t, x.id) === hSnap(t, x.id)) || (saltati[t].add(x.id) && false));
      const del = m[t].applica.del.filter((id) => (hLoc(t, id) === hSnap(t, id)) || (saltati[t].add(id) && false));
      finale[t] = { set, del }; novita += set.length + del.length;
      saltati[t].forEach((id) => { if (Object.prototype.hasOwnProperty.call(St.base[t], id)) m[t].base[id] = St.base[t][id]; else delete m[t].base[id]; });
    });
    const appT = sT.azione === "applica" ? (sT.valore || N.titolare({})) : null;
    const appF = sF.azione === "applica" ? sF.valore : ripartiF ? predF : null;
    X.applica({ auto: finale.auto, contatti: finale.contatti, storico: finale.storico, visite: finale.visite, titolare: appT, flotta: appF });
    if (appT || appF) novita++;

    COLL.forEach((t) => (St.base[t] = m[t].base));
    St.base.titolare = sT.base == null ? undefined : sT.base; St.base.flotta = sF.base == null ? undefined : sF.base;
    St.haBase = true; St.sporco = St.ver !== v0; St.ultimo = Date.now(); scriviSt();
    const conflitti = COLL.reduce((n, t) => n + m[t].conflitti, 0);
    return { novita, conflitti, primo };
  }

  /* ---------- pianificazione ---------- */
  const dialogoAperto = () => !!document.querySelector("dialog[open]:not(#d-accesso)");
  function programma(ms) { clearTimeout(St.timer); St.timer = setTimeout(() => sincronizza("auto"), ms); }
  function cambiato() {
    if (St.modo === "locale" || St.modo === "accesso") return;
    St.ver++; St.sporco = true; scriviSt(); pill();
    programma(700);
  }
  async function sincronizza(motivo) {
    if (St.modo === "locale") return;
    if (St.modo === "accesso") { if (motivo === "esplicito") mostraAccesso(""); return; }
    if (St.busy) { St.again = true; return; }
    if (motivo !== "esplicito" && dialogoAperto()) { programma(3000); return; }
    if (!navigator.onLine && motivo !== "esplicito") { St.modo = "offline"; pill(); return; }
    St.busy = true; St.err = ""; pill();
    try {
      const r = await ciclo();
      St.modo = "online";
      if (r.novita && !r.primo) { X.ridisegna(); X.toast("Aggiornato con le modifiche fatte da un altro dispositivo."); }
      else if (r.primo) X.ridisegna();
      if (r.conflitti) X.toast("Qualcuno ha modificato la stessa auto da un altro dispositivo: ho tenuto la versione di questo.");
    } catch (e) {
      if (e.codice === 401) { St.modo = "accesso"; mostraAccesso("La sessione è scaduta: accedi di nuovo. Le tue modifiche sono al sicuro in questo dispositivo."); }
      else if (e.codice === "rete") St.modo = "offline";
      else { St.err = e.message || "Errore di sincronizzazione."; if (St.modo !== "accesso") St.modo = "online"; }
    } finally {
      St.busy = false; St.fase = ""; pill();
      if (St.again) { St.again = false; programma(400); }
    }
  }

  /* ---------- etichetta in alto ---------- */
  function pill() {
    if (!X || St.modo === "locale") return;
    let t, cl, tit = "";
    if (St.modo === "accesso") { t = "Accesso richiesto"; cl = "mod"; }
    else if (St.busy) { t = St.fase || "Sincronizzo…"; cl = "mod"; }
    else if (St.err) { t = "Non sincronizzato · riprova"; cl = "err"; tit = St.err; }
    else if (St.modo === "offline") { t = St.sporco ? "Offline · modifiche da inviare" : "Offline"; cl = "mod"; tit = "Nessuna connessione: le modifiche restano in questo dispositivo e partono appena torna la rete."; }
    else if (St.sporco) { t = "Modifiche da inviare"; cl = "mod"; }
    else { t = "Online · tutto salvato"; cl = "ok"; tit = St.ultimo ? "Ultimo allineamento: " + new Date(St.ultimo).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : ""; }
    X.pill(t, cl, tit);
  }

  function init(ctx) {
    X = ctx;
    const f = $("#form-accesso");
    if (f) {
      f.addEventListener("submit", async (e) => {
        e.preventDefault();
        const pw = $("#a-pw").value; if (!pw) return;
        const b = $("#a-ok"); b.disabled = true; $("#a-err").hidden = true;
        try {
          await accedi(pw); $("#a-pw").value = "";
          $("#d-accesso").close(); document.body.classList.remove("bloccato");
          await X.dopoAccesso();
        } catch (er) { $("#a-err").textContent = er.message; $("#a-err").hidden = false; $("#a-pw").select(); }
        finally { b.disabled = false; }
      });
      $("#d-accesso").addEventListener("cancel", (e) => e.preventDefault());       // non si chiude senza password
    }
    setInterval(() => { if (!document.hidden && (St.modo === "online" || St.modo === "offline")) sincronizza("poll"); }, 90000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden && (St.modo === "online" || St.modo === "offline")) sincronizza("ritorno"); });
    window.addEventListener("online", () => { if (St.modo === "offline" || St.modo === "online") { St.modo = "online"; sincronizza("rete"); } });
    window.addEventListener("offline", () => { if (St.modo === "online") { St.modo = "offline"; pill(); } });
  }

  GT.Server = {
    init, rileva, accedi, esci, mostraAccesso, cambiato, pill,
    sincronizza: (m) => sincronizza(m || "esplicito"),
    modo: () => St.modo, attivo: () => St.modo !== "locale", daInviare: () => St.sporco, errore: () => St.err,
  };
})();
