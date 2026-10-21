/* Borzi Auto · catalogo marche e modelli + stima di riferimento del prezzo.
   Serve a due cose:
     1. aiutare chi scrive (marche con il loro logo, modelli suggeriti, listino indicativo);
     2. dare SUBITO un prezzo di mercato, senza collegare portali e senza inserire annunci a mano.

   Come nasce il prezzo: prezzo di listino medio del modello × quanto vale un'auto di quell'età (curva di svalutazione) ×
   correzioni per marca, alimentazione, cambio e chilometri. Non legge nessun portale: è un MODELLO, non una rilevazione di annunci.
   Per questo viene sempre mostrato come «stima di riferimento», con un intervallo, e si affina in due modi:
     - con gli annunci veri incollati o importati dal titolare (almeno 6: sostituiscono il modello);
     - con le vendite già fatte dal garage (calibra() corregge il modello sul loro andamento reale).

   Dove sono presi i numeri (indicazioni pubbliche, non una banca dati acquistata):
     - curva di svalutazione: ordine di grandezza di Quattroruote Professional (≈ -30% nel primo anno di vita, ≈ metà del valore a 5 anni,
       -70/80% a 10 anni) e di SicurAuto, portata dal valore «nuovo» al prezzo di ANNUNCIO dell'usato presso un garage (più alto del valore di permuta),
       e controllata a mano su alcuni annunci pubblici (Fiat Panda, Toyota Yaris);
     - chilometri: -1,5% ogni 5.000 km sopra la media e +1% ogni 5.000 km sotto (regola riportata da SicurAuto);
     - listini: prezzi di listino medi indicativi dei modelli più diffusi in Italia, arrotondati: non sostituiscono il listino ufficiale.
   Funzioni pure e senza interfaccia: provate con _work/t_catalogo.mjs. */
