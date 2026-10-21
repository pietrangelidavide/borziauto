/* Borzi Auto · carosello «Il nostro salone».
   Foto a tutta larghezza che scorrono da sole: la foto al centro è nitida, le vicine sfumano ai lati.
   Si ferma al passaggio del mouse, quando non si vede o con le preferenze «riduci animazioni». */
(function () {
  "use strict";
  var reel = document.getElementById("reel");
  if (!reel) return;
  var view = reel.querySelector(".reel-view");
  var slides = [].slice.call(reel.querySelectorAll(".reel-slide"));
  var n = slides.length;
  if (n < 3) return;                                   // con meno di tre foto resta la fila scorrevole
  var bar = reel.querySelector(".reel-bar");
  var pillsBox = document.getElementById("reel-pills");
  var btnPlay = document.getElementById("reel-play");
  var glow = [].slice.call(document.querySelectorAll(".salone-glow i"));
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var half = Math.floor(n / 2);
  var cur = 0, playing = !reduce, glowAt = 0;
  var hold = { hover: false, focus: false, hidden: document.hidden, away: true, drag: false };
  var prevO = [];

  /* pallini di avanzamento */
  var pills = slides.map(function (s, i) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "pill";
    b.setAttribute("aria-label", "Foto " + (i + 1) + " di " + n);
    b.appendChild(document.createElement("i"));
    b.addEventListener("click", function () { go(i); });
    pillsBox.appendChild(b);
    return b;
  });

  function offset(i) { return ((i - cur + n + half) % n) - half; }

  function layout(first) {
    slides.forEach(function (s, i) {
      var o = offset(i);
      var wrap = !first && prevO[i] !== undefined && Math.abs(o - prevO[i]) > 1;
      if (wrap) s.classList.add("jump");               // la foto che torna in coda riappare dall'altra parte, senza attraversare le altre
      s.style.setProperty("--o", o);
      s.style.setProperty("--a", Math.abs(o));
      s.classList.toggle("on", o === 0);
      s.classList.toggle("far", Math.abs(o) > 1);
      s.setAttribute("aria-hidden", o === 0 ? "false" : "true");
      prevO[i] = o;
      if (wrap) {
        void s.offsetWidth;
        requestAnimationFrame(function () { requestAnimationFrame(function () { s.classList.remove("jump"); }); });
      }
    });
    pills.forEach(function (p, i) { p.setAttribute("aria-current", i === cur ? "true" : "false"); });
    setGlow();
  }

  function setGlow() {
    if (glow.length < 2) return;
    var img = slides[cur].querySelector("img");
    var src = img && (img.currentSrc || img.src);
    if (!src) return;
    glowAt = 1 - glowAt;
    glow[glowAt].style.backgroundImage = 'url("' + src + '")';
    glow[glowAt].classList.add("on");
    glow[1 - glowAt].classList.remove("on");
  }

  function go(i) {
    i = ((i % n) + n) % n;
    if (i === cur) return;
    cur = i;
    layout(false);
  }
  var next = function () { go(cur + 1); };
  var prev = function () { go(cur - 1); };

  function sync() {
    var held = hold.hover || hold.focus || hold.hidden || hold.away || hold.drag;
    reel.classList.toggle("hold", held);
    reel.classList.toggle("still", !playing);
    btnPlay.setAttribute("aria-pressed", playing ? "false" : "true");
    btnPlay.setAttribute("aria-label", playing ? "Metti in pausa lo scorrimento" : "Riprendi lo scorrimento");
    view.setAttribute("aria-live", playing ? "off" : "polite");
  }

  /* avanza quando il pallino attivo ha finito di riempirsi */
  pillsBox.addEventListener("animationend", function (e) {
    if (e.animationName === "reel-fill" && playing) next();
  });

  document.getElementById("reel-next").addEventListener("click", next);
  document.getElementById("reel-prev").addEventListener("click", prev);
  btnPlay.addEventListener("click", function () { playing = !playing; sync(); });

  /* pausa mentre ci si interagisce, quando la scheda è nascosta o il carosello è fuori schermo */
  var fine = matchMedia("(hover: hover)").matches;
  if (fine) {
    reel.addEventListener("mouseenter", function () { hold.hover = true; sync(); });
    reel.addEventListener("mouseleave", function () { hold.hover = false; sync(); });
  }
  reel.addEventListener("focusin", function (e) { hold.focus = e.target.matches(":focus-visible"); sync(); });
  reel.addEventListener("focusout", function () { hold.focus = false; sync(); });
  document.addEventListener("visibilitychange", function () { hold.hidden = document.hidden; sync(); });
  reel.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") { next(); e.preventDefault(); }
    else if (e.key === "ArrowLeft") { prev(); e.preventDefault(); }
  });

  /* trascinamento con dito o mouse, e tocco su una foto laterale */
  var sx = 0, dx = 0, down = false, moved = false;
  view.addEventListener("pointerdown", function (e) {
    if (e.button > 0) return;
    down = true; moved = false; sx = e.clientX; dx = 0;
  });
  view.addEventListener("pointermove", function (e) {
    if (!down) return;
    dx = e.clientX - sx;
    if (!moved && Math.abs(dx) > 8) {
      moved = true; hold.drag = true;
      view.classList.add("drag"); sync();
      try { view.setPointerCapture(e.pointerId); } catch (x) { /* ignora */ }
    }
    if (moved) view.style.setProperty("--drag", dx + "px");
  });
  function release() {
    if (!down) return;
    down = false;
    view.classList.remove("drag");
    view.style.removeProperty("--drag");
    hold.drag = false; sync();
    if (moved) { if (dx <= -50) next(); else if (dx >= 50) prev(); }
  }
  view.addEventListener("pointerup", release);
  view.addEventListener("pointercancel", release);
  view.addEventListener("click", function (e) {
    if (moved) { moved = false; e.preventDefault(); return; }
    var s = e.target.closest(".reel-slide");
    if (!s) return;
    var i = slides.indexOf(s);
    if (i > -1 && i !== cur) go(i);
  });
  view.addEventListener("dragstart", function (e) { e.preventDefault(); });

  /* parte quando entra nello schermo: prima l'apertura a ventaglio, poi lo scorrimento */
  var started = false;
  function enter() {
    if (started) return;
    started = true;
    if (reduce) { reel.classList.add("in"); }
    else {
      reel.classList.add("intro", "in");
      setTimeout(function () { reel.classList.remove("intro"); hold.away = false; sync(); }, 1700);
      return;
    }
    hold.away = false; sync();
  }
  if (reduce) btnPlay.hidden = true;                   // con «riduci animazioni» non c'è scorrimento automatico: restano frecce e pallini
  layout(true);
  reel.classList.add("live");
  bar.hidden = false;
  sync();
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (en) {
      var vis = en[0].isIntersecting;
      if (vis) { if (!started) enter(); else { hold.away = false; sync(); } }
      else { hold.away = true; sync(); }
    }, { threshold: 0.35 }).observe(reel);
  } else { enter(); }
})();
