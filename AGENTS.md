# Sakina: istruzioni per gli agenti (Claude Code, Antigravity, Codex)

Questo file vale per ogni agente che lavora nel progetto. Lo stato del lavoro in corso sta in `STATO.md` (leggilo per primo e riscrivilo, max ~40 righe, a fine di ogni blocco concluso). Il resto, in `README.md` e in `docs/analisi_suoni.md`.

## Cos'è

Sito (PWA) in italiano per ascoltare le recitazioni coraniche (tradizione Hafs): 114 Sure, 5 voci, sottofondo di natura, timer di spegnimento, ascolto offline di singole Sure. Nata dentro Bonaccia (`C:\Users\df\Dev\GitHub\bonaccia`, app per l'acufene) e separata il 8 novembre 2026. Solo HTML, CSS e JavaScript, **senza dipendenze e senza build**. Non raccoglie dati: tutto resta nel telefono (`localStorage`, Cache). Cartella: `C:\Users\df\Dev\GitHub\sakina`.

## Regole fisse

- **Italiano**, con tutti gli accenti e i segni (è, à, ù, «», ’). Tono calmo, frasi corte. Testi religiosi sobri: descrivi, non interpretare, non attribuire poteri o promesse mediche.
- **Ogni aggiornamento del sito**: prima del commit lancia `python tools/aggiorna.py` (o `--versione 2.0`). Scrive versione, data e ora in `js/version.js` (compaiono in «Su Sakina») e alza la cache di `sw.js`. Non modificare `js/version.js` a mano.
- File che deve funzionare offline: mettilo in `FILES` (o in `NATURA`) in `sw.js`; un file elencato che non esiste fa fallire l'installazione del service worker.
- Dopo ogni modifica a un `.js`: `node --check js/<file>.js` (e `sw.js`).
- Stesso indirizzo (`ginkgo321.github.io`) di Bonaccia: le memorie del browser sono condivise. Qui si toccano solo le Cache `sakina-*` e le chiavi `sakina.*` di `localStorage`. Il lettore, al primo avvio, riprende dalla vecchia chiave `bonaccia.quran_settings` e sposta le Sure salvate da `bonaccia-recitazioni-v1`.
- **Recitatori con selezione protetta**: se un recitatore in `js/recitazioni_data.js` ha la proprietà `surahs`, solo quelle Sure esistono con quella voce (oggi Mishary Al-Afasy: 1, 12, 19, 31, 93, 94, 95, 108, 112, 113, 114). Non allargare l'elenco e non aggirarlo: è una scelta della paziente.
- Commit locali; push e pubblicazione solo se l'utente lo chiede.
- Non committare `tools/immagini/lavoro/` (bozze e originali delle immagini).

## File

- `index.html`, `css/style.css`: struttura e stile (tema giorno e notte).
- `js/app.js`: tema, saluto con il nome (`sakina.nome`), finestre «Benvenuto» e «Su Sakina», versione.
- `js/recitazioni.js`, `js/recitazioni_data.js`, `js/recitazioni_livelli.js`: lettore, 114 Sure e 5 voci in streaming dalla CDN MP3Quran, salvataggio offline, livelli, sottofondo, timer.
- `js/sure_info.js`: luogo e mini descrizione di ogni Sura. **Generato** da `tools/immagini/genera_dati.py`: si modificano lì.
- `img/sure/NNN.webp` (480 px) e `img/sure/t/NNN.webp` (miniature 104 px): una copertina per Sura. Senza persone, volti o scritte.
- `js/audio.js`: motore audio (sottofondo di natura e livello della voce).
- `js/version.js`: versione (lo scrive `tools/aggiorna.py`).
- `audio/natura/`: registrazioni CC0 di Freesound (+ `CREDITS.txt`).
- `sw.js`, `manifest.webmanifest`, `icons/`: installazione e uso offline.
- `tools/prove/`: prove automatiche (Chrome senza finestra, Node); `tools/`: misure e aggiornamento.

## Immagini delle Sure

- Generazione: prima Antigravity (sotto-agente `image-generator`, MCP `antigravity`), poi solo la chiave Google Cloud, come da `CLAUDE.md` e dalla skill `multimedia-generation`. Mai Picsart, fal.ai o altro per le immagini.
- Stile: copertina di libro antico in rilievo (tessuto o pelle in un colore scuro), cornice floreale, un simbolo inciso in oro; **mai persone, volti, profeti, scritte, lettere o calligrafia**. Soggetti e colori in `tools/immagini/genera_dati.py` / `soggetti.json`.
- Originali e non derivate: non copiare né ricalcare illustrazioni di altre app (copyright). Si descrive lo stile a parole.
- Dopo la generazione: `python tools/immagini/prepara.py` (ritaglio, 480 px e 104 px WebP).

## Suoni

- Solo registrazioni di veri autori con licenza libera (CC0 o CC-BY); crediti in `audio/natura/CREDITS.txt`. Mai suoni generati con l'AI.
- Livelli di riferimento: recitazioni portate a −18 LUFS dai guadagni di `js/recitazioni_livelli.js`; sottofondo circa 12 dB sotto la voce. Se cambi i guadagni del motore (`js/audio.js`) ritara `BG_REF` in `js/recitazioni.js` misurando il livello in uscita (`docs/analisi_suoni.md`).
- Strumenti: `tools/misura_recitazioni.py` (rifà la tabella dei livelli, lungo, usa la rete), `tools/analizza_suoni.py`.

## Provare e verificare

- Server locale: `python -m http.server 8093 --bind 127.0.0.1` dentro la cartella.
- Prove in `tools/prove/` (vedi `tools/prove/LEGGIMI.md`): **una alla volta**, non in parallelo (si disturbano e danno falsi errori).
- Da provare su un iPhone vero: recitazione a schermo bloccato con «Pareggia il volume», interruttore laterale su silenzioso, timer di notte.

## Se lavori da Antigravity

- Puoi modificare file, fare controlli brevi e generare le immagini con `image-generator`. Gli script di `tools/` oltre i 10 secondi li lancia Claude Code.
- Non usare servizi a pagamento né chiavi API di questo progetto.
- A fine blocco aggiorna `STATO.md`, non questo file.
