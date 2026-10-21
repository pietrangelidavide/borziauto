# Borzi Auto · sito vetrina + gestionale

Sito statico (HTML, CSS, JavaScript, nessuna build, nessun cookie) più un Worker di Cloudflare che fa due cose:
porta le **recensioni di Google** e, quando lo attivi, tiene l'**archivio online** del gestionale (auto, foto, contatti, storico vendite) usabile anche dal telefono.
Cloudflare pubblica la cartella `public/`. La grafica del sito è ispirata ai siti Apple: caratteri di sistema (SF su iPhone, iPad e Mac, Inter altrove), titoli grandi, barra traslucida, pulsanti a pillola, sezioni chiare e scure; tema chiaro/scuro che segue il sistema.

## Da compilare prima di andare online

**Tutti i dati dell'azienda stanno in un solo punto: l'oggetto `CONFIG` in cima a `public/js/sito.js`.** Quello che lasci vuoto non compare sul sito (nessun pulsante «Chiama» finto, nessun orario inventato). Oggi c'è solo il nome «Borzi Auto».

| Campo di `CONFIG` | Cosa mettere | Dove compare |
|---|---|---|
| `tel`, `telVisibile` | numero con prefisso (`+39…`) e come si legge | barra in alto, hero, scheda auto, Contatti |
| `whatsapp` | numero senza `+` e spazi | scheda auto, sezione Chi siamo |
| `email` | indirizzo email | scheda auto, Contatti |
| `indirizzo`, `cap`, `citta`, `provincia` | sede | Contatti (con Google Maps), piè di pagina, dati per Google |
| `piva`, `ragioneSociale` | solo cifre; nome legale | piè di pagina, dati per Google |
| `orari` | righe con giorni, nome e fasce (esempio commentato nel file) | Contatti (evidenzia il giorno di oggi) |
| `instagram`, `google`, `autoscout` | link completi | Contatti, vetrina |
| `mappa` | facoltativo: link a Google Maps | Contatti |

