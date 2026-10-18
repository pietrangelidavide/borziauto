# AutoProfit · Borzi Auto

Versione di AutoProfit per Borzi Auto: sito con le auto in vetrina e prenotazione delle visite, gestionale per auto, contatti, agenda, stima del prezzo e «quanto pagare».
Tutto ciò che cambia da un garage all'altro sta in **public/garage.json** (nome, contatti, orari, colori, caratteri, regole di calcolo, privacy) e nella cartella **public/img** (marchio).

## Cosa c'è
- `public/` il sito (`index.html`), il gestionale (`gestionale/`), l'informativa (`privacy.html`) e la configurazione.
- `src/` il piccolo servizio Cloudflare (Worker) per archivio online, prenotazioni e prezzi di mercato.
- `wrangler.jsonc` la configurazione di Cloudflare, con il nome del progetto `autoprofit-borziauto` (nuovo: non tocca i siti già online).

## Da completare prima di andare online
- Telefono, email, indirizzo, città, P.IVA e ragione sociale: nel file sono vuoti, finché mancano il sito li nasconde.
- Orari di apertura veri (orari): quelli nel file sono di esempio e comandano il calendario delle visite.
- Link utili (contatti › link): Instagram, AutoScout24, Google, solo indirizzi https.
- Chiusure e festività (visite › chiusure) e dati per la privacy (privacy › indirizzo, email).
- Marchio: il file img/borzi-bianco.svg è il vostro logo ridisegnato in vettoriale, stesso carattere e doppia barra. L'accento rosso è una scelta di partenza: per l'arancio basta cambiare «accento» in garage.json (ad esempio #ff6a13).

Le auto che trovi all'inizio sono di **esempio** (hanno l'etichetta «Esempio»): dal gestionale, in fondo all'elenco, «Elimina i dati di esempio». Poi inserisci le auto vere o importa un CSV.

## Metterlo online (Cloudflare)
1. Carica questa cartella in un repository GitHub (o usa `npx wrangler deploy`).
2. Cloudflare › Workers & Pages › Create › collega il repository. Il nome deve essere quello di `wrangler.jsonc`.
3. Il sito funziona subito. Il gestionale resta «solo su questo browser» e le prenotazioni dal sito restano chiuse (il sito mostra il telefono) finché non attivi l'archivio online:
   - Storage & Databases › D1 › Create database. Copia il Database ID.
   - In `wrangler.jsonc` togli i `//` dal blocco `d1_databases` e incolla l'ID.
   - Settings › Variables and Secrets › Secret `GESTIONALE_PASSWORD` (almeno 10 caratteri).
4. Apri `/gestionale/`, accedi con la password: auto, contatti, visite e foto si allineano tra telefono e computer.

## Cose da sapere (limiti veri)
- **Prezzi di mercato.** AutoScout24 non ha un'API pubblica e le sue condizioni vietano di copiare i dati con programmi propri. Per questo la stima non pesca da AutoScout24 da sola: con `mercato.fonte = "auto"` usa un feed autorizzato se ne colleghi uno (variabili `MERCATO_URL` e `MERCATO_KEY` in `wrangler.jsonc`), altrimenti si lavora con gli annunci che incolli a mano. Per una presentazione puoi mettere `"fonte": "esempio"`: i prezzi sono generati dal programma e il gestionale lo dichiara.
- **Prova.** L'archivio e le prenotazioni sono stati provati solo con un database simulato in locale, non su Cloudflare vero: alla prima messa online fai una prenotazione di prova e controlla che compaia nell'agenda.
- **Privacy.** L'informativa (`privacy.html`) è un modello. Finché non la fa verificare un legale e non metti `"verificata": true` in `privacy`, mostra l'avviso «modello da verificare». Serve anche il contratto di nomina a responsabile tra {cfg['nome']} e ENA ONE STUDIO. Lo studio completo è nel documento «AutoProfit · Privacy dei clienti».
- **Caratteri.** Il sito li prende da Google Fonts. Per un sito vero conviene scaricarli e servirli dal proprio dominio (sentenza di Monaco del 2022 sull'IP trasmesso a Google).
- Non ci sono ancora le sezioni Recensioni di Google e «Chi siamo» del titolare.