(function (radice) {
  "use strict";
  const Cat = {};
  const norm = (s) => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9+]+/g, " ").trim();
  Cat.norm = norm;

  /* ---------- marche ----------
     id = nome del file del logo (img/marche/<id>.png), f = quanto una marca tiene il valore rispetto alla media (1 = media),
     base = listino medio se il modello non è in elenco (solo per marche senza modelli). */
  const M = [
    ["abarth", "Abarth", 1.0, ["abarth"], 24000], ["alfa-romeo", "Alfa Romeo", 0.93, ["alfa", "alfaromeo"]], ["alpine", "Alpine", 1.0, [], 70000],
    ["aston-martin", "Aston Martin", 0.85, ["aston"], 160000], ["audi", "Audi", 0.99, []], ["bentley", "Bentley", 0.85, [], 220000], ["bmw", "BMW", 0.98, []],
    ["byd", "BYD", 0.88, []], ["chevrolet", "Chevrolet", 0.88, []], ["citroen", "Citroën", 0.94, ["citroen"]], ["cupra", "Cupra", 1.0, []], ["dacia", "Dacia", 1.03, []],
    ["ds", "DS", 0.85, ["ds automobiles"]], ["ferrari", "Ferrari", 1.1, [], 260000], ["fiat", "Fiat", 0.97, []], ["ford", "Ford", 0.96, []], ["honda", "Honda", 1.0, []],
    ["hyundai", "Hyundai", 0.99, []], ["infiniti", "Infiniti", 0.8, [], 45000], ["jaguar", "Jaguar", 0.85, []], ["jeep", "Jeep", 0.98, []], ["kia", "Kia", 1.0, []],
    ["lamborghini", "Lamborghini", 1.05, ["lambo"], 250000], ["lancia", "Lancia", 0.97, []], ["land-rover", "Land Rover", 0.93, ["landrover", "range rover"]],
    ["lexus", "Lexus", 1.0, []], ["lotus", "Lotus", 0.95, [], 80000], ["maserati", "Maserati", 0.78, []], ["mazda", "Mazda", 1.02, []], ["mclaren", "McLaren", 0.9, [], 230000],
    ["mercedes-benz", "Mercedes-Benz", 0.98, ["mercedes", "mb"]], ["mg", "MG", 0.9, ["mg motor"]], ["mini", "Mini", 1.02, []], ["mitsubishi", "Mitsubishi", 0.95, []],
    ["nissan", "Nissan", 0.95, []], ["opel", "Opel", 0.94, []], ["peugeot", "Peugeot", 0.96, []], ["polestar", "Polestar", 0.85, []], ["porsche", "Porsche", 1.08, []],
    ["renault", "Renault", 0.95, []], ["seat", "Seat", 0.98, []], ["skoda", "Škoda", 1.02, ["skoda"]], ["smart", "Smart", 0.93, []], ["subaru", "Subaru", 0.98, []],
    ["suzuki", "Suzuki", 1.04, []], ["tesla", "Tesla", 0.92, []], ["toyota", "Toyota", 1.08, []], ["volkswagen", "Volkswagen", 1.0, ["vw", "wolkswagen"]], ["volvo", "Volvo", 0.97, []],
  ].map(([id, nome, f, alias, base]) => ({ id, nome, f, alias: alias.concat([norm(nome)]), base: base || null }));
  Cat.MARCHE = M;
  const perId = {}; M.forEach((m) => { perId[m.id] = m; });

  /* ---------- modelli: [nome, listino medio €, segmento, tenuta] ----------
     segmento: A citycar · B utilitaria · C compatta · D berlina grande · S suv/crossover · L lusso/sportiva
     tenuta (facoltativa): >1 se il modello tiene il valore più della sua marca (Panda, Yaris…), <1 se meno. */
  const MOD = {
    "fiat": [["Panda", 15500, "A", 1.1], ["500", 18500, "A", 1.03], ["Tipo", 21000, "C"], ["500X", 27000, "S"], ["500L", 24000, "B", 0.95], ["Panda Cross", 19000, "A", 1.08], ["Punto", 16000, "B", 0.95], ["Grande Panda", 18500, "A"], ["600", 26000, "S"], ["Qubo", 20000, "B", 0.95], ["Doblò", 25000, "B"], ["Freemont", 30000, "S", 0.8]],
    "lancia": [["Ypsilon", 17500, "B", 1.03], ["Delta", 24000, "C", 0.9], ["Musa", 17000, "B", 0.9]],
    "alfa-romeo": [["Giulietta", 29000, "C"], ["MiTo", 20000, "B"], ["Giulia", 46000, "D"], ["Stelvio", 49000, "S"], ["Tonale", 40000, "S"], ["Junior", 27000, "S"], ["159", 30000, "D", 0.8], ["4C", 65000, "L"]],
    "jeep": [["Renegade", 27500, "S"], ["Compass", 34000, "S"], ["Avenger", 26000, "S"], ["Wrangler", 60000, "S", 1.1], ["Grand Cherokee", 70000, "S", 0.9], ["Cherokee", 42000, "S", 0.9]],
    "renault": [["Clio", 18500, "B"], ["Captur", 24500, "S"], ["Megane", 27000, "C"], ["Twingo", 15500, "A"], ["Scenic", 28000, "C", 0.92], ["Kadjar", 28000, "S"], ["Arkana", 29000, "S"], ["Austral", 35000, "S"], ["Zoe", 26000, "B", 0.9], ["Kangoo", 24000, "B"], ["Espace", 45000, "D", 0.85], ["Talisman", 38000, "D", 0.85]],
    "peugeot": [["208", 20000, "B"], ["2008", 28000, "S"], ["308", 28000, "C"], ["3008", 37000, "S"], ["108", 14000, "A"], ["5008", 40000, "S"], ["508", 42000, "D", 0.92], ["207", 15000, "B"], ["Rifter", 28000, "B"]],
    "citroen": [["C3", 17500, "B"], ["C3 Aircross", 24000, "S"], ["C4", 26000, "C"], ["C1", 14000, "A"], ["Berlingo", 26000, "B"], ["C5 Aircross", 35000, "S"], ["C4 Cactus", 22000, "S"], ["C4 Picasso", 28000, "C", 0.9], ["DS3", 20000, "B"]],
    "ford": [["Fiesta", 18500, "B"], ["Focus", 26000, "C"], ["Puma", 25000, "S"], ["Kuga", 38000, "S"], ["EcoSport", 22000, "S", 0.95], ["Ka+", 13000, "A"], ["Mondeo", 33000, "D", 0.88], ["C-Max", 27000, "C", 0.9], ["Mustang", 60000, "L", 1.1], ["Tourneo Courier", 22000, "B"], ["Fiesta Active", 21000, "B"]],
    "toyota": [["Yaris", 19500, "B", 1.12], ["Aygo", 14500, "A", 1.05], ["C-HR", 32000, "S", 1.05], ["Corolla", 28000, "C", 1.03], ["RAV4", 42000, "S", 1.05], ["Yaris Cross", 28000, "S", 1.05], ["Auris", 22000, "C", 1.05], ["Prius", 32000, "C"], ["Land Cruiser", 60000, "S", 1.1], ["Aygo X", 18000, "A", 1.03], ["Avensis", 28000, "D", 0.9], ["GT86", 34000, "L"]],
    "opel": [["Corsa", 18500, "B"], ["Astra", 27000, "C"], ["Mokka", 28000, "S"], ["Crossland", 24000, "S"], ["Grandland", 33000, "S"], ["Adam", 15000, "A"], ["Karl", 12000, "A"], ["Insignia", 38000, "D", 0.88], ["Meriva", 20000, "B", 0.9], ["Zafira", 29000, "C", 0.9]],
    "dacia": [["Sandero", 14000, "B", 1.02], ["Duster", 20000, "S", 1.05], ["Logan", 14000, "B"], ["Jogger", 20000, "B"], ["Spring", 22000, "A", 0.85], ["Lodgy", 15000, "B"]],
    "volkswagen": [["Polo", 22000, "B"], ["Golf", 31500, "C"], ["T-Roc", 33000, "S"], ["Tiguan", 39000, "S"], ["Passat", 38000, "D", 0.95], ["Up", 14000, "A"], ["Taigo", 26000, "S"], ["T-Cross", 25000, "S"], ["Touran", 34000, "C", 0.95], ["Arteon", 50000, "D", 0.9], ["ID.3", 40000, "C", 0.9], ["ID.4", 48000, "S", 0.9], ["Touareg", 70000, "S"], ["Caddy", 28000, "B"], ["Beetle", 25000, "B"]],
    "skoda": [["Octavia", 30000, "C"], ["Fabia", 19000, "B"], ["Kamiq", 25000, "S"], ["Karoq", 33000, "S"], ["Kodiaq", 42000, "S"], ["Superb", 42000, "D"], ["Scala", 24000, "C"], ["Yeti", 25000, "S"], ["Rapid", 20000, "C"]],
    "seat": [["Leon", 25500, "C"], ["Ibiza", 19500, "B"], ["Arona", 24000, "S"], ["Ateca", 31000, "S"], ["Tarraco", 40000, "S"], ["Mii", 13000, "A"], ["Alhambra", 38000, "C", 0.9]],
    "hyundai": [["i20", 18500, "B"], ["i10", 14500, "A"], ["i30", 26000, "C"], ["Tucson", 36000, "S"], ["Kona", 28000, "S"], ["Bayon", 22000, "S"], ["ix20", 19000, "B"], ["Santa Fe", 50000, "S"], ["ix35", 28000, "S"]],
    "kia": [["Sportage", 34000, "S"], ["Ceed", 25000, "C"], ["Picanto", 15000, "A"], ["Stonic", 22000, "S"], ["Niro", 33000, "S"], ["Sorento", 52000, "S"], ["Rio", 18000, "B"], ["XCeed", 29000, "S"], ["Soul", 24000, "S", 0.9], ["EV6", 52000, "S", 0.88]],
    "nissan": [["Qashqai", 31000, "S"], ["Juke", 24000, "S"], ["Micra", 18000, "B"], ["X-Trail", 38000, "S"], ["Leaf", 36000, "C", 0.85], ["Note", 18000, "B", 0.9], ["Pulsar", 22000, "C", 0.9]],
    "mazda": [["CX-5", 34000, "S"], ["Mazda3", 27000, "C"], ["CX-30", 30000, "S"], ["Mazda2", 19000, "B"], ["MX-5", 32000, "L", 1.1], ["Mazda6", 36000, "D", 0.9], ["CX-3", 25000, "S"]],
    "volvo": [["XC40", 41000, "S"], ["XC60", 56000, "S"], ["XC90", 78000, "S"], ["V40", 28000, "C", 0.92], ["V60", 45000, "D"], ["S60", 45000, "D"], ["V90", 60000, "D"], ["S90", 62000, "D"], ["C40", 52000, "S", 0.9]],
    "tesla": [["Model 3", 46000, "D"], ["Model Y", 52000, "S"], ["Model S", 100000, "L", 0.85], ["Model X", 110000, "L", 0.85]],
    "bmw": [["Serie 1", 36500, "C"], ["Serie 2", 36000, "C"], ["Serie 3", 46000, "D"], ["Serie 4", 55000, "D"], ["Serie 5", 62000, "D"], ["X1", 41000, "S"], ["X2", 45000, "S"], ["X3", 55000, "S"], ["X4", 62000, "S"], ["X5", 85000, "S"], ["X6", 95000, "S"], ["Z4", 55000, "L"], ["i3", 38000, "B", 0.85], ["Serie 7", 110000, "L", 0.8], ["Serie 6", 90000, "L", 0.8], ["M3", 90000, "L", 1.05]],
    "audi": [["A1", 25000, "B"], ["A3", 33000, "C"], ["A4", 46000, "D"], ["A4 Avant", 47000, "D"], ["A5", 55000, "D"], ["A6", 62000, "D"], ["Q2", 31000, "S"], ["Q3", 41000, "S"], ["Q5", 52000, "S"], ["Q7", 80000, "S"], ["TT", 50000, "L"], ["A7", 75000, "D", 0.9], ["Q8", 95000, "S"], ["e-tron", 80000, "S", 0.8]],
    "mercedes-benz": [["Classe A", 35000, "C"], ["Classe B", 38000, "C"], ["Classe C", 52000, "D"], ["Classe E", 66000, "D"], ["CLA", 42000, "D"], ["GLA", 41000, "S"], ["GLB", 48000, "S"], ["GLC", 62000, "S"], ["GLE", 90000, "S"], ["Classe S", 120000, "L", 0.8], ["GLK", 45000, "S"], ["Classe V", 70000, "D"], ["CLS", 85000, "L", 0.85], ["SLK", 55000, "L"], ["EQC", 80000, "S", 0.8]],
    "mini": [["Cooper", 28000, "B"], ["Countryman", 31000, "S"], ["Clubman", 29000, "C"], ["Cabrio", 30000, "B"], ["One", 21000, "B"], ["Paceman", 30000, "S", 0.9]],
    "smart": [["Fortwo", 15500, "A"], ["Forfour", 18500, "A"], ["EQ Fortwo", 24000, "A", 0.85]],
    "suzuki": [["Swift", 19000, "B"], ["Vitara", 28000, "S"], ["Ignis", 16000, "A"], ["S-Cross", 28000, "S"], ["Jimny", 26000, "S", 1.2], ["Baleno", 18000, "B"], ["SX4", 24000, "S"]],
    "honda": [["Civic", 30000, "C"], ["Jazz", 23000, "B"], ["CR-V", 42000, "S"], ["HR-V", 32000, "S"], ["e", 36000, "A", 0.8]],
    "mitsubishi": [["ASX", 27000, "S"], ["Space Star", 15000, "A"], ["Outlander", 42000, "S", 0.92], ["Eclipse Cross", 34000, "S"], ["L200", 38000, "S"]],
    "subaru": [["Forester", 38000, "S"], ["XV", 30000, "S"], ["Impreza", 26000, "C"], ["Outback", 46000, "S"]],
    "lexus": [["UX", 40000, "S"], ["NX", 52000, "S"], ["CT", 32000, "C"], ["RX", 80000, "S"], ["IS", 48000, "D"], ["ES", 55000, "D"]],
    "land-rover": [["Evoque", 48000, "S"], ["Discovery Sport", 52000, "S"], ["Range Rover Sport", 100000, "S"], ["Defender", 70000, "S", 1.1], ["Velar", 70000, "S"], ["Discovery", 70000, "S"], ["Freelander", 38000, "S", 0.9], ["Range Rover", 125000, "L", 0.9]],
    "jaguar": [["XE", 40000, "D"], ["XF", 52000, "D"], ["F-Pace", 62000, "S"], ["E-Pace", 40000, "S"], ["F-Type", 85000, "L"], ["I-Pace", 85000, "S", 0.8]],
    "porsche": [["Macan", 70000, "S"], ["Cayenne", 100000, "S"], ["911", 130000, "L", 1.05], ["Panamera", 120000, "L", 0.9], ["718 Cayman", 70000, "L"], ["718 Boxster", 70000, "L"], ["Taycan", 110000, "L", 0.85]],
    "maserati": [["Ghibli", 80000, "L"], ["Levante", 90000, "L"], ["Grecale", 80000, "L"], ["Quattroporte", 130000, "L", 0.85], ["GranTurismo", 140000, "L"]],
    "cupra": [["Formentor", 38000, "S"], ["Born", 40000, "C", 0.9], ["Leon", 33000, "C"], ["Ateca", 36000, "S"]],
    "abarth": [["595", 24000, "A"], ["500", 22000, "A"], ["124 Spider", 40000, "L"]],
    "ds": [["DS 3", 28000, "B"], ["DS 3 Crossback", 30000, "S"], ["DS 7 Crossback", 45000, "S"], ["DS 4", 33000, "C"], ["DS 5", 36000, "D", 0.85]],
    "mg": [["ZS", 25000, "S"], ["MG3", 20000, "B"], ["MG4", 33000, "C"], ["HS", 32000, "S"], ["Marvel R", 45000, "S", 0.85]],
    "byd": [["Dolphin", 35000, "B"], ["Atto 3", 40000, "S"], ["Seal", 48000, "D"], ["Han", 70000, "D"]],
    "polestar": [["Polestar 2", 55000, "D"], ["Polestar 3", 85000, "S"]],
    "chevrolet": [["Spark", 12000, "A"], ["Aveo", 14000, "B"], ["Cruze", 20000, "C"], ["Captiva", 28000, "S"], ["Matiz", 10000, "A"]],
    "alpine": [["A110", 70000, "L"]],
  };
  const MODELLI = {};
  Object.keys(MOD).forEach((id) => { MODELLI[id] = MOD[id].map(([nome, listino, seg, tenuta]) => ({ nome, listino, seg, tenuta: tenuta || 1, n: norm(nome) })); });
  Cat.MODELLI = MODELLI;

  /* ---------- ricerca di marche e modelli ---------- */
  const mappaMarche = {}; M.forEach((m) => { mappaMarche[norm(m.nome)] = m; mappaMarche[m.id.replace(/-/g, " ")] = m; m.alias.forEach((a) => { mappaMarche[norm(a)] = m; }); });
  /* marca dal testo scritto: nome esatto, alias o inizio univoco ("merc" → Mercedes-Benz) */
  Cat.marca = function (testo) {
    const t = norm(testo); if (!t) return null;
    if (mappaMarche[t]) return mappaMarche[t];
    if (t.length >= 3) { const c = M.filter((m) => norm(m.nome).startsWith(t) || m.alias.some((a) => norm(a).startsWith(t))); if (c.length === 1) return c[0]; }
    return null;
  };
  Cat.suggerisciMarche = function (testo, max) {
    const t = norm(testo), cima = [];
    if (!t) return M.slice(0, max || M.length);
    M.forEach((m) => { const n = norm(m.nome); const p = n.startsWith(t) ? 0 : m.alias.some((a) => norm(a).startsWith(t)) ? 1 : n.includes(t) ? 2 : -1; if (p >= 0) cima.push([p, m]); });
    return cima.sort((a, b) => a[0] - b[0]).map((x) => x[1]).slice(0, max || 12);
  };
  Cat.modelli = (marca) => { const m = typeof marca === "string" ? Cat.marca(marca) : marca; return m ? (MODELLI[m.id] || []) : []; };
  Cat.suggerisciModelli = function (marca, testo, max) {
    const t = norm(testo), tutti = Cat.modelli(marca);
    if (!t) return tutti.slice(0, max || 12);
    return tutti.map((x) => [x.n.startsWith(t) ? 0 : x.n.includes(t) ? 1 : -1, x]).filter((x) => x[0] >= 0).sort((a, b) => a[0] - b[0]).map((x) => x[1]).slice(0, max || 12);
  };
  /* modello più vicino a quello scritto: esatto; poi «a4 avant» → «a4»; null se non c'è */
  Cat.modello = function (marca, testo) {
    const t = norm(testo), tutti = Cat.modelli(marca); if (!t || !tutti.length) return null;
    const esatto = tutti.find((x) => x.n === t); if (esatto) return esatto;
    const vicino = tutti.filter((x) => t.startsWith(x.n + " ") || x.n.startsWith(t + " ")).sort((a, b) => b.n.length - a.n.length)[0];
    return vicino || null;
  };
  /* logo: nella demo i loghi sono incorporati (AP_LOGHI_DATA), altrimenti il file in img/marche/ */
  Cat.logo = function (marca, rad) {
    const m = typeof marca === "string" ? Cat.marca(marca) : marca; if (!m) return "";
    const g = typeof window !== "undefined" ? window : radice;
    if (g.AP_LOGHI_DATA && g.AP_LOGHI_DATA[m.id]) return g.AP_LOGHI_DATA[m.id];
    return (rad == null ? "" : rad) + "img/marche/" + m.id + ".png";
  };

  /* ---------- listino ---------- */
  Cat.listino = function (marca, modello) {
    const m = typeof marca === "string" ? Cat.marca(marca) : marca;
    const mo = m ? Cat.modello(m, modello) : null;
    if (mo) return { valore: mo.listino, seg: mo.seg, tenuta: mo.tenuta, noto: true, modello: mo.nome };
    const lista = m ? (MODELLI[m.id] || []) : [];
    if (lista.length) return { valore: Math.round(lista.reduce((t, x) => t + x.listino, 0) / lista.length / 500) * 500, seg: "C", tenuta: 1, noto: false, modello: "" };
    if (m && m.base) return { valore: m.base, seg: "L", tenuta: 1, noto: false, modello: "" };
    return { valore: 20000, seg: "C", tenuta: 1, noto: false, modello: "" };
  };

  /* ---------- curva di svalutazione ----------
     residuo del prezzo di annuncio sul listino, per anni di età (0 = nuova/km 0). Tra un punto e l'altro si interpola. */
  const CURVA = [[0, 0.9], [1, 0.85], [2, 0.8], [3, 0.74], [4, 0.68], [5, 0.62], [6, 0.57], [7, 0.52], [8, 0.47], [9, 0.42], [10, 0.38], [12, 0.3], [15, 0.22], [20, 0.14], [30, 0.1]];
  Cat.CURVA = CURVA;
  Cat.residuo = function (eta) {
    if (eta <= 0) return CURVA[0][1];
    for (let i = 1; i < CURVA.length; i++) if (eta <= CURVA[i][0]) { const [x0, y0] = CURVA[i - 1], [x1, y1] = CURVA[i]; return y0 + ((y1 - y0) * (eta - x0)) / (x1 - x0); }
    return CURVA[CURVA.length - 1][1];
  };
  /* km medi all'anno per alimentazione (serve a capire se l'auto ha più o meno km del normale) */
  const KM_ANNO = { benzina: 10500, diesel: 16000, ibrida: 12000, "plug-in": 10000, gpl: 14000, metano: 14000, elettrica: 10000 };
  const ALIM = { benzina: "benzina", diesel: "diesel", gasolio: "diesel", ibrida: "ibrida", hybrid: "ibrida", "ibrida benzina": "ibrida", "ibrida diesel": "ibrida", "mild hybrid": "ibrida", "plug in": "plug-in", "plug-in": "plug-in", phev: "plug-in",
    gpl: "gpl", "benzina gpl": "gpl", metano: "metano", "benzina metano": "metano", elettrica: "elettrica", elettrico: "elettrica", ev: "elettrica" };
  Cat.alimentazione = (t) => { const n = norm(t); if (!n) return ""; if (ALIM[n]) return ALIM[n]; if (/elettric/.test(n)) return "elettrica"; if (/plug|phev/.test(n)) return "plug-in"; if (/ibrid|hybrid/.test(n)) return "ibrida"; if (/diesel|gasolio|tdi|cdi|hdi|dci|jtd|mjt/.test(n)) return "diesel"; if (/gpl|lpg/.test(n)) return "gpl"; if (/metano|cng/.test(n)) return "metano"; if (/benzina|tsi|tfsi|gasolina/.test(n)) return "benzina"; return ""; };

  const fattoreAlim = (alim, seg, eta) => {
    switch (alim) {
      case "diesel": return { A: 0.93, B: 0.95, C: 0.98, S: 1.02, D: 1.02, L: 1 }[seg] || 0.98;
      case "ibrida": return 1.06;
      case "plug-in": return 1.0;
      case "gpl": return 0.97;
      case "metano": return 0.92;
      case "elettrica": return ({ A: 1.38, B: 1.3, C: 1.1 }[seg] || 1) * Math.max(0.72, 1 - 0.05 * eta);
      default: return 1;
    }
  };
  const limita = (x, a, b) => Math.max(a, Math.min(b, x));

  /* età in anni (con decimali) di un'auto immatricolata nell'anno indicato; si assume metà anno. */
  const oggiDecimale = (oggi) => { const d = oggi instanceof Date ? oggi : oggi ? new Date(String(oggi).length <= 10 ? oggi + "T12:00:00" : oggi) : new Date(); const dd = isNaN(d) ? new Date() : d; return dd.getFullYear() + dd.getMonth() / 12 + (dd.getDate() - 1) / 365; };
  Cat.eta = (anno, oggi) => Math.max(0.1, oggiDecimale(oggi) - (anno + 0.5));

  /* ---------- il valore ---------- */
  /* auto: { marca, modello, anno, km, alimentazione, cambio }; opz: { oggi, calibrazione } → { valore, listino, eta, sigma, noto, fattori{…}, note[] } */
  Cat.valore = function (auto, opz) {
    const o = opz || {}, a = auto || {}, anno = a.anno != null ? Math.round(+a.anno) : null;
    if (!anno || anno < 1960 || anno > 2100) return null;
    const m = Cat.marca(a.marca), lis = Cat.listino(m || a.marca, a.modello), eta = Cat.eta(anno, o.oggi), alim = Cat.alimentazione(a.alimentazione);
    const note = [];
    const curva = Cat.residuo(eta), marca = m ? m.f : 1, tenuta = lis.tenuta || 1;
    const falim = fattoreAlim(alim, lis.seg, eta);
    const aut = /autom|dsg|cvt|robot|tiptronic|s tronic|dct|edc/i.test(String(a.cambio || ""));
    const fcambio = aut ? (["C", "D", "S", "L"].includes(lis.seg) ? 1.03 : 1.01) : 1;
    // chilometri: confronto con quelli attesi per età e alimentazione
    let fkm = 1, kmAtteso = null;
    const km = a.km != null && a.km !== "" ? +a.km : null;
    if (km != null && isFinite(km) && km >= 0) {
      kmAtteso = Math.round((KM_ANNO[alim] || 12000) * Math.max(eta, 0.25) / 500) * 500;
      const delta = (km - kmAtteso) / 5000;
      fkm = 1 + limita(delta > 0 ? -0.015 * delta : -0.01 * delta, -0.35, 0.15);
      if (eta > 12) fkm = 1 + (fkm - 1) * 0.6;                         // sulle auto molto vecchie i chilometri contano meno
    } else note.push("Senza i chilometri uso quelli normali per l’età.");
    const cal = o.calibrazione && o.calibrazione.fattore ? o.calibrazione.fattore : 1;
    const grezzo = lis.valore * curva * marca * tenuta * falim * fcambio * fkm * cal;
    const valore = Math.max(500, Math.round(grezzo / 100) * 100);
    const sigma = limita((lis.noto ? 0.1 : 0.14) + 0.004 * Math.max(0, eta - 6), 0.1, 0.19);
    if (!lis.noto) note.push(m ? "Modello fuori elenco: parto dalla media della marca, la stima è più incerta." : "Marca fuori elenco: la stima è molto incerta.");
    if (eta > 20) note.push("Auto molto vecchia o d’epoca: il prezzo può discostarsi molto.");
    return { valore, listino: lis.valore, eta, sigma, noto: lis.noto, modelloNome: lis.modello, marcaNota: !!m, kmAtteso, alimentazione: alim, calibrata: cal !== 1, fattori: { curva, marca, tenuta, alimentazione: falim, cambio: fcambio, km: fkm, calibrazione: cal }, note };
  };

  /* ---------- distribuzione ---------- */
  // inversa della normale standard (approssimazione di Acklam) e funzione di ripartizione (Abramowitz-Stegun)
  const zDi = (p) => {
    p = limita(p, 1e-6, 1 - 1e-6);
    const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
    const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
    const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    if (p < 0.02425) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - 0.02425) { const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    const q = p - 0.5, r = q * q;
    return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  };
  const fi = (z) => { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp((-z * z) / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; };
  Cat.z = zDi; Cat.fi = fi;

  /* Oggetto nello stesso formato di Calc().stimaMercato, così piano() e pagare() funzionano senza cambiare:
     prezzoA(q) = prezzo al quantile q; quotaPiuCari(p) = quota di auto simili più care di p. */
  Cat.mercato = function (auto, opz) {
    const v = Cat.valore(auto, opz); if (!v) return null;
    const med = v.valore, sg = v.sigma, pa = (q) => Math.round((med * Math.exp(sg * zDi(q))) / 100) * 100;
    const stat = { n: 0, min: pa(0.05), p10: pa(0.1), p25: pa(0.25), mediana: med, p75: pa(0.75), p90: pa(0.9), max: pa(0.95), media: Math.round(med * Math.exp((sg * sg) / 2)) };
    return {
      n: 0, totali: 0, tolleranza: 0, pendenza: 0, affidabilita: "indicativa", note: v.note.slice(), stat, comps: [], modello: true, dettaglio: v,
      prezzoA: (q) => pa(q),
      quotaPiuCari: (p) => (p > 0 ? 1 - fi(Math.log(p / med) / sg) : 1),
    };
  };

  /* ---------- affinare la stima con le vendite del garage ----------
     storia: auto vendute (marca, modello, anno, km, alimentazione, data_vendita, prezzo_vendita). Per ognuna si confronta il prezzo di vendita
     con quello che il modello avrebbe dato alla data della vendita (tolta la trattativa). Con almeno 3 vendite si corregge il modello
     di una parte della differenza media: più vendite ci sono, più pesa il garage. Mai oltre -25% / +30%. */
  Cat.calibra = function (storia, opz) {
    const o = opz || {}, tr = o.trattativa == null ? 0.03 : o.trattativa, oggi = o.oggi ? new Date(String(o.oggi).slice(0, 10) + "T12:00:00") : new Date(), rapporti = [];
    (storia || []).forEach((r) => {
      if (!r || !r.anno || !r.marca || !(+r.prezzo_vendita >= 500) || !r.data_vendita) return;
      const dv = new Date(String(r.data_vendita).slice(0, 10) + "T12:00:00"); if (isNaN(dv) || oggi - dv > 3 * 365.25 * 86400000 || dv > oggi) return;
      const v = Cat.valore({ marca: r.marca, modello: r.modello, anno: +r.anno, km: r.km, alimentazione: r.alimentazione, cambio: r.cambio }, { oggi: dv });
      if (v) rapporti.push(+r.prezzo_vendita / (v.valore * (1 - tr)));
    });
    const n = rapporti.length;
    if (n < 3) return { fattore: 1, n, attiva: false };
    rapporti.sort((a, b) => a - b);
    const med = n % 2 ? rapporti[(n - 1) / 2] : (rapporti[n / 2 - 1] + rapporti[n / 2]) / 2, peso = n / (n + 6);
    return { fattore: limita(1 + (med - 1) * peso, 0.75, 1.3), n, mediana: med, peso, attiva: true };
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Cat;
  else { const AP = (radice.AP = radice.AP || {}); AP.Catalogo = Cat; }
})(typeof window !== "undefined" ? window : globalThis);
