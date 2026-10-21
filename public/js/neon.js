/* Borzi Auto · l'auto al neon: la linea del marchio, disegnata a luce, con un passaggio di luce, il faro che si accende,
   le scie e il riflesso sul pavimento. È un SVG in linea (non un file a parte) così prende i colori del garage (--xeno, --xeno-2)
   e funziona anche nella demo a file unico. Le animazioni si fermano da sole con «riduci movimento» (base.css).
   AP.Neon.markup(etichetta) → stringa SVG; AP.Neon.metti(elemento, etichetta) la inserisce. */
(function (root, f) { const o = f(); if (typeof module !== "undefined" && module.exports) module.exports = o; else (root.AP = root.AP || {}).Neon = o; })(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const D = "M281.5 54.7 283.2 54.0 287.9 51.5 289.2 51.0 292.5 49.5 297.0 47.1 299.5 46.2 304.1 44.0 310.0 41.6 311.5 41.1 316.0 39.0 318.7 38.1 320.2 37.3 322.1 36.7 324.2 35.8 326.7 35.1 328.2 34.4 331.2 33.5 337.0 31.2 347.0 28.0 350.5 27.1 352.2 26.3 356.0 25.2 360.5 24.2 364.0 22.9 367.2 22.1 371.5 21.4 379.2 19.6 382.7 19.1 386.2 18.2 396.7 16.8 410.7 15.8 415.7 15.7 431.7 16.2 444.5 16.3 465.5 17.1 485.0 18.2 490.0 18.8 495.5 19.3 511.2 20.0 520.0 21.1 543.7 22.9 552.0 24.3 559.0 24.8 570.7 26.1 576.5 27.2 585.5 27.9 598.2 29.8 610.5 31.2 615.0 32.0 619.2 32.3 627.0 33.7 633.2 34.4 636.2 35.1 644.5 36.1 648.2 36.8 652.7 37.3 656.5 38.2 663.5 39.1 668.2 40.1 672.5 40.7 675.2 41.3 683.2 42.4 686.2 43.1 692.5 44.1 699.2 45.4 700.0 45.4 700.7 45.3 701.2 45.0 701.5 44.5 701.4 44.0 701.2 43.7 700.5 43.2 694.2 41.5 691.7 40.6 684.2 38.8 680.2 38.0 676.5 36.9 674.2 36.6 671.5 35.6 670.5 35.4 667.2 35.0 663.2 34.2 658.2 33.5 654.7 32.4 646.5 31.5 643.7 30.8 640.0 30.2 637.2 29.6 628.2 28.3 623.5 27.4 614.2 26.4 610.7 25.8 606.0 25.3 601.7 24.5 592.2 23.5 586.0 22.4 570.7 20.8 568.2 20.7 566.1 20.5 563.5 19.9 557.5 19.2 555.2 19.1 548.7 18.4 536.7 17.3 532.7 16.7 527.5 16.2 524.0 16.0 518.0 15.5 511.2 14.6 497.2 13.3 483.0 12.4 473.5 11.3 467.2 11.0 463.2 10.6 456.5 10.3 450.5 9.3 444.2 8.9 439.5 8.3 434.5 8.1 418.7 8.3 411.5 8.7 408.5 9.1 395.7 10.3 388.0 11.5 385.5 12.3 376.7 13.5 375.5 13.9 372.5 14.5 369.7 15.5 364.2 16.5 362.1 17.2 360.2 17.6 353.2 19.5 350.7 20.6 344.0 22.5 341.5 23.6 338.2 24.5 331.5 27.0 330.0 27.4 321.5 31.2 317.7 32.6 315.7 33.8 311.2 35.7 309.5 36.7 308.0 37.2 306.7 38.0 304.7 38.9 300.7 41.2 299.2 41.8 298.2 42.4 296.0 43.3 292.0 45.8 285.0 49.6 283.5 50.7 282.2 51.3 281.3 52.0 280.0 53.1 279.7 54.0 279.9 54.5 280.2 54.7 280.7 54.9 281.5 54.7ZM141.1 89.7 146.9 87.2 149.2 86.6 152.7 85.4 162.0 82.7 165.0 82.0 167.5 81.6 170.0 80.7 175.0 79.5 177.7 79.0 181.2 78.6 184.7 77.6 196.0 75.8 199.5 75.5 204.2 74.5 212.7 73.6 215.2 73.0 221.0 72.1 226.5 71.4 236.2 70.7 239.5 70.3 244.2 69.4 253.0 68.5 256.5 68.4 268.5 67.6 271.5 67.2 276.0 66.5 292.2 65.4 300.0 64.7 305.2 64.5 316.2 63.4 328.5 62.8 341.2 62.4 349.2 61.6 367.5 61.1 376.5 60.6 387.0 60.3 405.2 59.6 418.7 59.4 424.2 59.1 429.5 59.1 432.7 58.8 439.5 58.7 445.0 58.3 452.0 58.4 456.7 58.2 465.7 58.2 469.7 58.0 475.7 58.0 477.7 57.9 479.5 57.5 481.2 56.8 483.5 56.2 485.2 55.2 487.5 54.5 489.5 53.6 492.2 52.0 494.7 50.9 497.2 49.7 498.2 49.0 500.5 48.0 502.0 47.0 505.5 45.2 508.0 43.6 509.7 42.9 513.5 40.7 515.9 39.0 517.6 38.2 519.7 36.7 520.9 35.5 521.3 34.7 521.4 33.7 521.4 32.5 520.8 30.5 519.8 29.2 518.5 28.3 516.5 27.6 512.2 26.8 509.5 26.0 501.2 24.4 494.2 23.5 489.5 22.6 479.2 21.5 467.7 20.7 462.5 20.5 455.0 20.0 441.0 19.3 415.7 19.3 412.0 19.5 407.0 19.4 399.2 19.8 392.2 20.6 389.7 20.7 388.9 21.0 388.7 21.7 389.1 22.2 390.0 22.4 415.2 23.1 430.2 24.0 436.7 24.3 441.5 24.4 448.2 24.8 459.7 25.2 464.5 25.7 474.5 26.4 480.2 27.3 488.7 28.0 495.7 29.2 504.7 31.2 506.5 32.2 506.9 33.0 506.5 33.7 505.5 34.4 503.0 35.6 501.7 36.6 500.2 37.3 499.0 38.2 494.4 40.7 493.3 41.5 488.7 43.9 486.0 45.7 484.0 46.7 482.5 47.7 481.0 48.4 479.5 49.5 476.7 50.8 474.2 51.5 471.5 52.5 468.0 52.7 455.5 52.3 443.0 52.3 432.0 51.9 412.0 51.8 404.2 52.0 391.0 52.5 360.7 53.0 348.2 53.5 345.5 53.7 335.7 53.9 327.2 54.4 317.5 54.7 305.7 55.8 298.0 56.2 295.2 56.5 288.5 56.9 280.7 57.6 277.5 57.7 271.0 58.4 268.5 58.7 256.2 59.7 250.0 60.7 248.0 60.8 241.7 61.7 231.2 62.7 230.0 63.0 228.5 63.5 226.5 63.9 222.2 64.5 216.7 65.4 213.5 65.8 211.0 66.3 208.7 66.9 202.2 68.0 197.7 68.9 194.7 69.8 191.9 70.5 189.0 70.9 186.7 71.6 184.2 72.1 179.7 73.4 175.8 74.2 173.5 75.2 169.0 76.2 163.5 78.1 160.2 79.0 157.7 80.1 156.0 80.6 154.5 81.3 152.0 82.2 147.7 84.3 146.0 84.9 142.2 87.0 140.2 88.7 139.9 89.2 139.8 89.5 140.0 89.7 141.1 89.7ZM490.8 91.7 492.5 91.4 497.5 89.7 501.7 88.1 505.5 86.5 509.5 84.0 511.9 82.2 513.1 81.5 515.2 79.5 516.6 78.5 518.6 76.2 520.4 74.7 523.7 70.5 524.6 69.0 525.7 67.7 526.7 65.9 527.2 65.2 528.2 64.6 531.0 63.5 536.0 62.3 538.0 61.5 541.0 60.9 544.0 60.0 547.0 59.4 551.2 58.1 559.5 56.5 564.2 55.1 569.5 54.4 572.7 53.5 582.0 51.8 586.2 51.3 590.2 50.5 595.0 49.8 600.7 49.3 604.2 48.7 610.2 48.4 613.5 48.0 617.2 48.0 621.2 47.6 628.0 47.5 632.2 48.2 640.7 49.0 644.7 49.7 645.7 49.5 645.9 49.0 645.5 48.4 642.7 47.0 641.8 46.7 640.5 46.5 634.0 46.1 628.7 46.1 626.5 45.9 621.2 45.8 613.2 45.4 597.2 45.8 587.0 46.6 580.7 47.7 573.0 48.5 566.5 49.7 562.7 50.7 557.0 51.5 553.7 52.6 547.7 54.1 543.5 54.9 541.5 55.7 537.7 56.7 529.7 59.2 527.6 59.7 525.7 60.5 525.0 60.7 518.2 60.8 512.2 61.1 502.0 62.3 500.0 62.7 497.5 63.6 494.5 64.3 490.4 65.7 488.9 66.7 488.5 67.2 488.5 67.5 489.0 67.7 492.7 67.7 494.5 67.4 496.7 66.8 502.0 66.0 507.5 65.5 514.0 65.1 517.5 65.1 518.7 65.5 519.3 66.0 519.5 66.7 519.5 67.2 518.5 69.7 517.5 71.2 515.8 73.2 514.5 74.2 513.4 75.5 511.0 77.2 509.7 78.5 508.4 79.2 505.5 81.4 503.9 82.2 500.5 84.4 497.5 86.1 494.5 87.4 492.5 88.7 488.8 90.0 488.2 90.4 488.0 90.7 488.0 91.2 488.1 91.5 488.5 91.7 489.5 91.8 490.8 91.7Z";
  let n = 0;
  function markup(etichetta) {
    const k = "nn" + (++n);
    return `<svg class="neon ${k}" viewBox="30 -6 760 160" role="img" aria-label="${(etichetta || "").replace(/"/g, "&quot;")}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMaxYMid meet">
<defs>
<path id="${k}c" fill-rule="evenodd" d="${D}"/>
<filter id="${k}g" x="-8%" y="-60%" width="116%" height="220%" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceGraphic" stdDeviation="1.6" result="a"/><feGaussianBlur in="SourceGraphic" stdDeviation="6" result="b"/><feGaussianBlur in="SourceGraphic" stdDeviation="16" result="c"/><feMerge><feMergeNode in="c"/><feMergeNode in="b"/><feMergeNode in="a"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="${k}b" x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="2.4"/></filter>
<mask id="${k}m" maskUnits="userSpaceOnUse" x="0" y="-20" width="820" height="200"><rect class="rev" x="30" y="-20" width="760" height="200" fill="#fff"/></mask>
<mask id="${k}s" maskUnits="userSpaceOnUse" x="0" y="-20" width="820" height="200"><use href="#${k}c" fill="#fff"/></mask>
<linearGradient id="${k}p" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="${k}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".7" stop-color="#fff" stop-opacity="0"/></linearGradient>
<mask id="${k}r" maskUnits="userSpaceOnUse" x="0" y="96" width="820" height="70"><rect x="0" y="96" width="820" height="70" fill="url(#${k}f)"/></mask>
<linearGradient id="${k}t" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="${k}z" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".2" stop-color="#fff" stop-opacity="1"/><stop offset=".8" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<radialGradient id="${k}h"><stop offset="0" stop-color="#fff"/><stop offset=".25" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
</defs>
<style>
.${k} .l{fill:var(--xeno,#cfe6ff)}
.${k} .w{fill:#fff}
.${k} .pav{stroke:var(--xeno,#cfe6ff);stroke-width:1.4}
.${k} .gl{fill:var(--xeno,#cfe6ff)}
.${k} .rev{transform-box:fill-box;transform-origin:100% 50%;animation:${k}r 2.6s cubic-bezier(.3,.6,.2,1) both}
.${k} .pass{transform:translateX(900px) skewX(-24deg);animation:${k}s 7.5s 2.8s cubic-bezier(.5,0,.3,1) infinite}
.${k} .faro{transform-box:fill-box;transform-origin:50% 50%;animation:${k}h 4s 2.2s ease-in-out infinite both}
.${k} .fascio{transform-box:fill-box;transform-origin:100% 50%;animation:${k}fa 4s 2.2s ease-in-out infinite both}
.${k} .scia{transform-box:fill-box;animation:${k}sc 2.6s linear infinite}
.${k} .scia:nth-of-type(2){animation-delay:-.9s}.${k} .scia:nth-of-type(3){animation-delay:-1.7s}
@keyframes ${k}r{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes ${k}s{0%{transform:translateX(780px) skewX(-24deg)}38%,100%{transform:translateX(-160px) skewX(-24deg)}}
@keyframes ${k}h{0%,100%{opacity:.55;transform:scale(.8)}12%{opacity:1;transform:scale(1.25)}20%{opacity:.7}50%{opacity:.9;transform:scale(1)}}
@keyframes ${k}fa{0%,100%{opacity:.35;transform:scaleX(.55)}12%{opacity:1;transform:scaleX(1)}50%{opacity:.6;transform:scaleX(.8)}}
@keyframes ${k}sc{0%{opacity:0;transform:translateX(-30px)}20%{opacity:.9}100%{opacity:0;transform:translateX(70px)}}
</style>
<!-- pavimento e riflesso -->
<rect class="gl" x="40" y="99" width="740" height="1.6" mask="url(#${k}m)" opacity=".7" filter="url(#${k}b)"/>
<g mask="url(#${k}r)" opacity=".55"><g transform="translate(0,200) scale(1,-1)"><g mask="url(#${k}m)"><use class="l" href="#${k}c" filter="url(#${k}b)"/></g></g></g>
<!-- scie dietro l'auto -->
<g mask="url(#${k}m)">
<rect class="scia gl" x="716" y="30" width="62" height="1.6" fill="url(#${k}t)"/>
<rect class="scia gl" x="708" y="50" width="78" height="1.6" fill="url(#${k}t)"/>
<rect class="scia gl" x="700" y="72" width="70" height="1.6" fill="url(#${k}t)"/>
</g>
<!-- il neon -->
<g mask="url(#${k}m)"><use class="l" href="#${k}c" filter="url(#${k}g)"/><use class="w" href="#${k}c" opacity=".55"/></g>
<!-- passaggio di luce -->
<g mask="url(#${k}s)"><rect class="pass w" x="0" y="-20" width="70" height="200" fill="url(#${k}p)"/></g>
<!-- faro -->
<g class="faro"><ellipse class="gl" cx="150" cy="86" rx="22" ry="9" fill="url(#${k}h)" style="fill:url(#${k}h)"/></g>
<rect class="fascio gl" x="40" y="84.6" width="104" height="2.6" fill="url(#${k}z)" style="fill:url(#${k}z)" opacity=".9"/>
</svg>`;
  }
  function metti(el, etichetta) { if (el) el.innerHTML = markup(etichetta); return el; }
  return { markup, metti };
});
