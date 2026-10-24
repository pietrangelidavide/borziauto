/* Borzi Auto · «Il nostro salone».
   Fascia di foto a tutta larghezza che scorre da sola: rallenta col mouse sopra, si trascina col dito o col mouse,
   si sposta con le frecce della tastiera e si può mettere in pausa. Si ferma quando non si vede.
   Con «riduci animazioni» (o senza JavaScript) resta una fila di foto da far scorrere a mano. */
(function () {
  "use strict";
  var el = document.querySelector("[data-reel]");
  if (!el) return;
  var track = el.querySelector(".reel-track");
  var bar = document.querySelector(".reel-bar");
  var btn = document.getElementById("reel-play");
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!track || reduce) return;

  var originals = [].slice.call(track.children);
  var n = originals.length;
  if (n < 2) return;
  var clones = [];
  function addSet() {
    originals.forEach(function (li) {
      var c = li.cloneNode(true);
      c.setAttribute("aria-hidden", "true");
      var im = c.querySelector("img");
      if (im) { im.alt = ""; im.loading = "lazy"; }
      track.appendChild(c);
      clones.push(c);
    });
  }
  addSet();
  el.classList.add("is-live");

  var BASE = -46;                       // px al secondo, verso sinistra
  var x = 0, v = BASE, period = 0, glide = 0;
  var playing = true, hover = false, drag = false, visible = false, raf = 0, prev = 0;
  var lastX = 0, lastT = 0;

  function measure() {
    var kids = track.children;
    var p = kids[n].offsetLeft - kids[0].offsetLeft;     // larghezza di un giro completo
    if (p <= 0) return;
    period = p;
    var need = Math.ceil(el.clientWidth / period) + 1;   // giri che servono per non lasciare mai un vuoto
    while (kids.length < need * n) addSet();
  }
  function wrap() { if (period > 0) x = ((x % period) - period) % period; }
  function paint() { track.style.transform = "translate3d(" + x.toFixed(2) + "px,0,0)"; }

  function tick(t) {
    raf = 0;
    if (!visible || document.hidden) { prev = 0; return; }
    var dt = prev ? Math.min((t - prev) / 1000, 0.05) : 0;
    prev = t;
    if (!drag) {
      var target = !playing ? 0 : hover ? BASE * 0.3 : BASE;
      v += (target - v) * (1 - Math.exp(-dt * 2.2));
      x += v * dt;
      if (glide) {                                       // spostamento con le frecce
        var s = glide * (1 - Math.exp(-dt * 7));
        x += s; glide -= s;
        if (Math.abs(glide) < 0.5) glide = 0;
      }
    }
    wrap(); paint();
    raf = requestAnimationFrame(tick);
  }
  function start() { if (!raf && visible) raf = requestAnimationFrame(tick); }

  /* mouse sopra: rallenta; dito o mouse: trascina con inerzia */
  el.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") hover = true; });
  el.addEventListener("pointerleave", function () { hover = false; });
  el.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag = true; glide = 0; lastX = e.clientX; lastT = e.timeStamp; el.classList.add("drag");
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignora */ }
  });
  el.addEventListener("pointermove", function (e) {
    if (!drag) return;
    var dx = e.clientX - lastX, dt = (e.timeStamp - lastT) / 1000;
    x += dx;
    if (dt > 0) v = Math.max(-1400, Math.min(1400, dx / dt));
    lastX = e.clientX; lastT = e.timeStamp;
  });
  function release() { drag = false; el.classList.remove("drag"); prev = 0; }
  el.addEventListener("pointerup", release);
  el.addEventListener("pointercancel", release);
  el.addEventListener("dragstart", function (e) { e.preventDefault(); });

  /* tastiera: le frecce spostano di una foto */
  el.addEventListener("keydown", function (e) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    var gap = parseFloat(getComputedStyle(track).columnGap) || 16;
    var w = track.children[0].offsetWidth + gap;
    glide += (e.key === "ArrowRight" ? -1 : 1) * w;
    e.preventDefault(); start();
  });

  /* pausa */
  function sync() {
    if (!btn) return;
    btn.setAttribute("aria-pressed", playing ? "false" : "true");
    btn.setAttribute("aria-label", playing ? "Metti in pausa lo scorrimento" : "Riprendi lo scorrimento");
  }
  if (btn) btn.addEventListener("click", function () { playing = !playing; sync(); start(); });
  if (bar) bar.hidden = false;
  sync();

  addEventListener("resize", measure);
  addEventListener("load", measure);
  measure();

  /* parte quando entra nello schermo */
  var seen = false;
  function show() { el.classList.add("in"); }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (en) {
      visible = en[0].isIntersecting;
      if (visible && !seen) { seen = true; show(); }
      start();
    }, { rootMargin: "120px 0px" }).observe(el);
  } else { visible = true; show(); start(); }
  document.addEventListener("visibilitychange", start);
})();
