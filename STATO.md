# STATO: Sakina – 8 novembre 2026

## Fatto
- **App creata** in `C:\Users\df\Dev\GitHub\sakina` separando le recitazioni da Bonaccia: lettore, 5 voci, selezione protetta di Afasy (11 Sure), sottofondo di natura (pioggia, onde, vento, ruscello), timer, «Alla fine», offline per le singole Sure, livelli pareggiati, Media Session. Motore audio ridotto (`js/audio.js`), nuovo aspetto (sabbia e verde; notte marrone e oro).
- **Bonaccia ripulita** (senza commit): niente più recitazioni, tre collegamenti a `https://ginkgo321.github.io/sakina/`, versione 1.10, cache `bonaccia-v13`; il suo service worker cancella solo Cache `bonaccia-*` e lascia `bonaccia-recitazioni-v1`. Prove di Bonaccia rilanciate: ok.
- **Saluto per nome**: finestra alla prima apertura (si può saltare), nome in `localStorage` (`sakina.nome`), modificabile da «Su Sakina»; saluto in quattro fasce orarie; il nome è sempre testo (mai HTML).
- **Migrazione da Bonaccia** (stesso indirizzo): riprende `bonaccia.quran_settings` e sposta le Sure da `bonaccia-recitazioni-v1`.
- **Mini descrizioni** delle 114 Sure + luogo (dove condiviso) in `js/sure_info.js`, generato da `tools/immagini/genera_dati.py`. Revisione Opus fatta e applicata (errori di fatto, citazioni tolte, soggetti senza strumenti musicali né scritte; luogo vuoto anche per 1, 97, 112, 113, 114).
- **Immagini**: 3 prove (2 Al-Baqarah, 12 Yusuf, 55 Ar-Rahman) fatte con Antigravity (nessun limite di quota incontrato), in `img/sure/`. Stile: copertina di libro antico in rilievo, simbolo in oro, senza persone né scritte.
- **Prove**: dati_corrotti, saluto_e_immagini, migrazione, lettore_*, voci_e_protezione, schermi, offline 1 e 2: tutte ok (`tools/prove/LEGGIMI.md`; una alla volta).

## Decisioni
- Immagini: nessuna figura umana, nessun profeta; originali, non copie dell'app vista come riferimento. Se il generatore lascia il bordo del libro o lo sfondo (succede), rigenerare con «flat, full-bleed, no book edges» o ritagliare con `prepara.py --margine`.
- Pubblicazione: repo `github.com/ginkgo321/sakina` + GitHub Pages, **da confermare prima di pubblicare** (account `gh` attuale: dilettafalcone; il repo è sotto `ginkgo321`).

## Da fare
- **L'utente deve giudicare le 3 prove**; se vanno bene, generare le altre 111 (soggetti e colori in `tools/immagini/soggetti.json`), poi `python tools/immagini/prepara.py` (con `--margine` se serve), controllare angoli e scritte, aggiungere un controllo di peso totale (~6 MB).
- `python tools/aggiorna.py`, commit, creazione del repo e push, attivazione Pages (solo dopo conferma).
- Ritarare `BG_REF.ruscello` (senza campanelli) con `docs/analisi_suoni.md` sez. 8.
- Su iPhone vero: recitazione a schermo bloccato, timer di notte, comandi dalla schermata di blocco, aspetto del saluto e delle copertine.
- Licenza dei suoni di Bonaccia «Free To Use»: non riguarda Sakina (usa solo pioggia, mare e fiume CC0).

## File toccati
Tutta la cartella `sakina` (nuova) e, in `bonaccia`: `index.html`, `css/style.css`, `js/app.js`, `js/audio.js`, `js/content.js`, `sw.js`, `js/version.js`, docs, prove, `AGENTS.md`, `README.md`, `STATO.md`; cancellati `js/recitazioni*.js`, `tools/misura_recitazioni.py` e le prove del lettore.
