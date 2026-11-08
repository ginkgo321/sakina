> Questo documento è nato in Bonaccia (6-7 novembre 2026), quando le recitazioni coraniche erano ancora una sua scheda. Il 8 novembre 2026 le recitazioni sono passate a Sakina; qui si tiene tutto com'era, perché le misure valgono per entrambe. Dove si legge «Bonaccia» e «versione 1.x» si parla dell'app di partenza.

# Analisi dei suoni e delle musiche di Bonaccia

6 novembre 2026. Tre parti: misure acustiche, evidenze, candidati nuovi. Le misure si ripetono con `python tools/analizza_suoni.py <file o URL>` (serve `ffmpeg`, `numpy`, `scipy`).

**Limiti.** Sono misure, non ascolti: nessuno ha ascoltato questi file. I suoni sintetici (rumore, vento, campanelli generati dal telefono) non sono stati misurati, perché nascono nel browser. Le evidenze vengono da riassunti e abstract trovati in rete, non dalla lettura dei testi completi.

## 1. Misure acustiche

Sigle: **LUFS** sonorità media (più alto = più forte); **LRA** quanto la sonorità sale e scende; **TP** picco reale in dBTP (sopra 0 = oltre il fondo scala, quindi distorsione); **reg** distanza in dB tra i secondi più piani e più forti; **acuti** quota di energia oltre 4 kHz, dove cade di solito l'acufene.

### Registrazioni della natura (`audio/natura`, 60 s)

| File | LUFS | LRA | TP | reg | Sotto 250 Hz | Oltre 2 kHz | Oltre 4 kHz |
|---|---|---|---|---|---|---|---|
| pioggia | −19,7 | 1,8 | −6,0 | 2,7 | 66 % | 2 % | 0,5 % |
| mare | −19,6 | 5,4 | −3,0 | 8,9 | 14 % | 16 % | 4,8 % |
| fiume | −16,6 | 0,1 | −1,1 | 0,4 | 5 % | 42 % | 17,9 % |
| fontana | −17,7 | 0,4 | **0,0** | 0,5 | 13 % | 54 % | 31,3 % |
| bosco | −21,8 | 0,7 | −8,2 | 0,9 | **96 %** | 3 % | 2,9 % |

- Tutte sono regolari: salvo il mare, il livello cambia di meno di 3 dB. Il mare «respira» di proposito (onde, salti fino a 8 dB), ed è giusto così.
- **Pioggia e bosco sono quasi solo bassi.** Il bosco ha il 96 % dell'energia sotto 250 Hz: dentro c'è soprattutto un rumore grave, gli uccelli pesano poco. Fiume e fontana sono le uniche con energia vera tra 2 e 8 kHz.
- La fontana tocca 0,0 dBTP e ha il 31 % di energia oltre 4 kHz: è la più chiara e la più rischiosa se la persona è sensibile ai suoni acuti.
- Lo scarto tra la più forte (fiume −16,6) e la più piano (bosco −21,8) è 5 dB, con lo stesso trim (`REAL_TRIM` 2,6) per tutte.

### Voce guida (`audio/voce`, 71 file)

Molto regolare: mediana −20,4 LUFS, da −20,9 a −19,3. Picchi da −9,7 a −3,5 dBTP, quasi nessun acuto (mediana 2,5 %). Allineata con la natura (−17…−22). Nessun problema.

### Recitazioni coraniche (primi 10 minuti, via CDN, 5 Sure per voce)

| Voce | LUFS (da…a) | Picco TP | LRA | reg | Acuti oltre 4 kHz |
|---|---|---|---|---|---|
| Al-Minshawi | −11,0 … −16,2 | −0,9 … +0,5 | 7,9 … 12,9 | 17,8 … 25,1 | 1,6 … 9,7 % |
| **Abdul Basit** | **−4,9 … −6,9** | **+6,6 … +8,3** | 6,7 … 10,1 | 14,1 … 29,2 | 1,5 … 3,6 % |
| Al-Hussary | −11,9 … −17,0 | −1,8 … +0,3 | 8,7 … 12,5 | 11,3 … 29,9 | 0,2 … 0,5 % |

