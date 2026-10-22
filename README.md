# Borzi Auto · sito vetrina + gestionale

Sito statico (HTML, CSS, JavaScript, nessuna build, nessun cookie) più un Worker di Cloudflare che fa due cose:
porta le **recensioni di Google** e, quando lo attivi, tiene l'**archivio online** del gestionale (auto, foto, contatti, storico vendite) usabile anche dal telefono.
Cloudflare pubblica la cartella `public/`. La grafica del sito è ispirata ai siti Apple: caratteri di sistema (SF su iPhone, iPad e Mac, Inter altrove), titoli grandi, barra traslucida, pulsanti a pillola, sezioni chiare e scure; tema chiaro/scuro che segue il sistema.

## Da compilare prima di andare online

**I dati del sito stanno in un solo punto: l'oggetto `CONFIG` in cima a `public/js/sito.js`** (il gestionale ha i suoi in `public/garage.json`, vedi sotto). Quello che lasci vuoto non compare sul sito (nessun pulsante «Chiama» finto, nessun orario inventato). Oggi ci sono nome, ragione sociale (BORZI AUTO SRLS), P.IVA, telefono, email (info@borziauto.com), Instagram (@borziauto), sede, orari, link Google, il titolare (Flavio Borzi) e le auto vendute (5.000).

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
| `titolare` | `nome` e `ruolo` (oggi «Flavio Borzi», «Titolare») | titolo della prima schermata, scheda del titolare, dati per Google |
| `venduteTotale` | numero di auto vendute (oggi 5000; `0` = il riquadro scompare) | contatore della prima schermata |

