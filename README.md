# Sakina

Sito (PWA) in italiano per ascoltare le recitazioni coraniche (tradizione Hafs): le 114 Sure in cinque voci, con sottofondo di natura, timer di spegnimento e ascolto senza rete delle Sure salvate. Solo HTML, CSS e JavaScript, senza dipendenze e senza build. Non raccoglie dati: nome, voce, Sura e impostazioni restano nel telefono (`localStorage` e Cache del browser).

*Sakina* (سكينة) è la quiete. Le recitazioni nascono dentro un'altra app dello stesso autore (Bonaccia) e l'8 novembre 2026 sono state separate in questa.

## Provarla sul computer

```
cd C:\Users\df\Dev\GitHub\sakina
python -m http.server 8080
```

Poi apri `http://localhost:8080`. Il service worker (uso offline) e l'installazione richiedono `http://localhost` o HTTPS.

## Pubblicarla (GitHub Pages) e metterla sull'iPhone

1. Repository `github.com/ginkgo321/sakina`, Settings → Pages → «Deploy from a branch», `main`, cartella `/ (root)`. L'indirizzo è `https://ginkgo321.github.io/sakina/`. `.nojekyll` evita che Pages rielabori i file.
2. Sull'iPhone apri l'indirizzo in Safari, poi Condividi e «Aggiungi a Home». All'installazione si scaricano circa 2,7 MB (app e tre sottofondi); le Sure arrivano in streaming.
3. **Per aggiornare il sito**, prima di ogni commit: `python tools/aggiorna.py` (oppure `--versione 2.0`). Scrive in `js/version.js` versione, data e ora (compaiono in «Su Sakina») e alza la cache di `sw.js` (`sakina-vN`).

Bonaccia vive sullo stesso indirizzo (`ginkgo321.github.io`), quindi le due app condividono la memoria del browser: ognuna tocca solo le proprie chiavi e Cache (`sakina-*`, `sakina.*`). Al primo avvio Sakina riprende le impostazioni e sposta le Sure salvate da Bonaccia.

## Cosa c'è

- **Lettore**: barra con traccia colorata (si trascina senza salti), tempo rimanente, spinner di caricamento, Sura precedente/successiva, indietro/avanti di 15 secondi, lettore compatto fisso, comandi e immagine della Sura sulla schermata di blocco (Media Session, JPEG in `img/sure/art/`).
- **Voci**: Al-Minshawi, Abdul Basit, Al-Hussary, Mansour Al-Salimi (per la notte; con Al-Baqarah, 2 h 20) e Mishary Al-Afasy (solo 11 Sure, `surahs` in `js/recitazioni_data.js`).
- **Timer** di spegnimento (15-90 minuti, dissolvenza di 12 secondi) e «Alla fine»: fermati, prossima Sura, ripeti.
- **Sottofondo** di pioggia, onde, vento o ruscello, a distanza regolabile dalla voce (`js/audio.js`).
- **Pareggia il volume**: tutte le voci e le Sure a −18 LUFS (`js/recitazioni_livelli.js`, generato da `tools/misura_recitazioni.py`).
- **Salva sul telefono** (non oltre 100 MB) per ascoltare senza rete.
- **Saluto** per nome, secondo l'ora; il nome si chiede la prima volta e si cambia solo da «Su Sakina».
- **Proposte per il momento della giornata** (mattino, pomeriggio, sera, notte) in cima all'elenco; se una Sura non esiste con la voce scelta (Afasy) compare «con Al-Minshawi» e parte con quella voce.
- **Ricorrenze**: il venerdì (da giovedì al tramonto) Al-Kahf e Al-Jumu'ah; in Ramadan, nelle sue notti dispari delle ultime dieci e nelle due feste (con il saluto «ʿĪd mubārak») le Sure di quei giorni. Il tramonto è un orario indicativo per l'Italia; le date lunari le calcola il telefono (calendario Umm al-Qura) e possono differire di un giorno.
- **Copertina e mini descrizione** di ogni Sura (`img/sure/`, `js/sure_info.js`).

## Immagini e descrizioni delle Sure

`tools/immagini/genera_dati.py` contiene, per ogni Sura, la mini descrizione, il luogo della rivelazione (dove l'elenco tradizionale è condiviso) e il soggetto dell'immagine; scrive `js/sure_info.js` e `tools/immagini/soggetti.json`. Le copertine sono illustrazioni originali (acquerello notturno con foglia d'oro, simbolo dentro un cerchio con anello dorato, colori diversi per tema; mai persone, volti o scritte) generate con Antigravity e, a quota finita, con la chiave Google Cloud (`tools/immagini/lotti.py`, `genera_gcloud.py`) e preparate con `tools/immagini/prepara.py` (WebP 480 px e miniature 104 px). Dettagli e regole in `AGENTS.md`.

## File

- `index.html`, `css/style.css`, `js/app.js`: struttura, stile, saluto, finestre, tema.
- `js/recitazioni*.js`, `js/sure_info.js`, `js/audio.js`: lettore, dati, livelli, motore audio.
- `audio/natura/`: registrazioni CC0 di Freesound (+ `CREDITS.txt`). `img/sure/`: copertine.
- `tools/prove/`: prove automatiche in Chrome senza finestra (`tools/prove/LEGGIMI.md`). `docs/livelli_audio.md`: livelli audio.
- `AGENTS.md`: istruzioni per gli agenti. `STATO.md`: appunti di ripartenza.

## Da provare su un iPhone vero

Recitazione a schermo bloccato (anche con «Pareggia il volume» acceso), interruttore laterale su silenzioso, timer di notte, comandi dalla schermata di blocco.
