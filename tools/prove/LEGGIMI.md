# Prove automatiche di Sakina

Pilotano Chrome senza finestra (protocollo CDP, solo Node 22 o successivo: nessuna dipendenza da installare). Servono Chrome in `C:\Program Files\Google\Chrome\Application` e rete (le recitazioni arrivano dalla CDN MP3Quran).

## Come si lanciano

1. Dentro la cartella del progetto: `python -m http.server 8093 --bind 127.0.0.1` (altra porta: variabile `PORTA_SITO`).
2. In un altro terminale, **una prova alla volta** (in parallelo si disturbano e danno falsi errori): `node tools/prove/<nome>.mjs`. Ogni prova stampa `OK` o `FALLITO` e un totale. Gli aiuti usano `Sakina.QuranPlayer._debug`, `_debugState` e `_debugSleep` di `js/recitazioni.js`.
3. File temporanei e schermate: `%TEMP%\sakina-prove\`. `_anteprima.mjs` fa due schermate (notte e giorno) per guardare l'aspetto.

## Le prove

| File | Cosa verifica | Durata |
|---|---|---|
| `dati_corrotti.mjs` | l'app parte con dati salvati rovinati (tipi sbagliati, JSON rotto, Sure inesistenti o protette), riprende le impostazioni della vecchia chiave di Bonaccia | 1 min |
| `saluto_e_immagini.mjs` | finestra del nome alla prima apertura, nome mostrato come testo (niente HTML), cambio e rimozione solo da «Su Sakina», «Non adesso», fasce orarie del saluto, copertina che sparisce se il file manca | 1 min |
| `momenti_del_giorno.mjs` | le proposte cambiano con l'ora (3, 8, 14, 20, 23: ora finta nella pagina), con Afasy compaiono solo le sue 11 Sure, il cambio voce aggiorna l'elenco, «Ascolta» avvia la Sura | 1 min |
| `migrazione_da_bonaccia.mjs` | una Sura salvata in `bonaccia-recitazioni-v1` passa in `sakina-recitazioni-v1` e la vecchia memoria si svuota | 20 s |
| `lettore_barra_timer.mjs` | spinner, barra (trascinamento senza salti, rilascio), tempo rimanente, precedente/successiva, timer con dissolvenza, «Alla fine» | 2 min |
| `lettore_tocchi_rapidi.mjs` | tocchi a raffica, cambio voce e livelli durante il caricamento, sottofondo che parte e si ferma con la recitazione, «Ripeti» | 2 min |
| `lettore_focus.mjs` | il focus da tastiera non si perde quando la scheda viene ridisegnata | 20 s |
| `voci_e_protezione.mjs` | 5 voci, selezione protetta di Mishary Al-Afasy (elenco, ricerca, riproduzione forzata, precedente/successiva, fine Sura, cambio voce, preferenze salvate), Al-Salimi e Al-Baqarah, salvataggio offline rifiutato oltre 100 MB | 3 min |
| `schermi.mjs` | nessuno scorrimento orizzontale e lettore dentro la scheda da 320 a 1280 px | 1 min |
| `offline_1_con_rete.mjs` poi `offline_2_senza_rete.mjs` | uso senza rete: la fase 1 installa il service worker e salva una Sura; **poi si ferma il server** e la fase 2 controlla che app, Sura salvata (con salto di posizione) e sottofondo funzionino e che un errore di rete non lasci lo stato bloccato | 2 min |

## Da ricordare

- Le prove non sostituiscono l'ascolto né la prova su iPhone: non verificano l'audio che si sente, la schermata di blocco e l'interruttore laterale.
- Se cambi i guadagni del motore (`js/audio.js`), `BG_REF` in `js/recitazioni.js` o le Sure di un recitatore, rilancia `lettore_barra_timer.mjs`, `voci_e_protezione.mjs` e `lettore_tocchi_rapidi.mjs`.
- Il sottofondo «ruscello» di Sakina non ha più i campanelli del «ruscello» di Bonaccia: `BG_REF.ruscello` (−15,9 LUFS) era tarato con i campanelli; la differenza è piccola ma non è stata rimisurata.
