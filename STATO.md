# STATO: Sakina – 8 novembre 2026

## Fatto
- **App creata** in `C:\Users\df\Dev\GitHub\sakina` separando le recitazioni da Bonaccia: lettore, 5 voci, selezione protetta di Afasy (11 Sure), sottofondo di natura (pioggia, onde, vento, ruscello), timer, «Alla fine», offline per le singole Sure, livelli pareggiati, Media Session. Motore audio ridotto (`js/audio.js`), nuovo aspetto (sabbia e verde; notte marrone e oro).
- **Bonaccia ripulita** (senza commit): niente più recitazioni, tre collegamenti a `https://ginkgo321.github.io/sakina/`, versione 1.10, cache `bonaccia-v13`; il suo service worker cancella solo Cache `bonaccia-*` e lascia `bonaccia-recitazioni-v1`. Prove di Bonaccia rilanciate: ok.
- **Saluto per nome**: finestra alla prima apertura (si può saltare), nome in `localStorage` (`sakina.nome`), modificabile da «Su Sakina»; saluto in quattro fasce orarie; il nome è sempre testo (mai HTML).
- **Migrazione da Bonaccia** (stesso indirizzo): riprende `bonaccia.quran_settings` e sposta le Sure da `bonaccia-recitazioni-v1`.
- **Mini descrizioni** delle 114 Sure + luogo (dove condiviso) in `js/sure_info.js`, generato da `tools/immagini/genera_dati.py`. Revisione Opus fatta e applicata (errori di fatto, citazioni tolte, soggetti senza strumenti musicali né scritte; luogo vuoto anche per 1, 97, 112, 113, 114).
- **Immagini**: tutte le 114 copertine pronte, riviste a occhio (tavole) e pubblicate in `img/sure/` (4,6 MB con le miniature; ritaglio automatico del bordo di carta). Rifatte con soggetto nuovo la 37, 54, 74 e 78.
- **Consigli per momento della giornata** (`Sakina.Momenti`: mattino, pomeriggio, sera, notte) in cima all'elenco, nel rispetto delle Sure ammesse con la voce scelta; prova `momenti_del_giorno.mjs`.
- **Prove**: dati_corrotti, saluto_e_immagini, migrazione, lettore_*, voci_e_protezione, schermi, offline 1 e 2: tutte ok (`tools/prove/LEGGIMI.md`; una alla volta).

## Decisioni
- **Stile delle copertine: D** (acquerello e guazzo notturno con foglia d'oro, cerchio con anello dorato, colore del cielo per tema). Scelto dall'utente l'8 novembre 2026; prompt in `soggetti.json`.
- Immagini: nessuna figura umana, nessun profeta, nessuno strumento musicale; originali, non copie di altre app. Antigravity ha finito la quota del modello di immagini dopo 2 immagini (HTTP 429, ripristino circa 4 ore); il resto con la chiave Google Cloud, 2 alla volta (con 4 arriva il 429).
- **Repository pubblico** `github.com/ginkgo321/sakina` (Pages attive su `ginkgo321.github.io/sakina/`): `dilettafalcone` è collaboratore con scrittura; il primo commit («Primo commit», 22:26) l'ha fatto l'utente. Si pubblica ogni ~10 Sure riviste a occhio (idea dell'utente). Regole in `CLAUDE.md`: niente dati personali o di salute; per questo `docs/analisi_suoni.md` (parlava di acufene e di una paziente) è solo in `docs/locale/` (ignorata) e il pubblico ha `docs/livelli_audio.md`. **Il vecchio file resta nella cronologia del primo commit**: per toglierlo serve riscrivere la storia (push forzato), da chiedere all'utente.
- Bonaccia: dilettafalcone ha solo lettura su `ginkgo321/bonaccia`, quindi la ripulitura di Bonaccia è solo locale (nessun push possibile finché non ha scrittura).

## Da fare
- `python tools/aggiorna.py` prima di ogni push; prove una alla volta.
- Ritarare `BG_REF.ruscello` (senza campanelli): vedi `docs/livelli_audio.md`.
- Su iPhone vero: recitazione a schermo bloccato, timer di notte, comandi dalla schermata di blocco, aspetto di saluto e copertine; peso delle immagini su rete mobile (si scaricano solo quelle viste: le miniature dell'elenco sono 1-3 KB, la copertina grande 30-70 KB).
- Bonaccia: serve il permesso di scrittura su `ginkgo321/bonaccia` per pubblicare la ripulitura (i collegamenti a Sakina sono già pronti).
- Se si vuole, togliere `docs/analisi_suoni.md` dalla cronologia pubblica (push forzato): chiedere all'utente.

## File toccati
Tutta la cartella `sakina` (nuova) e, in `bonaccia`: `index.html`, `css/style.css`, `js/app.js`, `js/audio.js`, `js/content.js`, `sw.js`, `js/version.js`, docs, prove, `AGENTS.md`, `README.md`, `STATO.md`; cancellati `js/recitazioni*.js`, `tools/misura_recitazioni.py` e le prove del lettore.
