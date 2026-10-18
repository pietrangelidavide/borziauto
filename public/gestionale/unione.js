/* AutoProfit · unione dei dati tra questo dispositivo e l'archivio online.
   Logica pura (senza pagina), provata in _work/t_unione.mjs.
   Per ogni documento si confrontano tre versioni: quella di questo dispositivo, quella dell'archivio e quella dell'ultima
   sincronizzazione («base»). Chi ha cambiato rispetto alla base vince; se hanno cambiato entrambi vince questo dispositivo
   (è quello su cui stai lavorando); un documento cancellato su un lato e modificato sull'altro viene tenuto. */
(function (radice) {
  "use strict";
  const U = {};

  /* hash breve e stabile di un testo (cyrb53): serve solo a riconoscere se un documento è cambiato */
  U.hash = function (s) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  };
  U.canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, c) => ((o[c] = x[c]), o), {}) : x));
  U.h = (v) => U.hash(U.canon(v));

  /* collezione di documenti con id.
     locale, remoto: array di documenti; base: { id: hash } dell'ultima sincronizzazione;
     primo: primo accesso di questo dispositivo (base vuota): l'archivio vince e i documenti solo locali si inviano, tranne quelli «di esempio»;
     scarta(doc): true per i documenti che non vanno mai inviati nel primo accesso (esempi).
     → { applica:{set,del} (da fare qui), invia:{set,del} (da fare sull'archivio), base:{id:hash} (nuova), conflitti } */
  U.collezione = function ({ locale, remoto, base, primo, scarta }) {
    const L = new Map((locale || []).map((d) => [d.id, d])), R = new Map((remoto || []).map((d) => [d.id, d]));
    base = base || {};
    const out = { applica: { set: [], del: [] }, invia: { set: [], del: [] }, base: {}, conflitti: 0 };
    const ids = new Set([...L.keys(), ...R.keys()]);
    for (const id of ids) {
      const l = L.get(id), r = R.get(id);
      const hl = l ? U.h(l) : null, hr = r ? U.h(r) : null, hb = Object.prototype.hasOwnProperty.call(base, id) ? base[id] : undefined;
      if (hl === hr) { if (hl !== null) out.base[id] = hl; continue; }
      if (primo) {
        if (r) { out.applica.set.push(r); out.base[id] = hr; }
        else if (scarta && scarta(l)) out.applica.del.push(id);
        else { out.invia.set.push(l); out.base[id] = hl; }
        continue;
      }
      if (l && r) {                                           // diversi su entrambi i lati
        if (hb !== undefined && hl === hb) { out.applica.set.push(r); out.base[id] = hr; }
        else { if (hb === undefined || hr !== hb) out.conflitti++; out.invia.set.push(l); out.base[id] = hl; }
      } else if (l) {                                         // c'è solo qui
        if (hb !== undefined && hl === hb) out.applica.del.push(id);      // l'ha eliminato l'altro dispositivo
        else { out.invia.set.push(l); out.base[id] = hl; }                // nuovo qui, oppure modificato qui dopo l'eliminazione
      } else {                                                // c'è solo nell'archivio
        if (hb !== undefined && hr === hb) out.invia.del.push(id);        // l'ho eliminato io
        else { out.applica.set.push(r); out.base[id] = hr; }              // nuovo altrove, oppure modificato altrove dopo la mia eliminazione
      }
    }
    return out;
  };

  /* documento singolo (titolare, impostazioni). null = vuoto/predefinito.
     → { azione: "niente" | "applica" | "invia", valore, base } */
  U.singolo = function ({ locale, remoto, base, primo }) {
    const hl = locale == null ? null : U.h(locale), hr = remoto == null ? null : U.h(remoto), hb = base == null ? undefined : base;
    if (hl === hr) return { azione: "niente", valore: locale, base: hl };
    if (primo) return remoto != null ? { azione: "applica", valore: remoto, base: hr } : { azione: "invia", valore: locale, base: hl };
    if (hb !== undefined && hl === hb) return remoto != null ? { azione: "applica", valore: remoto, base: hr } : { azione: "niente", valore: locale, base: hl };
    if (locale != null) return { azione: "invia", valore: locale, base: hl };
    return { azione: "applica", valore: remoto, base: hr };
  };

  if (typeof module !== "undefined" && module.exports) module.exports = U;
  else { const GT = (radice.GT = radice.GT || {}); GT.Unione = U; }
})(typeof window !== "undefined" ? window : globalThis);