Sure misurate: Ar-Rahmān (55), Al-Mulk (67), Ad-Duhā (93), Maryam (19), Yā-Sīn (36).

1. **Abdul Basit è 6-10 dB più forte delle altre due voci, e 10-17 dB più forte dei suoni di Bonaccia.** I picchi arrivano a +8 dBTP: il file è masterizzato oltre il fondo scala (distorsione). Passare da Minshawi a Basit senza toccare il volume dà un colpo improvviso nelle orecchie. Per una persona con acufene, e magari iperacusia, è la cosa più urgente.
2. **Anche tra Sure della stessa voce ci sono fino a 5 dB di differenza** (Minshawi: Al-Mulk −16,2 contro Ar-Rahmān −11,6).
3. **Dinamica ampia**: il 5°-95° percentile dei secondi va da 11 a 30 dB, contro meno di 9 dB della natura. È il carattere del Mujawwad, ma obbliga a scegliere tra sentire male le parti piane o sobbalzare sulle forti.
4. **Pause di silenzio vero** (sotto −60 dBFS): quasi tutte le Sure hanno da 13 a 31 pause da oltre 1 s ogni 10 minuti (eccezione: Ar-Rahmān di Hussary, che ne ha una). Esempi: Hussary, Yā-Sīn, pausa più lunga 10,5 s, 128 s di silenzio su 600 (21 %); Minshawi, Al-Mulk, 28 pause, la più lunga 4,3 s, 71 s totali; Basit, Yā-Sīn, 30 pause, 82 s. Il silenzio è proprio quello che fa risaltare l'acufene (lo dice già la scheda «Perché il silenzio pesa»).
5. Spettro: le voci stanno quasi tutte tra 250 e 2000 Hz (63-91 %), con poco oltre 4 kHz. Nessuna sibilante fastidiosa, tranne qualche picco di Minshawi (Al-Mulk 9,7 %).

### Il sottofondo «mix leggero» delle recitazioni è praticamente inudibile

Calcolo dal codice (`audio.js` e `recitazioni.js`), non misurato in riproduzione:

- Una registrazione della natura arriva a circa −19,7 LUFS, più `REAL_TRIM` (+8,3 dB) e il livello del layer 0,8 (−3,9 dB): circa −15 LUFS prima del volume generale.
- Il volume generale (`masterCurve`) va da −54 dB (0) a −3 dB (1). Il sottofondo delle recitazioni parte da 0,15 (−46 dB) e il cursore arriva solo a 0,4 (−34 dB).
- Risultato: circa **−62 LUFS** al valore predefinito e **−49 LUFS** al massimo del cursore. La voce sta tra −11 e −17 LUFS: il sottofondo è **da 35 a 50 dB sotto la voce**, cioè non si sente, e nelle pause resta il silenzio.
- Per avere il sottofondo 12 dB sotto la voce (circa −24 LUFS con Minshawi) servirebbe un volume generale di circa 0,88, ben oltre il cursore attuale.

## 2. Cosa dicono le evidenze

Sintesi prudente: **nessun tipo di suono ha dimostrato di essere migliore degli altri**, e la preferenza della persona non coincide con il beneficio.

