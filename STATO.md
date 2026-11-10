# STATO: Sakina (sito vecchio, ginkgo321.github.io/sakina)

## Dove siamo
- `main` è la 1.11, pubblicata su `ginkgo321.github.io/sakina/` (repo pubblico `github.com/ginkgo321/sakina`). Il lavoro del trasferimento sta sul **ramo `trasferimento`** (versione 1.12), con commit **solo locali: nessun push**.
- Idea: Sakina avrà un indirizzo proprio, `sakina.150796.xyz` (repo nuovo `dilfal/sakina.150796.xyz`, cartella `C:\Users\df\Dev\GitHub\app\sakina.150796.xyz`). Il sito vecchio **resta com'è** e gli utenti non perdono i dati: la memoria del browser non passa da un indirizzo all'altro, quindi i dati si portano a mano (file o link).
- Fatto sul ramo: `js/trasferimento.js` (`RUOLO = 'vecchio'`): in «Su Sakina» la sezione «Trasferisci i tuoi dati» con «Apri il nuovo indirizzo con i miei dati» e «Salva i dati in un file». Solo lettura: la prova confronta la memoria prima e dopo.
- Prova `tools/prove/trasferimento.mjs`: 57 ok (server 8093 vecchio e 8094 nuovo). Con `dati_corrotti`, `saluto_e_immagini`, `migrazione_da_bonaccia` e `schermi` tutto ok, su tutti e due i siti.

## Da fare: Fase B (online, ogni passo solo con l'ok dell'utente)
1. ~~Sito nuovo~~ **fatto il 10/11/2026**: `https://sakina.150796.xyz/` online (repo `dilfal/sakina.150796.xyz`, DNS su **Cloudflare**, dominio verificato, HTTPS attivo).
2. Provare il sito nuovo da un telefono vero (apertura, installazione, Sure in streaming, un ascolto). **← prossimo passo**
3. **Solo dopo**: unire `trasferimento` in `main` e push del sito vecchio (la sezione punta al nuovo indirizzo, che deve già rispondere).
4. Provare il passaggio con un telefono vero (link e file), poi un avviso piccolo e chiudibile nel sito vecchio.
5. **Mai un `CNAME` nel sito vecchio.** Spegnerlo solo dopo molti mesi, con un avviso più evidente.
- Poi Bonaccia, con lo stesso metodo (per lei solo file: i dati sono più personali e il link finirebbe nella cronologia).

## Da fare (resto)
- Su iPhone vero: recitazione a schermo bloccato (anche con «Pareggia il volume»), passaggio alla Sura dopo (fine Sura e coda) a schermo bloccato, timer di notte, comandi e immagine sulla schermata di blocco, aspetto del menu ⋯ e della finestra «Coda e liste».
- Rimisurare `BG_REF.ruscello` (tarato su un ruscello con i campanelli, che qui non ci sono): `docs/livelli_audio.md`.
- Solo se l'utente lo chiede: togliere il vecchio `docs/analisi_suoni.md` (parla di acufene) dalla cronologia del primo commit, con un push forzato.

## Da ricordare
- Prima di ogni push: `python tools/aggiorna.py`; prove una alla volta (server `python -m http.server 8093 --bind 127.0.0.1`; per `trasferimento.mjs` anche il nuovo sito su 8094).
- Push con l'helper di `gh` (`git -c credential.helper= -c "credential.helper=!gh auth git-credential" push origin main`): l'helper predefinito usa un altro account e riceve 403.