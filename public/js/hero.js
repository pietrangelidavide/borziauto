/* Borzi Auto · prima schermata (Flavio Borzi).
   Qui c'è solo il movimento e i dati che cambiano: contatore delle auto vendute, stelle, marche che scorrono,
   «Aperto ora», e tre effetti che seguono il puntatore o lo scorrimento (luce, inclinazione delle foto, parallasse).
   I numeri e il nome arrivano da CONFIG in js/sito.js (via window.BORZI e gli eventi «borzi:…»).
   Con «riduci movimento» attivo non parte niente: la sezione resta nel suo stato finale. */
(function () {
  "use strict";
  const $ = (s, r) => (r || document).querySelector(s);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hero = $("#hero");
  if (!hero) return;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const it = (n) => Math.round(n).toLocaleString("it-IT");
  const voto1 = (n) => (Math.round(n * 10) / 10).toFixed(1).replace(".", ",");
  const B = () => window.BORZI || {};

  /* ---------- nome del titolare ---------- */
  function nome(t) {
    t = t || {};
    const n = String(t.nome || "").trim();
    if (!n) return;
    const p = n.split(/\s+/);
    $("#h-n1").textContent = p[0];
    $("#h-n2").textContent = p.length > 1 ? p.slice(1).join(" ") + "." : "";
    $("#h-n2").parentNode.hidden = p.length < 2;
    if (t.ruolo) $("#h-ruolo").textContent = t.ruolo;
    const r = String(t.ruolo || "Titolare").toLowerCase();
    $("#ph-a").alt = n + ", " + r + " di Borzi Auto, appoggiato a un’auto sportiva gialla";
    $("#ph-b").alt = n + " sorride dal finestrino di un’auto sportiva gialla";
  }

  /* ---------- auto vendute: contatore ---------- */
  const elV = $("#n-vendute"), chipV = $("#chip-sold");
  let vendute = 0, contato = false;
  function vendutePronto(n) {
    vendute = Math.max(0, Math.round(+n || 0));
    chipV.hidden = !vendute;
    if (!vendute) return;
    chipV.setAttribute("aria-label", "Più di " + it(vendute) + " auto vendute");
    elV.textContent = it(vendute);
    if (reduce || contato) return;
    contato = true;
    elV.textContent = "0";
    const dur = 2200, t0 = performance.now() + 950;      // parte quando il riquadro compare
    const step = (t) => {
      const k = Math.max(0, Math.min(1, (t - t0) / dur));
      elV.textContent = it(vendute * (1 - Math.pow(1 - k, 4)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    setTimeout(() => { elV.textContent = it(vendute); }, 950 + dur + 400);   // rete di sicurezza
  }

  /* ---------- voto Google: stelle ---------- */
  function votoPronto(v) {
    if (!v || !(v.voto > 0)) return;
    const stelle = document.querySelectorAll("#hs i");
    stelle.forEach((s, i) => s.style.setProperty("--f", Math.max(0, Math.min(1, v.voto - i)).toFixed(2)));
    $("#n-voto").textContent = voto1(v.voto);
    $("#l-voto").textContent = "su Google" + (v.totale ? " · " + it(v.totale) + " recensioni" : "");
    $("#chip-rate").setAttribute("aria-label", voto1(v.voto) + " stelle su 5 su Google" + (v.totale ? ", " + it(v.totale) + " recensioni" : ""));
  }

  /* ---------- auto in vetrina: pulsante e marche ---------- */
  function autoPronte(a) {
    if (!a || !a.n) return;
    $("#hero-cta").textContent = a.n === 1 ? "Guarda l’auto in vetrina" : "Guarda le " + a.n + " auto";
    const mq = $("#hero-mq"), track = $("#mq-track");
    if (!a.marche || !a.marche.length) return;
    const sl = "<i></i>";
    const lista = a.marche.map((m) => "<b>" + esc(m) + "</b>").join(sl) + sl;
    track.innerHTML = '<div class="mq-set">' + lista + "</div>";
    mq.hidden = false;
    const set = track.firstChild;
    let giri = 0;
    while (set.scrollWidth < innerWidth * 1.15 && giri++ < 6) set.insertAdjacentHTML("beforeend", lista);   // un giro deve riempire lo schermo
    const copia = set.cloneNode(true);
    track.appendChild(copia);
  }

  /* ---------- aperto ora (ora italiana, orari letti dalla sezione Contatti) ---------- */
  const GIORNI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
  function orari() {
    const sett = [[], [], [], [], [], [], []];
    document.querySelectorAll("#orari-dl > div[data-g]").forEach((r) => {
      const fasce = [];
      String(r.querySelector("dd") ? r.querySelector("dd").textContent : "").split("·").forEach((f) => {
        const m = /(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/.exec(f);
        if (m) fasce.push([+m[1] * 60 + +m[2], +m[3] * 60 + +m[4]]);
      });
      r.dataset.g.split(",").forEach((g) => { sett[+g] = sett[+g].concat(fasce); });
    });
    return sett;
  }
  const hhmm = (m) => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  function adesso() {
    const f = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    const p = {};
    f.formatToParts(new Date()).forEach((x) => { p[x.type] = x.value; });
    return { g: { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[p.weekday], m: +p.hour * 60 + +p.minute };
  }
  const pill = $("#hero-open");
  function aggiornaApertura() {
    const sett = orari();
    if (!sett.some((d) => d.length)) { pill.hidden = true; return; }
    const { g, m } = adesso();
    const oggi = sett[g].slice().sort((a, b) => a[0] - b[0]);
    const ora = oggi.find((f) => m >= f[0] && m < f[1]);
    let testo, on = false;
    if (ora) { on = true; testo = "Aperto ora · fino alle " + hhmm(ora[1]); }
    else {
      const dopo = oggi.find((f) => f[0] > m);
      if (dopo) testo = "Chiuso ora · apre alle " + hhmm(dopo[0]);
      else {
        for (let i = 1; i <= 7; i++) {
          const d = (g + i) % 7;
          if (sett[d].length) { testo = "Chiuso ora · apre " + (i === 1 ? "domani" : GIORNI[d]) + " alle " + hhmm(Math.min.apply(null, sett[d].map((f) => f[0]))); break; }
        }
      }
    }
    if (!testo) { pill.hidden = true; return; }
    pill.classList.toggle("on", on);
    pill.lastElementChild.textContent = testo;
    pill.hidden = false;
  }

  /* ---------- eventi dei dati ---------- */
  const b = B();
  nome(b.titolare); vendutePronto(b.vendute); votoPronto(b.voto); autoPronte(b.auto);
  document.addEventListener("borzi:titolare", (e) => nome(e.detail));
  document.addEventListener("borzi:voto", (e) => votoPronto(e.detail));
  document.addEventListener("borzi:auto", (e) => autoPronte(e.detail));
  aggiornaApertura();
  setInterval(aggiornaApertura, 60000);

  /* ---------- movimento: luce, inclinazione, parallasse ---------- */
  if (reduce || !("IntersectionObserver" in window)) return;
  const stage = $("#stage");
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  let visibile = true, raf = 0, sporco = true, idle = true, idleT = 0;
  let nx = 0.74, ny = 0.26, cx = nx, cy = ny;       // luce (0..1 sulla sezione)
  let tx = 0, ty = 0, rx = 0, ry = 0;                // inclinazione (-1..1)
  let ga = 0, gx = 50, gy = 20;

  new IntersectionObserver((es) => {
    visibile = es[0].isIntersecting;
    if (visibile && !raf) { sporco = true; raf = requestAnimationFrame(frame); }
  }, { threshold: 0 }).observe(hero);

  addEventListener("scroll", () => { sporco = true; if (visibile && !raf) raf = requestAnimationFrame(frame); }, { passive: true });

  if (fine) {
    hero.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect(), s = stage.getBoundingClientRect();
      nx = (e.clientX - r.left) / r.width; ny = (e.clientY - r.top) / r.height;
      tx = Math.max(-1, Math.min(1, (e.clientX - (s.left + s.width / 2)) / (s.width * 0.9)));
      ty = Math.max(-1, Math.min(1, (e.clientY - (s.top + s.height / 2)) / (s.height * 0.9)));
      gx = ((e.clientX - s.left) / s.width) * 100; gy = ((e.clientY - s.top) / s.height) * 100;
      idle = false; ga = 0.9;
      clearTimeout(idleT);
      idleT = setTimeout(() => { idle = true; ga = 0; tx = ty = 0; if (visibile && !raf) raf = requestAnimationFrame(frame); }, 2600);
      if (!raf) raf = requestAnimationFrame(frame);
    });
    hero.addEventListener("pointerleave", () => { tx = ty = 0; ga = 0; idle = true; if (!raf) raf = requestAnimationFrame(frame); });
  }

  function frame(t) {
    raf = 0;
    if (!visibile) return;
    let anima = false;
    if (fine) {
      if (idle) { nx = 0.5 + 0.28 * Math.sin(t / 4200); ny = 0.3 + 0.16 * Math.cos(t / 3100); anima = true; }   // la luce si muove piano da sola
      cx += (nx - cx) * 0.08; cy += (ny - cy) * 0.08;
      rx += (tx - rx) * 0.07; ry += (ty - ry) * 0.07;
      if (Math.abs(nx - cx) > 0.001 || Math.abs(tx - rx) > 0.002 || Math.abs(ty - ry) > 0.002) anima = true;
      hero.style.setProperty("--mx", (cx * 100).toFixed(1) + "%");
      hero.style.setProperty("--my", (cy * 100).toFixed(1) + "%");
      stage.style.setProperty("--ry", (rx * 7).toFixed(2) + "deg");
      stage.style.setProperty("--rx", (-ry * 5).toFixed(2) + "deg");
      stage.style.setProperty("--ga", ga ? "0.9" : "0");
      stage.style.setProperty("--gx", gx.toFixed(0) + "%");
      stage.style.setProperty("--gy", gy.toFixed(0) + "%");
    }
    if (sporco) {
      const h = hero.offsetHeight || 1;
      hero.style.setProperty("--sy", Math.max(0, Math.min(1, scrollY / h)).toFixed(3));
      sporco = false;
    }
    if (anima) raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
})();
