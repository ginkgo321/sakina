# STATO: Sakina

## Dove siamo
- Versione 1.11, pubblicata su `ginkgo321.github.io/sakina/` (repository pubblico `github.com/ginkgo321/sakina`). Cosa c'è: `README.md`; regole: `AGENTS.md`; prove: `tools/prove/LEGGIMI.md` (tutte ok).
- Ultimi lavori: coda e liste di riproduzione (menu ⋯ su ogni riga), Sure escluse in «Su Sakina», Afasy con tutte le 114 Sure.

## Da fare
- Su iPhone vero: recitazione a schermo bloccato (anche con «Pareggia il volume»), passaggio alla Sura dopo (fine Sura e coda) a schermo bloccato, timer di notte, comandi e immagine sulla schermata di blocco, aspetto del menu ⋯ e della finestra «Coda e liste».
- Rimisurare `BG_REF.ruscello` (tarato su un ruscello con i campanelli, che qui non ci sono): `docs/livelli_audio.md`.
- Solo se l'utente lo chiede: togliere il vecchio `docs/analisi_suoni.md` (parla di acufene) dalla cronologia del primo commit, con un push forzato.

## Da ricordare
- Prima di ogni push: `python tools/aggiorna.py`; prove una alla volta (server `python -m http.server 8093 --bind 127.0.0.1`).
- Push con l'helper di `gh` (`git -c credential.helper= -c "credential.helper=!gh auth git-credential" push origin main`): l'helper predefinito usa un altro account e riceve 403.
