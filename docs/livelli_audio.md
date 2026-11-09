# Livelli audio di Sakina

Misure e scelte sul volume delle recitazioni e del sottofondo. Strumenti: `tools/analizza_suoni.py` (misure di un file o di un URL) e `tools/misura_recitazioni.py` (rifà la tabella dei livelli, `js/recitazioni_livelli.js`; lungo, usa la rete).

Sigle: **LUFS** sonorità media (più alto = più forte); **LRA** quanto la sonorità sale e scende; **TP** picco reale in dBTP.

## Le voci, prima del pareggio (primi 10 minuti, 5 Sure per voce)

| Voce | LUFS (da…a) | Picco TP | LRA |
|---|---|---|---|
| Al-Minshawi | −11,0 … −16,2 | −0,9 … +0,5 | 7,9 … 12,9 |
| **Abdul Basit** | **−4,9 … −6,9** | **+6,6 … +8,3** | 6,7 … 10,1 |
| Al-Hussary | −11,9 … −17,0 | −1,8 … +0,3 | 8,7 … 12,5 |
| Mansour Al-Salimi | circa −17 (Al-Baqarah) | — | 2,7 LU di escursione |
| Mishary Al-Afasy | mediana −15,1, da −21,4 a −10,4 (114 Sure) | — | — |

- Abdul Basit è 6-10 dB più forte delle altre voci e ha picchi oltre il fondo scala (+8 dBTP): senza correzione, passare da una voce all'altra dà un colpo improvviso.
- Anche tra Sure della stessa voce ci sono fino a 5 dB di differenza.
- Quasi tutte le Sure hanno pause di silenzio vero (sotto −60 dBFS) da 1 a 10 secondi: nel pareggio non si alzano.
- Al-Salimi (Al-Baqarah, 2 h 20): nessuna pausa vuota, quasi nessun acuto. Sette Sure pesano oltre 100 MB (la 2 pesa 269 MB): il salvataggio offline le rifiuta, perché il service worker le caricherebbe intere in memoria.

## Il pareggio

Ogni voce e ogni Sura ha un guadagno in dB (`js/recitazioni_livelli.js`) che la porta a **−18 LUFS**; un limitatore a −3 dB chiude i picchi (`js/audio.js`, `attachMedia`). La casella «Pareggia il volume» lo accende e lo spegne: spenta, la voce passa da un normale `<audio>` (utile se sull'iPhone la riproduzione a schermo bloccato si interrompe).

## Il sottofondo

Le registrazioni della natura (pioggia, mare, fiume) stanno a circa −19,5 LUFS. Il cursore «Più lontano … Più vicino» regola la distanza dalla voce da −24 a −4 dB; il valore di partenza è **−12 dB sotto la voce**. `BG_REF` in `js/recitazioni.js` dà il livello (LUFS) di ogni sottofondo con il volume generale a 0 dB, tarato con una misura del livello in uscita in Chrome:

| Sottofondo | BG_REF (LUFS) |
|---|---|
| Pioggia | −13,6 |
| Onde | −13,0 |
| Ruscello | −15,9 (tarato con i campanelli, che in Sakina non ci sono: da rimisurare) |
| Vento | −16,9 |

Se cambi i guadagni del motore o i sottofondi, ritara `BG_REF` e rilancia `lettore_barra_timer.mjs`, `voci_e_protezione.mjs` e `lettore_tocchi_rapidi.mjs`.