Altre cose da sistemare:
- **Dati legali**: ragione sociale esatta, sede legale e numero REA vanno nel piè di pagina (c'è un commento HTML in `index.html`).
- **Dominio**: quando c'è, aggiungi in `index.html` `og:url`, `og:image` (immagine 1200×630) e il link canonico, e la riga `Sitemap` in `robots.txt`.
- **Titolare**: nome, ruolo e fino a 2 foto si impostano dal gestionale (voce «Titolare»). Senza foto la sezione mostra solo le recensioni e i pulsanti disponibili.
- **Auto e recensioni di esempio**: `public/data/auto.json` (11 auto in vetrina, con le foto in `public/img/auto/`, più alcune vendute di esempio) e le schede di `public/data/recensioni.json` sono dati **di esempio**: modelli riconosciuti dalle foto, ma anno, chilometri, allestimento e prezzo sono inventati, e sul sito sono etichettati «Esempio». Il voto (5,0) e il numero di recensioni (364) vengono invece dal profilo Google e si aggiornano a mano in `recensioni.json` finché non si collega il Worker. Si sostituiscono con le auto vere dal gestionale e con le recensioni vere di Google.
- Il logo (`public/img/borzi-bianco.svg` e `borzi-nero.svg`) e le icone vengono dal progetto precedente; il rosso del marchio è `#e11d2e` (variabile `--accent` in `public/style.css`).

## Cosa c'è

| Percorso | Cosa fa |
|---|---|
| `public/index.html` | Il sito: vetrina auto, «Già vendute», recensioni Google, **Il nostro salone** (carosello di foto), servizi, contatti, orari |
| `public/js/salone.js` | Il carosello del salone: scorre da solo, si ferma al passaggio del mouse o fuori schermo, si comanda con frecce, pallini, tastiera e swipe; con «riduci animazioni» non parte da solo |
| `public/img/salone/` | Le foto del carosello, ognuna in due ritagli: `nome-w.jpg` (orizzontale 16:10, schermi larghi) e `nome-t.jpg` (verticale 4:5, telefono) |
| `public/style.css` | Tutto lo stile del sito (in cima i colori dei due temi) |
| `public/js/sito.js` | `CONFIG` con i dati dell'azienda, vetrina, filtri, scheda auto, recensioni, dati per Google |
| `public/gestionale/` | Pagina riservata (non linkata, `noindex`, esclusa da `robots.txt`): auto, foto, contatti/CRM, **Flotta**, **Stima del prezzo**, **Controlli prima della vendita** |
| `public/data/auto.json` | Le auto del sito quando l'archivio online non è attivo (ora: esempi) |
| `public/data/recensioni.json` | Recensioni di riserva (ora: solo esempi) |
| `src/worker.js` | Worker: `/api/recensioni`, `/api/auto`, `/api/admin/*`, `/foto/*` |
| `src/archivio.js` | Archivio online su Cloudflare D1: login con password, documenti, foto |
| `wrangler.jsonc` | Configurazione Cloudflare (cartella `public`, Worker, Place ID, database D1 da attivare) |

## Due modi di usare il gestionale

**Locale (così com'è ora).** Auto, foto e contatti restano nel browser di quel computer; per aggiornare il sito si scarica il pacchetto «Pubblica sul sito» e lo si carica su GitHub. Nessun server, nessuna password. Cancellare i dati del browser cancella tutto: fai ogni tanto un **Backup** (menu Esporta).

**Online (da attivare).** Auto, foto, contatti e storico stanno su un database Cloudflare dietro una password. Dal telefono o dal computer apri `/gestionale/`, entri, modifichi e scatti le foto dalla galleria; il sito si aggiorna da solo, senza GitHub. Funziona anche senza rete: le modifiche si accumulano e partono quando torna il collegamento.

### Attivare l'archivio online (3 passi, circa 10 minuti)

1. Cloudflare → **Storage & Databases › D1 › Create database**, nome `borziauto`. Copia il **Database ID**.
2. In `wrangler.jsonc` togli i `//` dal blocco `d1_databases` e incolla l'ID al posto di `INCOLLA-QUI-IL-DATABASE-ID`. Fai il push su GitHub.
3. Progetto `autoprofit-borziauto` → **Settings › Variables and Secrets** → aggiungi un **Secret** chiamato `GESTIONALE_PASSWORD` (almeno 10 caratteri; è l'unica password del gestionale). Rilancia il deploy.

Le tabelle si creano da sole alla prima richiesta: non serve scrivere SQL.

**Primo accesso: fallo dal computer che ha già le auto nel gestionale.** Al primo accesso quei dati salgono sul server; da quel momento sono su tutti i dispositivi. Le auto, i contatti e le vendite «di esempio» **non** vengono mai caricate. Sul telefono poi: apri `/gestionale/`, entra con la password, e «Aggiungi alla schermata Home» per averlo come un'app.

Come si comporta:
- Ogni modifica parte da sola dopo meno di un secondo; ogni 90 secondi e quando riapri la pagina il gestionale controlla se l'altro dispositivo ha cambiato qualcosa. L'etichetta in alto dice «Online · tutto salvato», «Modifiche da inviare» oppure «Offline».
- Se la stessa auto viene cambiata su due dispositivi nello stesso momento, **vince il dispositivo su cui stai lavorando** e compare un avviso. Se un dispositivo elimina un'auto e l'altro la modifica, l'auto resta.
- Le foto si ridimensionano sul dispositivo (max 1600 px, sotto 900 KB) e salgono sul server quando salvi l'auto.
- L'accesso dura 30 giorni su quel dispositivo; dopo 8 password sbagliate l'IP aspetta 15 minuti. **Esci** cancella dal dispositivo i dati locali (restano sul server).
- Le auto con i **controlli «in preparazione»** e tutti i campi riservati (targa, costo, prezzo di vendita, note, revisione, checklist) **non** escono mai nell'API pubblica `/api/auto`.
- Se vuoi un secondo livello, Cloudflare Access davanti a `/gestionale/*` si aggiunge senza toccare il codice.
- Controlla i limiti correnti di D1 (spazio e richieste) sul tuo piano.

## Cosa fa il gestionale

**Auto.** Aggiungi, modifica, «Venduta» (data e prezzo), «Rimetti in vendita», elimina. In cima le cifre della flotta (auto in vetrina e valore, giorni medi in stock, margine potenziale, trattative aperte, contatti da richiamare). Dal telefono l'elenco diventa una lista di schede e c'è il pulsante fisso «+ Aggiungi auto»; nelle foto compare anche «+ Scatta» (fotocamera).

**Controlli prima della vendita.** Quando salvi una **nuova** auto si apre una checklist (documenti, sicurezza e meccanica, elettronica e interni, carrozzeria, preparazione per la vendita). Per ogni voce: ok / da fare / non serve, con costo stimato e nota. Se una voce indispensabile è «da fare» l'auto va **in preparazione**: resta nascosta dal sito finché non segni i lavori come fatti. Si riapre da «Controlli» in riga.

**Stima del prezzo.** Dalla riga o dal modulo: «Stima il prezzo». Il sistema **non può leggere AutoScout24 da solo** (non offre un accesso per i prezzi, e copiare le pagine in automatico non è consentito), quindi parte da annunci che **incolli** o importi. Filtra per anno, toglie gli annunci anomali, corregge per i chilometri e propone un range per tre approcci (vendere in fretta, equilibrato, massimo margine), con costi, guadagno ipotetico e prezzo minimo per non perdere. L'affidabilità è «alta» da 12 annunci utili, «media» da 6; sotto i 6 è solo indicativa.

**Flotta.** Posti nel garage, giorni dall'acquisto alla vetrina e percentuale di riempimento desiderata: mostra la saturazione prevista nelle prossime 12 settimane, quante auto far entrare e uscire ogni settimana, le auto da spingere e i segmenti che rendono di più. Si basa sul **tuo storico** (auto vendute e import CSV/Excel dello storico vendite); i dati di esempio si tolgono con «Elimina i dati di esempio».

**Contatti (CRM).** Pipeline (Nuovo → Contattato → Appuntamento → Trattativa → Venduto / Perso) o elenco; telefono/WhatsApp/email in un tocco, auto di interesse, budget, richiamo, storico attività.

**Importa / Esporta.** CSV ed Excel per auto e contatti; modello Excel vuoto; Backup `.zip` con foto.

### Pubblicare in modo locale (senza archivio online)

1. **Pubblica sul sito → Scarica il pacchetto** (`borzi-auto-sito-<data>.zip` con `data/auto.json` e `img/auto/*.jpg`).
2. Su GitHub carica `data` e `img` dentro `public/` (i file si uniscono a quelli esistenti). Cloudflare ripubblica in un paio di minuti.

Dati riservati e auto in preparazione non sono mai nel pacchetto.

## Recensioni di Google

La sezione *Chi siamo* mostra voto, numero, fino a 5 recensioni e l'invito a recensire. Ora ci sono solo **esempi** etichettati. Per attivare le vere:

1. **Place ID**: [Place ID Finder](https://developers.google.com/maps/documentation/places/web-service/place-id) → cerca la scheda di Borzi Auto → copia l'ID (`ChIJ…`) in `wrangler.jsonc` → `"GOOGLE_PLACE_ID"`.
2. **Chiave API**: Google Cloud → progetto con fatturazione → attiva **Places API (New)** → chiave limitata a quella API, con avviso di budget.
3. **Segreto**: Cloudflare → *Variables and Secrets* → Secret `GOOGLE_PLACES_KEY`. (Mai nel repository.)
4. Apri `https://<dominio>/api/recensioni`: deve comparire `"fonte":"google"`.

Google restituisce al massimo 5 recensioni scelte da lui; voto e totale sono quelli reali. Il Worker ricorda la risposta `CACHE_ORE` ore (predefinito 6). Se non è configurato, il sito legge `public/data/recensioni.json` (copia solo recensioni vere e togli `"demo": true`).

## Pubblicare su Cloudflare

Il repository è già collegato al progetto `autoprofit-borziauto` (stesso `name` in `wrangler.jsonc`): ogni push su `main` ripubblica il sito. Per un progetto nuovo: Workers & Pages → Create → collega il repository, nessun comando di build, e usa lo stesso nome in `wrangler.jsonc`. Dominio: Settings → Domains & Routes.

## Provare in locale

`python3 -m http.server 8770 -d public` e apri `http://localhost:8770/`. Il gestionale è in `/gestionale/` (modo locale).

**Cosa non è stato provato:** l'archivio online (D1), le recensioni di Google e la mappa non sono stati collaudati su Cloudflare vero con i dati di Borzi Auto; l'aspetto del sito non è stato controllato a occhio dopo il rifacimento in stile Apple, solo con controlli automatici.

## Note tecniche

- Font Inter ospitato nel sito (`public/fonts`, licenza OFL), nessuna richiesta a terzi; le foto profilo delle recensioni arrivano dai server di Google, senza referrer.
- Excel: lettura/scrittura `.xlsx` con codice proprio sopra JSZip (`public/vendor/jszip.min.js`, licenza MIT); i vecchi `.xls` si salvano prima come `.xlsx`. CSV: riconosce `;` `,` tab, BOM e Windows-1252; l'esportazione usa `;` e BOM.
- Calcoli (stima, flotta, previsioni) in `public/gestionale/calcoli.js`, la logica di unione tra dispositivi in `unione.js`.
- Movimento ridotto (`prefers-reduced-motion`) rispettato; sezioni e schede navigabili da tastiera.

## Cambiare le foto del salone

Le foto del carosello sono le `<figure class="reel-slide">` dentro `<section id="salone">` in `public/index.html`: per ognuna servono due file in `public/img/salone/` (`nome-w.jpg` 1320×825 e `nome-t.jpg` 960×1200). Per aggiungerne una, copia una `<figure>` intera, cambia i nomi dei file, il testo `alt` e «N di M» in `aria-label`. Il carosello si adatta da solo al numero di foto (minimo 3).
