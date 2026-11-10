# Prove automatiche di Sakina

Pilotano Chrome senza finestra (protocollo CDP, solo Node 22 o successivo: nessuna dipendenza da installare). Servono Chrome in `C:\Program Files\Google\Chrome\Application` e rete (le recitazioni arrivano dalla CDN MP3Quran).

## Come si lanciano

1. Dentro la cartella del progetto: `python -m http.server 8093 --bind 127.0.0.1` (altra porta: variabile `PORTA_SITO`).
2. In un altro terminale, **una prova alla volta** (in parallelo si disturbano e danno falsi errori): `node tools/prove/<nome>.mjs`. Ogni prova stampa `OK` o `FALLITO` e un totale. Gli aiuti usano `Sakina.QuranPlayer._debug`, `_debugState`, `_debugSleep`, `_debugSeekEnd` (salta alla fine della Sura), `_coda`, `_liste` e `_escluse` di `js/recitazioni.js`.
3. File temporanei e schermate: `%TEMP%\sakina-prove\`. `_anteprima.mjs` fa due schermate (notte e giorno) per guardare l'aspetto.

## Le prove

| File | Cosa verifica | Durata |
|---|---|---|
| `dati_corrotti.mjs` | l'app parte con dati salvati rovinati (tipi sbagliati, JSON rotto, Sure e voci inesistenti), riprende le impostazioni della vecchia chiave di Bonaccia | 1 min |
| `saluto_e_immagini.mjs` | finestra del nome alla prima apertura, nome mostrato come testo (niente HTML), cambio e rimozione solo da «Su Sakina», «Non adesso», fasce orarie del saluto, copertina che sparisce se il file manca | 1 min |
| `momenti_del_giorno.mjs` | le proposte cambiano con l'ora (3, 8, 14, 20, 23: ora finta nella pagina), con una selezione protetta simulata le Sure escluse compaiono «con Al-Minshawi» e partono con quella voce, le altre con la sua; «Ascolta» avvia la Sura | 1 min |
| `schermata_di_blocco.mjs` | la Media Session riporta titolo, voce e immagine JPEG 512 × 512 della Sura in corso, e le cambia con la Sura successiva o con un'altra voce; esistono tutte le 114 immagini | 30 s |
| `barra_torna_su.mjs` | miniatura della Sura (44 px) nella barra fissa in basso, che cambia con la Sura e sparisce se il file manca; toccando miniatura o nome si torna in cima al lettore grande (la barra sparisce, il focus va sul tasto play, l'ascolto continua) | 30 s |
| `ricorrenze.mjs` | con date finte: venerdì (anche giovedì dopo il tramonto, non venerdì sera), Ramadan 2027, notti dispari (anche prima dell'alba), ʿĪd al-Fiṭr e ʿĪd al-Aḍḥā con il saluto, giorno qualunque; con una selezione protetta simulata Al-Kahf e Al-Jumu'ah compaiono «con Al-Minshawi» e la selezione resta intatta; «Ascolta» avvia la Sura | 2 min |
| `migrazione_da_bonaccia.mjs` | una Sura salvata in `bonaccia-recitazioni-v1` passa in `sakina-recitazioni-v1` e la vecchia memoria si svuota | 20 s |
| `trasferimento.mjs` | passaggio dei dati tra i due indirizzi (**servono due server**: 8093 per il sito vecchio e 8094 per il nuovo, uno per cartella; variabili `PORTA_VECCHIO` e `PORTA_NUOVO`): il vecchio sito esporta file e link senza cambiare la memoria; il nuovo mostra cosa trova, scrive solo dopo il «sì», rifiuta file e link rovinati o ostili (altra app, chiavi estranee, valori enormi), «Non adesso» ed Esc non scrivono niente, avvisa se qui ci sono già dati, nomi con HTML restano testo | 1 min |
| `lettore_barra_timer.mjs` | spinner, barra (trascinamento senza salti, rilascio), tempo rimanente, precedente/successiva, timer con dissolvenza, «Alla fine» | 2 min |
| `lettore_tocchi_rapidi.mjs` | tocchi a raffica, cambio voce e livelli durante il caricamento, sottofondo che parte e si ferma con la recitazione, «Ripeti» | 2 min |
| `lettore_focus.mjs` | il focus da tastiera non si perde quando la scheda viene ridisegnata | 20 s |
| `voci_e_protezione.mjs` | 5 voci, Afasy con tutte le 114 Sure e i loro livelli, selezione protetta simulata (elenco, ricerca, riproduzione forzata, precedente/successiva, fine Sura), Al-Salimi e Al-Baqarah, salvataggio offline rifiutato oltre 100 MB | 3 min |
| `coda_e_liste.mjs` | menu ⋯ su ogni riga, «Riproduci dopo» e «in fondo», ogni Sura con la sua voce, la coda prima di «Alla fine», «Ripeti la coda», «successiva», riordino e focus, «Togli le già ascoltate», liste (salva, nome con HTML mai eseguito, rinomina, ascolta, aggiungi, elimina con conferma), timer che ferma tutto, memoria, dati rovinati | 3 min |
| `sure_escluse.mjs` | Sure escluse da «Su Sakina»: per una voce e per tutte, elenco, ricerca, riproduzione forzata, precedente/successiva, fine Sura, proposte del giorno con un'altra voce, coda che salta la Sura esclusa, Sura in ascolto fermata, una voce mai vuota, «Rimetti tutte», memoria e dati rovinati | 3 min |
| `schermi.mjs` | nessuno scorrimento orizzontale e lettore dentro la scheda da 320 a 1280 px | 1 min |
| `offline_1_con_rete.mjs` poi `offline_2_senza_rete.mjs` | uso senza rete: la fase 1 installa il service worker e salva una Sura; **poi si ferma il server** e la fase 2 controlla che app, Sura salvata (con salto di posizione) e sottofondo funzionino e che un errore di rete non lasci lo stato bloccato | 2 min |

## Da ricordare

- Le prove non sostituiscono l'ascolto né la prova su iPhone: non verificano l'audio che si sente, la schermata di blocco e l'interruttore laterale.
- Se cambi i guadagni del motore (`js/audio.js`), `BG_REF` in `js/recitazioni.js` o le Sure di un recitatore, rilancia `lettore_barra_timer.mjs`, `voci_e_protezione.mjs` e `lettore_tocchi_rapidi.mjs`.