- **Cochrane 2018** (già in `suoni.txt`): nessuna prova che la terapia sonora superi lista d'attesa, placebo o sola informazione.
- **Rumore a banda larga contro suoni naturali** (Durai e Searchfield 2017, 18 persone, crossover): dopo 8 settimane il rumore ha ridotto il Tinnitus Functional Index di 8,2 punti, i suoni naturali di 3,2. I suoni naturali possono agire di più sul fastidio emotivo. In un altro studio piccolo solo il suono naturale scelto dal paziente ha ridotto lo «spiacevole». Il suono preferito non era quello più efficace. [PMC5343046](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5343046/)
- **Livello del suono: mascheramento parziale o totale.** Uno studio con consulenza (JAAA 2021) non trova differenze tra consulenza sola, con mascheramento parziale e con mascheramento totale. Uno studio crossover su 20 persone ha trovato i risultati migliori a circa il 72,8 % del livello preferito, con grande variabilità tra persone. Un 2015 citato in una presentazione dice «punto d'incontro e mascheramento totale ugualmente efficaci», che **non ho verificato**. [studio Auckland](https://researchspace.auckland.ac.nz/handle/2292/52471), [JAAA](https://www.thieme-connect.com/products/ejournals/html/10.3766/jaaa.18027)
- **Musica.** Una meta-analisi del 2024 (14 studi, 1.239 pazienti, bassa qualità) non trova differenza nell'efficacia clinica complessiva, ma un miglioramento medio di 6,8 punti del Tinnitus Handicap Inventory. Per la musica «con il buco» due revisioni del 2024 non trovano vantaggi rispetto al semplice ascolto di musica; una del 2025 riporta effetti crescenti a 3 e 6 mesi, con campioni piccoli. [PubMed 38759414](https://pubmed.ncbi.nlm.nih.gov/38759414/)
- **Recitazione del Corano.** Una revisione sistematica del 2022 (20 studi inclusi) associa ascolto, recitazione e memorizzazione a effetti favorevoli su ansia, depressione, qualità del sonno e parametri fisiologici. Gli studi sono piccoli o quasi-sperimentali, e il dato più forte riguarda chi memorizza, non chi ascolta. Non esistono, che io abbia trovato, studi sull'acufene. [PMC9470760](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9470760/)
- **Volume notturno.** L'unico dato trovato riguarda i neonati: limite 50 dBA come media oraria, superato da molte macchine del rumore vicine al lettino (fino a 85 dBA a 30 cm). Per gli adulti non ho trovato studi sui rischi di un suono tenuto basso per dormire. [Pediatrics 2014, riassunto CBC](https://amp.cbc.ca/news/health/infant-sleep-machines-have-dangerous-noise-levels-study-says-1.2555838)

