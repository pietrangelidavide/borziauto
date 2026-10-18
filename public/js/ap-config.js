/* AutoProfit · configurazione del garage e tema.
   Ogni garage ha UN file, garage.json (nome, contatti, orari, regole di calcolo, moduli accesi, tema, dati per la privacy).
   Questo script lo legge e lo applica: colori, caratteri, nome, logo. Il resto del programma è uguale per tutti.
   Nella demo, window.AP_PROFILI contiene alcuni garage di esempio tra cui scegliere (la scelta resta in questo browser). */
(function () {
  "use strict";
  const AP = (window.AP = window.AP || {});
  const SK = "autoprofit.profilo";
  const sc = document.currentScript;
  const RADICE = (sc && sc.getAttribute("data-root")) || "./";

  /* ---------- colori ---------- */
  const rgb = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim()); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const lum = (hex) => { const c = rgb(hex); if (!c) return 0; const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const contrasto = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  AP.contrasto = contrasto;
  const triplo = (hex, d) => (rgb(hex) || rgb(d)).join(",");

  /* ---------- lettura della configurazione ---------- */
  const unisci = (a, b) => {                                  // unione in profondità: b vince su a
    if (Array.isArray(b) || typeof b !== "object" || b === null) return b === undefined ? a : b;
    const o = Object.assign({}, a && typeof a === "object" && !Array.isArray(a) ? a : {});
    Object.keys(b).forEach((k) => (o[k] = unisci(o[k], b[k])));
    return o;
  };
  const DEFAULT = {
    id: "garage", nome: "Il tuo garage", slogan: "", tema: {},
    contatti: {}, orari: {}, visite: { durata: 30, passo: 30, posti: 1, anticipoOre: 3, giorniMax: 30, chiusure: [] },
    regole: { trattativa: 3, costi_vendita: 0, costo_giorno: 0, margine_min: 1000 },
    moduli: { vetrina: true, visite: true, recensioni: true, flotta: true, acquisto: true },
    mercato: { fonte: "auto" }, privacy: {},
  };
  const scegliProfilo = () => {
    const P = window.AP_PROFILI;
    if (!P) return null;
    let id = "";
    try { id = localStorage.getItem(SK) || ""; } catch (e) { /* senza memoria si usa il primo */ }
    return P[id] ? id : Object.keys(P)[0];
  };
  AP.Config = {
    cfg: DEFAULT,
    profilo: null,
    profili() { return window.AP_PROFILI ? Object.keys(window.AP_PROFILI).map((k) => ({ id: k, nome: window.AP_PROFILI[k].nome })) : []; },
    scegli(id) { try { localStorage.setItem(SK, id); } catch (e) {} location.reload(); },
    async carica() {
      let j = null;
      const id = scegliProfilo();
      if (id) { j = window.AP_PROFILI[id]; this.profilo = id; }
      if (!j) {
        const inl = document.getElementById("garage-json");
        if (inl) { try { j = JSON.parse(inl.textContent); } catch (e) {} }
      }
      if (!j) { try { const r = await fetch(RADICE + "garage.json", { cache: "no-cache" }); if (r.ok) j = await r.json(); } catch (e) { /* si usano i valori di base */ } }
      this.cfg = unisci(DEFAULT, j || {});
      return this.cfg;
    },
  };

  /* ---------- tema ---------- */
  const FONT_URL = (t) => {
    const fam = [t.fontTitoli, t.fontTesto].filter((f) => f && f.google).map((f) => "family=" + f.google);
    return fam.length ? "https://fonts.googleapis.com/css2?" + [...new Set(fam)].join("&") + "&display=swap" : "";
  };
  AP.Tema = {
    /* modo: "vetrina" (tutto il tema) | "gestionale" (area di lavoro scura: cambia solo accento, logo e carattere dei titoli) */
    applica(cfg, modo) {
      const t = cfg.tema || {}, r = document.documentElement.style, set = (k, v) => v != null && v !== "" && r.setProperty(k, v);
      const url = FONT_URL(t);
      if (url && !document.querySelector('link[data-ap-font]')) { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = url; l.setAttribute("data-ap-font", ""); document.head.appendChild(l); }
      const fd = t.fontTitoli && t.fontTitoli.css, ft = t.fontTesto && t.fontTesto.css;
      if (modo === "gestionale") {
        const acc = t.accentoLavoro || t.accento || "#f2d22e", acc2 = t.accentoLavoro2 || t.accento2 || acc;
        set("--xeno", acc); set("--xeno-2", acc2);
        set("--ink", contrasto(acc, "#101216") >= 7 ? "#101216" : "#ffffff");
        set("--acc-rgb", triplo(acc, "#f2d22e")); set("--acc2-rgb", triplo(acc2, "#ffe466"));
        set("--display", fd); set("--dw", t.pesoTitoli); set("--dt", t.maiuscoloTitoli ? "uppercase" : "none");
        const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute("content", "#101216");
      } else {
        const acc = t.accento || "#f2d22e", acc2 = t.accento2 || acc, bg = t.sfondo || "#f5f4ef", ink = t.testo || "#14161a";
        set("--v-bg", bg); set("--v-surf", t.superficie || "#ffffff"); set("--v-surf2", t.superficie2 || bg); set("--v-ink", ink);
        set("--v-ink2", t.testo2 || "#5d626b"); set("--v-line", t.linea || "rgba(20,22,26,.14)");
        set("--v-acc", acc); set("--v-acc2", acc2); set("--v-acc-ink", t.testoSuAccento || (contrasto(acc, "#14161a") >= contrasto(acc, "#ffffff") ? "#14161a" : "#ffffff"));
        set("--v-acc-rgb", triplo(acc, "#f2d22e")); set("--v-ink-rgb", triplo(ink, "#14161a"));
        set("--v-hero", t.sfondoHero || bg); set("--v-hero-ink", t.testoHero || ink); set("--v-raggio", t.raggio == null ? "4px" : t.raggio + "px");
        set("--v-display", fd); set("--v-text", ft); set("--v-dw", t.pesoTitoli); set("--v-dt", t.maiuscoloTitoli ? "uppercase" : "none"); set("--v-ds", t.scalaTitoli);
        const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute("content", bg);
        document.documentElement.style.colorScheme = lum(bg) < 0.3 ? "dark" : "light";
      }
    },
    /* nome, logo e contatti nei punti segnati con data-ap */
    riempi(cfg, modo) {
      const t = cfg.tema || {}, c = cfg.contatti || {};
      const vuoto = (el) => { const g = el.closest("[data-ap-gruppo]") || el.closest(".riga") || el; g.hidden = true; };   // un dato mancante non lascia pulsanti o righe vuote
      document.querySelectorAll("[data-ap]").forEach((el) => {
        const k = el.getAttribute("data-ap");
        if ((k === "telefono" && !c.telefono) || (k === "email" && !c.email) || (k === "indirizzo" && !(c.indirizzo || c.citta)) || (k === "piva" && !c.piva)) return vuoto(el);
        if (k === "nome") el.textContent = cfg.nome;
        else if (k === "slogan") el.textContent = cfg.slogan || "";
        else if (k === "telefono") { el.textContent = c.telefono || ""; if (el.tagName === "A") el.href = "tel:" + String(c.telefono || "").replace(/[^+\d]/g, ""); }
        else if (k === "email") { el.textContent = c.email || ""; if (el.tagName === "A") el.href = "mailto:" + (c.email || ""); }
        else if (k === "indirizzo") el.textContent = [c.indirizzo, c.citta].filter(Boolean).join(", ");
        else if (k === "piva") el.textContent = c.piva || "";
        else if (k === "ragione") el.textContent = c.ragioneSociale || cfg.nome;
        else if (k === "logo") {
          const scuro = modo === "gestionale" || el.hasAttribute("data-su-scuro");
          const src = scuro ? t.logoSuScuro || t.logo : t.logo || t.logoSuScuro;
          el.textContent = "";
          if (src) { const im = document.createElement("img"); im.src = (/^(data:|https?:|\/)/.test(src) ? "" : RADICE) + src; im.alt = cfg.nome; im.height = +el.getAttribute("data-h") || 28; el.appendChild(im); }
          else { const s = document.createElement("span"); s.className = "ap-marchio"; s.textContent = cfg.nome; el.appendChild(s); }
        }
      });
      document.querySelectorAll("[data-ap-titolo]").forEach((el) => (document.title = el.getAttribute("data-ap-titolo").replace("{nome}", cfg.nome)));
      const a = document.querySelector('meta[name="apple-mobile-web-app-title"]'); if (a) a.setAttribute("content", cfg.nomeBreve || cfg.nome);
    },
  };

  /* avvio: chi usa la pagina aspetta AP.pronto per disegnare con i valori giusti */
  AP.pronto = AP.Config.carica().then((cfg) => {
    const modo = document.documentElement.getAttribute("data-modo") || "vetrina";
    AP.Tema.applica(cfg, modo);
    const finisci = () => AP.Tema.riempi(cfg, modo);
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", finisci); else finisci();
    return cfg;
  });
})();
