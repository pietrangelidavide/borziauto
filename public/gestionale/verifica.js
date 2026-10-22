/* Borzi Auto · verifica dell'auto e collegamenti agli strumenti esterni.
   Cosa fa: per una targa o un telaio elenca i controlli utili prima di comprare o vendere (storico, revisioni e km, assicurazione,
   furto, classe ambientale, proprietà e vincoli). Ogni voce apre il sito giusto in un'altra scheda e copia targa o telaio negli appunti;
   il risultato lo guardi tu sul sito e lo segni qui («A posto» / «Da guardare»), con una nota.
   Cosa NON fa: non interroga nessun sito da solo. I portali ufficiali usano il captcha e carVertical è a pagamento e senza accesso libero:
   qui non c'è nessun dato copiato o ricavato di nascosto. Controllo di formato del telaio e costruttore: fatto qui, senza rete.
   Qui c'è anche il collegamento alla fatturazione online (Bluenext) e i dati da incollare nella fattura.
   Riservato: targa, telaio e risultati non vanno mai sul sito. */
(function () {
  "use strict";
  const GT = (window.GT = window.GT || {});
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => TG.esc(s);
  let X = null;

  /* ---------- collegamenti (modificabili in garage.json → strumenti) ---------- */
  const DEF = {
    fatturazione: { nome: "Bluenext", url: "https://servizi.bluenext.it", info: "https://www.bluenext.it/it/software/fatture-online/" },
    storico: { nome: "carVertical", url: "https://www.carvertical.com/it", azienda: "https://www.carvertical.com/it/business" },
  };
  const https = (u, d) => (typeof u === "string" && /^https:\/\/[^\s"'<>]+$/.test(u.trim()) ? u.trim() : d);
  function strumenti() {
    const c = (window.AP && AP.Config && AP.Config.cfg && AP.Config.cfg.strumenti) || {}, f = c.fatturazione || {}, s = c.storico || {};
    return {
      fatturazione: { nome: String(f.nome || DEF.fatturazione.nome).slice(0, 40), url: https(f.url, DEF.fatturazione.url), info: https(f.info, DEF.fatturazione.info) },
      storico: { nome: String(s.nome || DEF.storico.nome).slice(0, 40), url: https(s.url, DEF.storico.url), azienda: https(s.azienda, DEF.storico.azienda) },
    };
  }

  /* ---------- i controlli ---------- */
  const PORTALE = "https://www.ilportaledellautomobilista.it/";
  const ELENCO = [
    { k: "storico", t: "Storico completo", dove: () => strumenti().storico.nome, costo: "A pagamento", con: "telaio", url: () => strumenti().storico.url,
      cosa: "Chilometri, incidenti, furti, proprietari, importazione dall’estero: raccoglie molte fonti in un solo report. Incolla il telaio (o la targa) nella casella." },
    { k: "revisioni", t: "Revisioni e chilometri registrati", dove: () => "Portale dell’Automobilista", costo: "Gratis", con: "targa", url: () => PORTALE + "interrogazionistoricorevisioni/spa/",
      cosa: "Le revisioni fatte dal 1° giugno 2018, con i chilometri registrati: confrontali con quelli dell’annuncio. Se chiede l’accesso servono SPID o CIE." },
    { k: "rca", t: "Assicurazione RC auto", dove: () => "Portale dell’Automobilista", costo: "Gratis", con: "targa", url: () => PORTALE + "web/portale-automobilista/ext/verifica-copertura-rc",
      cosa: "Dice se l’auto ha una copertura RC attiva." },
    { k: "furto", t: "Furto o smarrimento", dove: () => "Ministero dell’Interno (Crimnet)", costo: "Gratis", con: "targa", url: () => "https://crimnet.dcpc.interno.gov.it/crimnet/",
      cosa: "Cerca denunce di furto o smarrimento per targa o telaio. I dati arrivano con circa due giorni di ritardo e non hanno valore legale." },
    { k: "classe", t: "Classe ambientale", dove: () => "Portale dell’Automobilista", costo: "Gratis", con: "targa", url: () => PORTALE + "web/portale-automobilista/ext/verifica-classe-ambientale-veicolo",
      cosa: "Euro ed emissioni: serve per sapere dove l’auto può circolare." },
    { k: "pra", t: "Proprietà, fermi e ipoteche", dove: () => "ACI (Visurenet)", costo: "A pagamento", con: "targa", url: () => "https://visurenet.aci.it/",
      cosa: "Visura del PRA: intestatario, passaggi di proprietà, fermi amministrativi e ipoteche. Servono SPID o CIE." },
  ];
  const CHIAVI = ELENCO.map((e) => e.k);

  /* risultati salvati → forma pulita (o null). voci: { chiave: { s: "ok" | "att", n: nota, d: data } } */
  function norm(v) {
    if (!v || typeof v !== "object" || !v.voci || typeof v.voci !== "object") return null;
    const voci = {};
    CHIAVI.forEach((k) => {
      const x = v.voci[k];
      if (x && (x.s === "ok" || x.s === "att")) voci[k] = { s: x.s, n: String(x.n || "").slice(0, 200), d: /^\d{4}-\d{2}-\d{2}$/.test(String(x.d || "")) ? x.d : "" };
    });
    return Object.keys(voci).length ? { voci } : null;
  }
  function riepilogo(a) {
    const v = norm(a && a.verifiche), r = { fatte: 0, totale: ELENCO.length, att: 0, ok: 0 };
    if (!v) return r;
    Object.values(v.voci).forEach((x) => { r.fatte++; if (x.s === "att") r.att++; else r.ok++; });
    return r;
  }

  /* ---------- telaio (VIN): controllo del formato e del costruttore, senza rete ---------- */
  const VIN_OK = /^[A-HJ-NPR-Z0-9]{17}$/;
  const pulisciVin = (s) => String(s || "").toUpperCase().replace(/[\s-]/g, "").slice(0, 20);
  /* i primi tre caratteri dicono chi ha costruito l'auto; solo i codici più comuni */
  const WMI = {
    WVW: "Volkswagen", WVG: "Volkswagen", WV1: "Volkswagen", WV2: "Volkswagen", WV3: "Volkswagen", WAU: "Audi", WA1: "Audi", TRU: "Audi",
    WBA: "BMW", WBS: "BMW", WBY: "BMW", WBX: "BMW", WMW: "MINI", WME: "smart", WP0: "Porsche", WP1: "Porsche",
    WDB: "Mercedes-Benz", WDC: "Mercedes-Benz", WDD: "Mercedes-Benz", WDF: "Mercedes-Benz", W1K: "Mercedes-Benz", W1N: "Mercedes-Benz", W1V: "Mercedes-Benz",
    W0L: "Opel", W0V: "Opel", WF0: "Ford", TMB: "Škoda", VSS: "SEAT/Cupra", VF1: "Renault", VF3: "Peugeot", VF7: "Citroën", VR1: "DS", UU1: "Dacia",
    ZFA: "Fiat", ZFC: "Fiat", ZAR: "Alfa Romeo", ZLA: "Lancia", ZFF: "Ferrari", ZAM: "Maserati", ZHW: "Lamborghini", ZAC: "Jeep",
    YV1: "Volvo", YV4: "Volvo", SAL: "Land Rover", SAJ: "Jaguar", SCC: "Lotus", SCF: "Aston Martin", SBM: "McLaren",
    JTD: "Toyota", JTM: "Toyota", JTE: "Toyota", JT2: "Toyota", SB1: "Toyota", JTH: "Lexus", JN1: "Nissan", JN8: "Nissan", SJN: "Nissan", JHM: "Honda", SHH: "Honda", JMZ: "Mazda",
    JMB: "Mitsubishi", JS3: "Suzuki", TSM: "Suzuki", JF1: "Subaru", JF2: "Subaru", KMH: "Hyundai", TMA: "Hyundai", KNA: "Kia", KND: "Kia", U5Y: "Kia",
    "5YJ": "Tesla", "7SA": "Tesla", XP7: "Tesla", LRW: "Tesla",
  };
  const ORD = "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
  const pos2 = (s) => ORD.indexOf(s[0]) * 40 + ORD.indexOf(s[1]);
  /* [da, a, paese] sui primi due caratteri, nell'ordine dei codici del telaio (lettere, poi cifre) */
  const PAESI = [["SA", "SM", "Regno Unito"], ["SN", "ST", "Germania"], ["SU", "SZ", "Polonia"], ["TA", "TH", "Svizzera"], ["TJ", "TP", "Repubblica Ceca"], ["TR", "TV", "Ungheria"], ["TW", "T1", "Portogallo"],
    ["U5", "U7", "Slovacchia"], ["UU", "UX", "Romania"], ["VA", "VE", "Austria"], ["VF", "VR", "Francia"], ["VS", "VW", "Spagna"], ["W0", "W9", "Germania"], ["WA", "WZ", "Germania"],
    ["XL", "XM", "Paesi Bassi"], ["YA", "YE", "Belgio"], ["YF", "YK", "Finlandia"], ["YS", "YW", "Svezia"], ["ZA", "ZR", "Italia"],
    ["JA", "JT", "Giappone"], ["KL", "KR", "Corea del Sud"], ["LA", "L0", "Cina"], ["MA", "ME", "India"], ["NM", "NR", "Turchia"]];
  function paeseDa(v) {
    const c = v.slice(0, 2);
    for (const [a, b, p] of PAESI) if (pos2(c) >= pos2(a) && pos2(c) <= pos2(b)) return p;
    const r = v[0];
    return /[1-5]/.test(r) ? "Nord America" : /[67]/.test(r) ? "Oceania" : /[89]/.test(r) ? "Sud America" : /[A-H]/.test(r) ? "Africa" : /[J-R]/.test(r) ? "Asia" : /[S-Z]/.test(r) ? "Europa" : "";
  }
  function vin(testo) {
    const v = pulisciVin(testo);
    if (!v) return { stato: "vuoto", v };
    if (!VIN_OK.test(v)) return { stato: "no", v, n: v.length };
    return { stato: "ok", v, costruttore: WMI[v.slice(0, 3)] || "", paese: paeseDa(v) };
  }
  /* il costruttore indicato dal telaio è quello scritto in «Marca»? */
  function stessaMarca(costruttore, marca) {
    const m = TG.norm(marca || ""); if (!m || !costruttore) return true;
    return costruttore.split("/").some((c) => { const n = TG.norm(c); return m.includes(n) || n.includes(m); });
  }

  /* ---------- appunti ---------- */
  async function copia(testo) {
    try { await navigator.clipboard.writeText(testo); return true; } catch (e) { /* si prova il metodo vecchio */ }
    try {
      const t = document.createElement("textarea"); t.value = testo; t.setAttribute("readonly", ""); t.style.cssText = "position:fixed;left:-9999px;top:0";
      document.body.append(t); t.select(); const ok = document.execCommand("copy"); t.remove(); return ok;
    } catch (e) { return false; }
  }

  /* ---------- la finestra ---------- */
  let A = null, voci = {}, opz = {};
  const fmtData = (d) => (d ? d.slice(8, 10) + "/" + d.slice(5, 7) + "/" + d.slice(0, 4) : "");
  const valore = (k) => (k === "telaio" ? pulisciVin($("#vf-telaio").value) : String($("#vf-targa").value || "").trim().toUpperCase().replace(/\s+/g, ""));

  function riga(e) {
    const v = voci[e.k], pag = e.costo !== "Gratis";
    const st = [["ok", "A posto"], ["att", "Da guardare"]].map(([s, t]) => `<button type="button" data-s="${s}" aria-pressed="${!!v && v.s === s}">${t}</button>`).join("");
    return `<li class="vf-r${v ? " s-" + v.s : ""}" data-k="${e.k}">
  <div class="vf-t"><b>${esc(e.t)}</b><span class="vf-dove">${esc(e.dove())}</span><small class="vf-costo${pag ? " pag" : ""}">${esc(e.costo)}</small></div>
  <p class="vf-c">${esc(e.cosa)}</p>
  <div class="vf-az">
    <a class="btn btn-line sm" href="${esc(e.url())}" target="_blank" rel="noopener noreferrer" data-copia="${e.con}" aria-label="Apri ${esc(e.dove())} in una nuova scheda e copia ${e.con === "telaio" ? "il telaio" : "la targa"}">Apri e copia ${e.con === "telaio" ? "il telaio" : "la targa"}</a>
    ${opz.libero ? "" : `<div class="ck-seg" role="group" aria-label="Risultato: ${esc(e.t)}">${st}</div>`}
  </div>
  ${v && !opz.libero ? `<label class="vf-n">Nota${v.d ? " · " + fmtData(v.d) : ""}<input data-f="nota" value="${esc(v.n)}" placeholder="${v.s === "att" ? "Cosa non torna" : "Se vuoi, scrivi cosa hai visto"}" maxlength="200" autocomplete="off"></label>` : ""}
</li>`;
  }
  function disegna() {
    $("#vf-lista").innerHTML = ELENCO.map(riga).join("");
    const att = Object.values(voci).filter((x) => x.s === "att").length, fatte = Object.keys(voci).length;
    $("#vf-prog").textContent = opz.libero ? "" : `${fatte} su ${ELENCO.length} controllate`;
    $("#vf-prog").hidden = !!opz.libero;
    $("#vf-sum").innerHTML = opz.libero ? "" : att ? `<span class="late">${att === 1 ? "Una voce da guardare" : att + " voci da guardare"}</span>: ricontrolla prima di comprare o vendere.` : fatte ? "Nessuna voce da guardare." : "Apri un controllo, guarda il risultato e segnalo qui.";
  }
  function aggiornaVin() {
    const r = vin($("#vf-telaio").value), p = $("#vf-vin");
    p.className = "vf-vin small";
    if (r.stato === "vuoto") { p.innerHTML = "Il telaio (17 caratteri) si trova sul libretto alla voce <b>E</b> e sull’auto, sotto il parabrezza. Con il telaio i controlli sono più precisi."; return; }
    if (r.stato === "no") { p.classList.add("no"); p.innerHTML = `Il telaio ha di solito 17 caratteri, lettere e numeri, mai I, O, Q (qui ${r.n}). Prima del 1981 poteva essere diverso.`; return; }
    const marca = A ? A.marca : "";
    const strano = r.costruttore && !stessaMarca(r.costruttore, marca);
    if (strano) p.classList.add("no");
    p.innerHTML = `Formato corretto${r.costruttore ? ` · costruttore: <b>${esc(r.costruttore.replace("/", " o "))}</b>` : ""}${r.paese ? ` · prodotta in ${esc(r.paese)}` : ""}.`
      + (strano ? ` <b>Attenzione:</b> l’auto è inserita come ${esc(marca)}, controlla che il telaio sia quello giusto.` : "") + " Solo i controlli qui sotto dicono se il telaio esiste davvero.";
  }

  /* apre la finestra. a = auto (o null per un controllo libero, che non salva niente) */
  function apri(a, o) {
    opz = Object.assign({}, o || {}, { libero: !a });
    A = a || { marca: "", targa: "", telaio: "" };
    const v = norm(A.verifiche);
    voci = v ? JSON.parse(JSON.stringify(v.voci)) : {};
    $("#vf-titolo").textContent = a ? "Verifica l’auto" : "Verifica un’auto";
    $("#vf-auto").textContent = a ? X.titolo(a) + (a.allestimento ? " · " + a.allestimento : "") + (a.anno ? " · " + a.anno : "") : "Per un’auto che stai valutando: non viene salvato niente.";
    $("#vf-targa").value = (o && o.targa != null ? o.targa : A.targa) || "";
    $("#vf-telaio").value = (o && o.telaio != null ? o.telaio : A.telaio) || "";
    $("#vf-salva").hidden = !a;
    $("#vf-chiudi").textContent = a ? "Annulla" : "Chiudi";
    const az = strumenti().storico;
    $("#vf-azienda").href = az.azienda; $("#vf-azienda-n").textContent = az.nome;
    disegna(); aggiornaVin();
    X.apri($("#d-verifica"));
  }

  /* ---------- fattura ---------- */
  const numIt = (n) => (n == null || !isFinite(n) ? "" : Math.round(n).toLocaleString("it-IT"));
  function datiFattura(a, prezzo, data) {
    const r = [];
    r.push("Auto: " + X.titolo(a) + (a.allestimento ? " " + a.allestimento : ""));
    const t = [a.anno ? "anno " + a.anno : "", a.km != null ? numIt(a.km) + " km" : "", a.alimentazione, a.cambio].filter(Boolean);
    if (t.length) r.push(t.join(" · "));
    if (a.targa) r.push("Targa: " + a.targa);
    if (a.telaio) r.push("Telaio: " + a.telaio);
    if (data) r.push("Data: " + fmtData(data));
    if (prezzo != null) r.push("Prezzo: " + numIt(prezzo) + " €");
    return r.join("\n");
  }
  function collegaFattura() {
    const f = strumenti().fatturazione;
    ["#b-fatture", "#v-fattura"].forEach((s) => { const a = $(s); if (a) a.href = f.url; });
    const n = $("#b-fatture"); if (n) n.title = "Fatture online con " + f.nome + " (si apre in una nuova scheda)";
    const i = $("#v-fattura-info"); if (i) i.href = f.info;
    document.querySelectorAll("[data-fatt-nome]").forEach((e) => (e.textContent = f.nome));
  }

  function init(ctx) {
    X = ctx;
    collegaFattura();
    const lista = $("#vf-lista");
    lista.addEventListener("click", async (e) => {
      const l = e.target.closest("a[data-copia]");
      if (l) {                                                   // il collegamento si apre da solo; qui si copia il dato
        const pref = l.dataset.copia, alt = pref === "telaio" ? "targa" : "telaio";
        const v = valore(pref) || valore(alt), nome = (valore(pref) ? pref : alt) === "telaio" ? "Telaio" : "Targa";
        if (!v) { X.toast("Scrivi prima la targa o il telaio qui sopra: li copio per te."); return; }
        const ok = await copia(v);
        X.toast(ok ? `${nome} ${v} copiato: incollalo nel sito.` : `Non riesco a copiare: scrivi ${v} a mano nel sito.`);
        return;
      }
      const b = e.target.closest("[data-s]"); if (!b) return;
      const k = b.closest(".vf-r").dataset.k, n = b.dataset.s;
      if (voci[k] && voci[k].s === n) delete voci[k];             // un secondo tocco toglie la scelta
      else voci[k] = { s: n, n: voci[k] ? voci[k].n : "", d: X.oggi() };
      disegna();
    });
    lista.addEventListener("input", (e) => {
      if (e.target.dataset.f !== "nota") return;
      const v = voci[e.target.closest(".vf-r").dataset.k]; if (v) v.n = e.target.value.slice(0, 200);
    });
    $("#vf-telaio").addEventListener("input", aggiornaVin);
    $("#vf-salva").onclick = () => {
      if (!A || opz.libero) return;
      const t = vin($("#vf-telaio").value);
      A.targa = valore("targa"); A.telaio = t.v;
      A.verifiche = norm({ voci });
      if (opz.dopo) opz.dopo(A);
      X.salva(); $("#d-verifica").close(); X.ridisegna();
      const r = riepilogo(A);
      X.toast(r.att ? `Salvato: ${r.att === 1 ? "una voce" : r.att + " voci"} da guardare.` : r.fatte ? "Verifica salvata." : "Dati dell’auto salvati.");
    };
    // fattura: dalla finestra «Segna come venduta»
    const fv = $("#form-v");
    $("#v-copia").onclick = async () => {
      const a = fv && X.S.auto.find((x) => x.id === fv.dataset.auto); if (!a) return;
      const p = X.numero(fv.prezzo_vendita.value), testo = datiFattura(a, p == null ? null : p, fv.data_vendita.value || X.oggi());
      X.toast((await copia(testo)) ? "Dati copiati: incollali nella fattura." : "Non riesco a copiare in questo browser.");
    };
  }
  GT.Verifica = { init, apri, norm, riepilogo, vin, datiFattura, ELENCO, strumenti, copia, stessaMarca, pulisciVin };
})();