**Che cosa ne segue per Bonaccia:**
- La scelta del sito (suono basso, quasi sempre, nel punto d'incontro) è in linea con le prove: il livello parziale basta, non serve coprire l'acufene.
- Le registrazioni «scure» (pioggia, bosco) aiutano il rilassamento e l'accettazione, ma hanno poca energia dove tipicamente cade l'acufene (acuto). Il rumore a banda larga fa meglio nei dati disponibili, e Bonaccia lo ha già nei sintetici («Fruscio morbido» e «velato»). Non li ho misurati.
- Le recitazioni hanno basi di prova solo sul benessere generale e sul sonno, non sull'acufene: nel testo del sito conviene non promettere effetti sull'acufene (per questo ho tolto «riduzione dell'acufene» dal paragrafo introduttivo).

## 3. Musiche e suoni candidati

Cercati su Free To Use, Jamendo (nessun risultato), Openverse e Freesound (nessun risultato per il rumore marrone CC0). Misurati con lo stesso script. Tutti sono di veri artisti.

| Brano | Licenza | Durata | LUFS | LRA | reg | Sotto 250 Hz | Oltre 4 kHz |
|---|---|---|---|---|---|---|---|
| **Sleepwalkingdrone1** (Jim-Bretherick) | CC0 | 80 s | −17,7 | 2,5 | 2,4 | 38 % | 0,9 % |
| Underwater (Aetheric) | Free To Use | 137 s | −19,2 | 3,5 | 5,6 | 44 % | 0 % |
| Clouds (Aetheric) | Free To Use | 136 s | −15,7 | 3,6 | 7,0 | 61 % | 0 % |
| Distant Clarity (Zolvi) | Free To Use | 135 s | −12,5 | 2,2 | 5,9 | 18 % | 0 % |
| Slow Passage (Zolvi) | Free To Use | 130 s | −10,6 | 4,4 | 9,6 | 80 % | 0 % |
| Meditation (Aylex) | Free To Use | 364 s | −14,8 | 8,5 | 12,4 | 36 % | 0 % |
| Purity (Aylex) | Free To Use | 179 s | −17,9 | 8,0 | 25,9 | 31 % | 0 % |
| Sunset Bowl (Aetheric) | Free To Use | 144 s | −19,3 | 8,3 | 13,5 | 80 % | 0 % |
| Aurora (ColdWombDescent) | CC0 | 240 s | −16,8 | 10,4 | 19,5 | 3 % | 0 % |
| space ambient v02 (burning-mir) | CC0 | 152 s | −12,6 | 5,6 | 23,7 | 88 % | 0,5 % |

- Tutti sono scuri (nessuno ha energia oltre 4 kHz): servono al rilassamento, non al mascheramento di un acufene acuto.
- Per la notte contano la regolarità e la durata: i più adatti sono **Sleepwalkingdrone1** (il più regolare, ma 80 s: serve un ciclo senza stacchi), **Underwater** e **Distant Clarity**. Aurora, Meditation, Purity e Sunset Bowl cambiano troppo di livello (reg 12-26 dB) per dormire.
- **Licenza.** Il CC0 di Freesound si può mettere nel sito senza condizioni. La «Free To Use License» consente l'uso nei contenuti con attribuzione, ma **non ho verificato** se permette di distribuire i file dentro un'app: va letta la pagina della licenza prima di scegliere.
- Musica «con il buco»: richiede di conoscere la frequenza dell'acufene (altezza misurata dall'audiologo), e le prove sono contrastanti. Non la propongo ora.

## 4. Cosa farei, in ordine

1. **Recitazioni: pareggiare i livelli.** La CDN accetta l'accesso dal browser (`Access-Control-Allow-Origin: *`), quindi si può far passare l'audio nel motore di Bonaccia con un guadagno per voce e per Sura, portando tutto intorno a −16 LUFS e mettendo un limitatore a −3 dBTP. Resterebbe da provare su iPhone se il suono continua a schermo bloccato.
2. **Recitazioni: sottofondo regolato sulla voce.** Cursore e predefinito calibrati in modo che il sottofondo stia 10-15 dB sotto la voce e riempia le pause. Va misurato in riproduzione dopo la modifica.
3. **Basit:** finché i livelli non sono pareggiati, abbassarlo o avvisare nel testo. Resta il picco oltre il fondo scala nella registrazione.
4. **Natura:** togliere la fontana dalle atmosfere per la notte o abbassarla (è la più chiara, 31 % oltre 4 kHz, picchi a 0 dBTP); riequilibrare di 3-5 dB il bosco e il fiume.
5. **Una domanda per la paziente o l'audiologo:** l'altezza dell'acufene. Se è acuta, nessuna delle registrazioni scure la maschera, e conviene spingere sui rumori a banda larga.
6. **Musica:** aggiungere solo Sleepwalkingdrone1 (CC0) come atmosfera, dopo averla ascoltata e fatta ciclare senza stacchi.

## 5. Cosa è stato fatto (6 novembre 2026, versione 1.3)

1. **Livelli delle recitazioni pareggiati.** `tools/misura_recitazioni.py` ha misurato la sonorità dei primi 180 s di tutte le 342 registrazioni (3 voci x 114 Sure) e ha scritto `js/recitazioni_livelli.js` (obiettivo −18 LUFS, guadagno da −15,5 a +6 dB). La mediana delle voci era −13,2 (Minshawi), −5,3 (Basit), −14,8 (Hussary) LUFS: i guadagni mediani sono −5, −12,5 e −3,5 dB. In riproduzione l'audio passa dal motore di Bonaccia (`attachMedia` in `js/audio.js`) con guadagno proprio e limitatore a −3 dB. Misurato in Chrome sul livello in uscita, le tre voci arrivano tra −19,0 e −22,2 dBFS RMS (prima c'erano circa 12 dB di scarto, e Basit superava il fondo scala). Una casella «Pareggia il volume delle voci» permette di tornare a un normale `<audio>` se su iPhone la riproduzione a schermo bloccato si interrompe; se il percorso con livelli non parte, il sito ripiega da solo sull'audio semplice. Misura sui primi 180 s: su 6 file di controllo differisce dalla misura a 600 s di 0-1,7 dB.
2. **Sottofondo delle recitazioni.** Non partiva: `Engine.applyPreset` non esiste, quindi con un sottofondo scelto compariva l'avviso «Non è stato possibile avviare la recitazione». Ora usa i preset veri di `content.js`, salva e ripristina il mix e il volume che la persona aveva in «Suoni», e il cursore è relativo alla voce (da 24 a 4 dB sotto, predefinito 12). Taratura in Chrome del livello in uscita: pioggia, ruscello, onde e vento a circa −32 dBFS RMS con voce a circa −20. Resta una dispersione di qualche dB nella distanza dalla voce, perché l'RMS non è la sonorità percepita e ogni voce ha uno spettro diverso.
3. **Avviso su Abdul Basit.** Se i livelli sono spenti compare «Questa voce è registrata molto più forte delle altre: abbassa il volume del telefono prima di avviare».
4. **Natura.** Livelli riequilibrati con una correzione per registrazione (fiume −2,9 dB, fontana −1,8 dB, bosco +2,3 dB). La fontana non era tra i suoni della scheda Sonno (offre notte, onde, pioggia, ruscello, vento): nella descrizione ora è indicata come il suono più chiaro.
5. **Altezza dell'acufene.** Resta una domanda aperta per la paziente o l'audiologo (vedi `STATO.md`). Nessuna modifica al codice.
6. **Musica.** Aggiunto **Sleepwalkingdrone1** (CC0, Jim-Bretherick, Freesound 636566) come atmosfera «Suono lungo» nel gruppo «Suono continuo»: 80 s, −18,7 LUFS, 1,3 dB di escursione. Il sito lo fa ciclare con la dissolvenza incrociata di 3 s. **Non è stato ascoltato da nessuno:** va provato a volume molto basso. Non è tra i suoni della scheda Sonno finché non lo si è ascoltato.

