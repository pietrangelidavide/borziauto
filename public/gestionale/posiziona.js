/* Gestionale · dove stanno «Fatture» e «Vai al sito».
   Su schermo largo vivono in fondo al menu a sinistra, con nome e icona; su telefono e tablet restano in alto, solo icona.
   I due pulsanti vengono spostati (non copiati), quindi i loro collegamenti restano quelli scelti in verifica.js. */
(function () {
  "use strict";
  var az = document.getElementById("gt-az"), ext = document.getElementById("gt-ext");
  if (!az || !ext || !window.matchMedia) return;
  var largo = window.matchMedia("(min-width: 1101px)");
  function metti() {
    var dove = largo.matches ? ext : az;
    ["b-fatture", "b-sito"].forEach(function (id) {
      var a = document.getElementById(id);
      if (a && a.parentNode !== dove) dove.appendChild(a);
    });
  }
  metti();
  if (largo.addEventListener) largo.addEventListener("change", metti);
  else if (largo.addListener) largo.addListener(metti);
})();