Altre cose da sistemare:
- **Dati legali**: ragione sociale e P.IVA sono già nel piè di pagina («© 2026 - Tutti i diritti riservati a BORZI AUTO SRLS - P.IVA 17496141007»); mancano sede legale e numero REA (c'è un commento HTML in `index.html`).
- **Privacy**: `public/privacy.html` è un **modello** (titolare, email, tempi di conservazione si leggono da `garage.json` → `privacy`). Finché `privacy.verificata` è `false` la pagina mostra l'avviso «Questo testo è un modello»: fallo controllare da un consulente e poi metti `true`.
- **Dominio**: quando c'è, aggiungi in `index.html` `og:url`, `og:image` (immagine 1200×630) e il link canonico, e la riga `Sitemap` in `robots.txt`.
- **Titolare**: nome e ruolo stanno in `CONFIG.titolare` (il gestionale, se collegato, può sovrascriverli). Le foto di Flavio sono solo nella prima schermata; la sezione recensioni resta senza foto.
- **Auto e recensioni di esempio**: `public/data/auto.json` (11 auto in vetrina, con le foto in `public/img/auto/`, più alcune vendute di esempio) e le schede di `public/data/recensioni.json` sono dati **di esempio**: modelli riconosciuti dalle foto, ma anno, chilometri, allestimento e prezzo sono inventati, e sul sito sono etichettati «Esempio». Il voto (5,0) e il numero di recensioni (364) vengono invece dal profilo Google e si aggiornano a mano in `recensioni.json` finché non si collega il Worker. Si sostituiscono con le auto vere dal gestionale e con le recensioni vere di Google.
- **Logo e colori**: il logo (`public/img/borzi-bianco.svg`, `borzi-nero.svg`, `logo-borzi-auto.svg/.png`, favicon e icone) è ridisegnato in vettoriale a partire dall'immagine del profilo (carattere Montserrat Italic e i due slash). La palette è quella del logo: nero, bianco e argento; **non c'è più nessun rosso**. I colori sono le variabili in cima a `public/style.css` (`--accent`, `--link`, `--star`…); nel gestionale stanno in `public/garage.json` (`tema`).
- **Dati dell'azienda in due posti**: il sito legge `CONFIG` (`public/js/sito.js`), il gestionale legge `public/garage.json`. Se cambi telefono, indirizzo o orari vanno aggiornati in entrambi.
- **Regole del gestionale (`garage.json` → `regole`)**: costi di vendita (300 €), costo giornaliero di stock (10 €) e margine minimo (1.500 €) sono valori **segnaposto**: vanno sostituiti con i numeri reali di Borzi Auto, perché alimentano la stima dei prezzi e la pagina Flotta.

## Cosa c'è

| Percorso | Cosa fa |
|---|---|
| `public/index.html` | Il sito: **prima schermata con Flavio Borzi**, vetrina auto, «Già vendute», recensioni Google, **Il nostro salone** (carosello di foto), servizi, contatti, orari |
| `public/js/hero.js` | Movimento e dati della prima schermata: contatore delle auto vendute, stelle, marche che scorrono, «Aperto ora» (orari letti da `CONFIG`, ora italiana), luce che segue il mouse, inclinazione delle foto, parallasse allo scroll. Con «riduci animazioni» non parte niente e la sezione è già nel suo stato finale |
| `public/img/flavio/` | Le due foto di Flavio (`flavio-1` appoggiato all'auto, `flavio-2` dal finestrino), ognuna in WebP e JPEG a 640 e 1100 px. Sono ingrandite con intelligenza artificiale da fotogrammi di un video a bassa risoluzione: i volti sono nitidi ma non è una foto da reflex |
| `public/js/salone.js` | Il carosello del salone: scorre da solo, si ferma al passaggio del mouse o fuori schermo, si comanda con frecce, pallini, tastiera e swipe; con «riduci animazioni» non parte da solo |
| `public/img/salone/` | Le foto del carosello, ognuna in due ritagli: `nome-w.jpg` (orizzontale 16:10, schermi larghi) e `nome-t.jpg` (verticale 4:5, telefono) |
| `public/style.css` | Tutto lo stile del sito (in cima i colori dei due temi) |
| `public/js/sito.js` | `CONFIG` con i dati dell'azienda, vetrina, filtri, scheda auto, recensioni, dati per Google |
| `public/gestionale/` | Pagina riservata (non linkata, `noindex`, esclusa da `robots.txt`): **Riepilogo**, **Aggiungi auto guidato**, auto, foto, contatti/CRM, **Visite**, **Flotta**, **Stima del prezzo**, **Controlli prima della vendita**. Stile in `gestionale.css` + `design.css`; `borzi.css` arrotonda gli angoli per allinearli al sito |
| `public/garage.json`, `public/js/ap-config.js` | Dati e tema del gestionale (nome, contatti, orari, colori, regole di calcolo, moduli attivi) |
| `public/js/catalogo.js`, `public/img/marche/` | Catalogo marche/modelli per la selezione guidata dell'auto e i loghi delle marche |
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

**Riepilogo.** È la prima pagina: mette in cima quello che serve per decidere oggi, cioè cosa fare ora, le cifre della flotta, come vanno le vendite, da quanto tempo le auto sono ferme, i prezzi rispetto al mercato, le trattative e le prossime visite. Legge solo i dati che il gestionale ha già.

**Aggiungi auto (procedura guidata).** Si parte dalle **foto** (anche scattate dal telefono), poi si sceglie la marca dal suo logo, il modello da un elenco, e anno, chilometri e motore con un tocco. Mentre si compila compaiono il **prezzo consigliato** (con i tre approcci: vendi in fretta, equilibrato, più margine, e il prezzo massimo da pagare per guadagnare il margine minimo) e l'anteprima di come l'auto apparirà sul sito. Il modulo resta quello di sempre: stessi campi e stesso salvataggio. Senza annunci incollati la stima è «di riferimento» (dal catalogo), non di mercato.

**Auto.** Aggiungi, modifica, «Venduta» (data e prezzo), «Rimetti in vendita», elimina. In cima le cifre della flotta (auto in vetrina e valore, giorni medi in stock, margine potenziale, trattative aperte, contatti da richiamare). Dal telefono l'elenco diventa una lista di schede e c'è il pulsante fisso «+ Aggiungi auto»; nelle foto compare anche «+ Scatta» (fotocamera).

**Controlli prima della vendita.** Quando salvi una **nuova** auto si apre una checklist (documenti, sicurezza e meccanica, elettronica e interni, carrozzeria, preparazione per la vendita). Per ogni voce: ok / da fare / non serve, con costo stimato e nota. Se una voce indispensabile è «da fare» l'auto va **in preparazione**: resta nascosta dal sito finché non segni i lavori come fatti. Si riapre da «Controlli» in riga.

**Stima del prezzo** (modulo `mercato.js`/`stima.js`, anche nel passo finale di «Aggiungi auto»). Dalla riga o dal modulo: «Stima il prezzo». Il sistema **non può leggere AutoScout24 da solo** (non offre un accesso per i prezzi, e copiare le pagine in automatico non è consentito), quindi parte da annunci che **incolli** o importi. Filtra per anno, toglie gli annunci anomali, corregge per i chilometri e propone un range per tre approcci (vendere in fretta, equilibrato, massimo margine), con costi, guadagno ipotetico e prezzo minimo per non perdere. L'affidabilità è «alta» da 12 annunci utili, «media» da 6; sotto i 6 è solo indicativa.

**Flotta.** Posti nel garage, giorni dall'acquisto alla vetrina e percentuale di riempimento desiderata: mostra la saturazione prevista nelle prossime 12 settimane, quante auto far entrare e uscire ogni settimana, le auto da spingere e i segmenti che rendono di più. Si basa sul **tuo storico** (auto vendute e import CSV/Excel dello storico vendite); i dati di esempio si tolgono con «Elimina i dati di esempio».

**Visite.** Agenda degli appuntamenti in sede, con richiamo ai clienti e orari delle visite modificabili. La **prenotazione dal sito è accesa** (`garage.json` → `moduli.visite: true`; `moduli.vendi: false` lascia spente le richieste di valutazione). Vedi «Prenotare una visita dal sito».

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

**Cosa non è stato provato:** l'archivio online (D1), il Worker aggiornato (visite, richieste, stima dal mercato), le recensioni di Google e la mappa non sono stati collaudati su Cloudflare vero con i dati di Borzi Auto, ma solo in locale con risposte simulate. Il sito e il gestionale sono stati provati con browser automatico (telefono, tablet, computer, tema chiaro e scuro, «riduci animazioni»); le animazioni vanno viste a occhio sul sito pubblicato.

## Note tecniche

- Font Inter ospitato nel sito (`public/fonts`, licenza OFL), nessuna richiesta a terzi; le foto profilo delle recensioni arrivano dai server di Google, senza referrer.
- Excel: lettura/scrittura `.xlsx` con codice proprio sopra JSZip (`public/vendor/jszip.min.js`, licenza MIT); i vecchi `.xls` si salvano prima come `.xlsx`. CSV: riconosce `;` `,` tab, BOM e Windows-1252; l'esportazione usa `;` e BOM.
- Calcoli (stima, flotta, previsioni) in `public/gestionale/calcoli.js`, la logica di unione tra dispositivi in `unione.js`.
- Movimento ridotto (`prefers-reduced-motion`) rispettato; sezioni e schede navigabili da tastiera.

## Cambiare le foto del salone

Le foto del carosello sono le `<figure class="reel-slide">` dentro `<section id="salone">` in `public/index.html`: per ognuna servono due file in `public/img/salone/` (`nome-w.jpg` 1320×825 e `nome-t.jpg` 960×1200). Per aggiungerne una, copia una `<figure>` intera, cambia i nomi dei file, il testo `alt` e «N di M» in `aria-label`. Il carosello si adatta da solo al numero di foto (minimo 3).

## Cambiare la prima schermata (Flavio Borzi)

- **Nome e numeri**: `CONFIG.titolare.nome` e `CONFIG.venduteTotale` in `public/js/sito.js`. Il voto e il numero di recensioni arrivano da `recensioni.json` (o da Google quando il Worker è attivo); le marche che scorrono in basso sono quelle delle auto in vetrina.
- **Foto**: sostituisci i file in `public/img/flavio/` (stessi nomi; larghezze 640 e 1100, `.webp` e `.jpg`) e, se cambi i rapporti, le proporzioni in `public/index.html` (`flavio-1` 3:4, `flavio-2` 5:4) e in `style.css` (`.fr-a`, `.fr-b`). Le foto sono tagliate a parallelogramma con l'inclinazione degli slash del logo (12°).
- **Frasi**: titolo e testo stanno in `public/index.html` dentro `<section id="hero">`.

## Prenotare una visita dal sito

Nel sito c'è la sezione **«Vieni a vedere l'auto di persona»** (menu «Prenota», pulsante in prima schermata e «Prenota una visita» nella scheda di ogni auto, che sceglie già quell'auto). Il cliente sceglie giorno e ora dal calendario, lascia nome e telefono (email e note facoltative), accetta la privacy e invia. Orari, durata (30 minuti), preavviso (3 ore) e giorni prenotabili (30) stanno in `garage.json` → `visite`; gli orari di partenza (lun–ven 10:00–19:00, sab 10:30–12:30) vanno controllati e poi si cambiano dal gestionale, scheda Visite.

Funziona in **due modi, scelti da soli**:

1. **Archivio online attivo** (database D1 e password, vedi «Attivare l'archivio online»): gli orari già presi spariscono dal calendario, la richiesta arriva nell'agenda del gestionale come «Da confermare» e il cliente riceve un codice per annullare. Il Worker ricontrolla tutto (orari, ferie, preavviso, privacy) e blocca i doppioni.
2. **Archivio non attivo (oggi)**: il calendario mostra gli orari delle visite ma **non può sapere quali sono già occupati**, e la richiesta non arriva al gestionale: il cliente preme «Invia su WhatsApp» e parte un messaggio già scritto verso il numero di `CONFIG.whatsapp`. La visita è confermata solo quando Flavio risponde.

Se `moduli.visite` è `false` la sezione, il menu e i pulsanti scompaiono. Il codice è in `public/js/prenota.js` (regole in `visite-core.js`, parte server in `src/visite.js`); la pagina `privacy.html` serve per il consenso.