Altro: `B._quranBgActive` nasconde il mini-player generale quando il sottofondo appartiene a una recitazione; il test headless di Chrome non ha mostrato errori JavaScript.

## 6. Lettore delle recitazioni (versione 1.4)

Difetti corretti: la barra non salta più mentre la si trascina (l'audio si sposta al rilascio, non a ogni movimento del dito, con meno richieste alla CDN); prima del primo ascolto la barra è disattivata e il tempo rimanente mostra «–:––» (il sito non precarica nulla); spinner mentre carica; traccia colorata fino al punto raggiunto, area di tocco di 36 px, tempo rimanente («−8:45») e testo per gli screen reader («3:20 su 12:05»). Novità: timer di spegnimento (15, 30, 45, 60, 90 minuti) con dissolvenza di 12 s, che parte con l'ascolto; Sura precedente e successiva; «Alla fine»: Fermati, Prossima Sura, Ripeti; posizione e salto sulla schermata di blocco (Media Session). Verifiche in Chrome: 13 prove superate (caricamento, trascinamento, precedente/successiva, timer, fine Sura).

Difetti trovati lungo la strada: svuotare un elemento audio con `load()` annulla l'evento `pause` in coda, quindi lo stato restava «in riproduzione» senza audio; e il gestore di riserva dei livelli scambiava lo svuotamento per un guasto e avviava una Sura (corretto in `resetMedia` e nel gestore `error`).

## 7. Due nuove voci

- **Mansour Al-Salimi** (CDN `mansour-salimi/r1`, tutte le 114 Sure, 256 kbps). Misurato: Al-Baqarah 2 h 20 min, −17,0 LUFS e 2,7 LU di escursione nei primi 10 minuti, nessuna pausa vuota, quasi nessun acuto (0,4 % oltre 4 kHz). Mediana delle 114 Sure −16,9 LUFS. Al-Baqarah è consigliata per la notte solo con questa voce. Sette Sure pesano oltre 100 MB (la 2 pesa 269 MB): il salvataggio offline le rifiuta, perché il service worker le caricherebbe intere in memoria.
- **Mishary Al-Afasy** (CDN `mishary-alafasy/r1`), limitato a 11 Sure approvate dalla paziente: 1, 12, 19, 31, 93, 94, 95, 108, 112, 113, 114. Livelli misurati: mediana −14,1 LUFS, gruppo da −16,6 a −10,6. Verificato che le altre Sure non compaiono in elenco, ricerca, riproduzione forzata, precedente/successiva, fine Sura, cambio voce e preferenze salvate.
- Guadagni misurati per entrambe in `js/recitazioni_livelli.js` (obiettivo −18 LUFS).

## 8. Secondo giro di prove (versione 1.7)

Nuove prove automatiche in `tools/prove/` (51 verifiche più 13 sul lettore e 19 sulle voci, tutte superate alla fine). Difetti trovati e corretti:

- **Dati salvati rovinati** (impostazioni di una versione vecchia o modificate a mano): con le impostazioni dell'app di tipo sbagliato l'app non partiva affatto; con diario o preoccupazioni in un formato diverso le schede andavano in errore; con una Sura fuori elenco (999, −3) le recitazioni restavano su una Sura inesistente, e una voce chiamata «constructor» avrebbe fatto fallire il caricamento. Ora ogni dato letto viene controllato e, se non è valido, si rimette il valore di partenza.
- **Errore di rete e livelli:** un solo errore di rete (per esempio una Sura non salvata aperta senza connessione) spegneva per sempre il pareggio dei livelli. Ora si disattiva solo se l'audio semplice funziona dove quello con livelli no.
- **Avviso doppio e stato incoerente:** l'esito di un tentativo di riproduzione già sostituito (tocchi rapidi, ripiego sull'audio semplice) poteva mostrare due avvisi o rimettere in pausa lo stato. Ogni avvio ha ora un numero e gli esiti vecchi si ignorano.
- **Schermi da 320 px:** i cinque tasti del lettore non stavano nella scheda e il tasto play si schiacciava a 50 px.
- **Schermata di blocco:** ogni azione si registra per conto suo (se un browser non ne supporta una, le altre restano attive).
- **Tastiera:** il focus non si perde più quando la scheda del lettore viene ridisegnata.
- `tools/test_headless.py` non funzionava su Windows (decodifica del testo di Chrome) e controllava un altro progetto: corretto.

Verificato senza difetti: uso senza rete (app, Sura salvata con salto di posizione, suoni della natura e voce guida dalla cache), tutte le atmosfere con registrazioni e sintetiche (nessun silenzio, nessun picco oltre −3 dBFS), respiro, 8 esercizi guidati, «Buonanotte», diario ed esportazioni, tocchi a raffica, mix dell'utente ripristinato dopo il sottofondo.

Non verificabile da un computer: ascolto, schermata di blocco e interruttore laterale dell'iPhone, condivisione del sistema per «Copia il riepilogo» e «Scarica CSV».

## 9. «Parte la recitazione» durante il respiro guidato (versione 1.8)

Segnalazione: facendo Calma, Respiro guidato partiva una recitazione. Su Chrome non si riproduce con il solo tocco (l'unico `play()` del respiro è il suono silenzioso di servizio). Trovate invece queste cause possibili, tutte corrette:

- **Comandi della schermata di blocco assegnati al motore dei suoni.** Dopo aver messo in pausa una recitazione con un sottofondo, `Engine.stop()` ricollegava i comandi «play» e «pausa» al motore: un «play» del sistema (tasto delle cuffie, schermata di blocco, o il sistema che li invia quando un'altra riproduzione parte) avviava l'atmosfera invece di riprendere la recitazione. Ora, dopo lo stop del sottofondo, i comandi tornano alla recitazione.
- **Comando «play» durante un altro audio.** Il comando «play» di una recitazione in pausa ora viene ignorato mentre c'è un respiro guidato, un esercizio con la voce o un suono scelto dall'utente. Lo stesso vale per «Prossima Sura» e «Ripeti» a fine Sura.
- **Recitazione già in corso.** Lasciando la scheda delle recitazioni la recitazione continua (è voluto), ma sovrapposta al respiro o alla voce guida era sgradevole: ora si mette in pausa quando parte un respiro guidato o un esercizio con la voce.

Non verificabile da un computer: se un iPhone invii davvero un «play» spontaneo quando parte l'audio del respiro. Le protezioni valgono comunque in entrambi i casi.
