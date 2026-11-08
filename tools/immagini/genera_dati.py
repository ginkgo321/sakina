r"""genera_dati.py - sorgente unico per le descrizioni e i soggetti delle immagini delle 114 Sure.

    python tools\immagini\genera_dati.py

Scrive:
  js/sure_info.js                     per ogni Sura il luogo («Mecca» o «Medina», vuoto se discusso) e la mini descrizione
  tools/immagini/soggetti.json        per ogni Sura soggetto, tema di colore e prompt completo (serve solo alla generazione, non va sul sito)

Le descrizioni dicono il TEMA della Sura in parole semplici, senza interpretazioni e senza citare versetti: sono diverse dalle note
«consigliate per il riposo» di js/recitazioni_data.js. Il luogo (Mecca/Medina) si indica solo dove l'elenco tradizionale è
condiviso; dove gli studiosi sono divisi (1, 13, 22, 55, 61, 64, 76, 83, 97, 98, 99, 107, 112, 113, 114) resta vuoto.
Le immagini non hanno persone né volti né scritte: i soggetti sono animali, piante, astri, oggetti, architetture.
"""
import json
from pathlib import Path

RADICE = Path(__file__).resolve().parent.parent.parent

MEDINA = {2, 3, 4, 5, 8, 9, 24, 33, 47, 48, 49, 57, 58, 59, 60, 62, 63, 65, 66, 110}
DISCUSSE = {1, 13, 22, 55, 61, 64, 76, 83, 97, 98, 99, 107, 112, 113, 114}

# (numero, descrizione in italiano, soggetto inglese per l'immagine)
SURE = [
 (1, "Una breve preghiera che apre il Corano: lode a Dio e richiesta di guida sulla retta via. Si recita in ogni unità della preghiera.", "a closed ornate book resting on a stand beneath a radiant arch"),
 (2, "La più lunga: norme di vita, storie dei profeti e dei popoli precedenti, il digiuno, il pellegrinaggio. Prende il nome dalla storia della giovenca.", "a heifer in profile with sprigs of wheat"),
 (3, "Parla della famiglia di Imran, di Maria e di Gesù, della fermezza nelle difficoltà e del dialogo con la gente del Libro.", "an arched doorway entwined with olive branches in a circular wreath"),
 (4, "Si occupa della vita comune: i diritti delle donne, degli orfani e dell'eredità, la giustizia e i rapporti tra le persone.", "two interlaced lilies resting on a small balance scale"),
 (5, "Tratta di patti e di leggi, del cibo lecito e della tavola che i discepoli di Gesù chiesero dal cielo.", "a laden table with dates, figs, bread and pomegranates"),
 (6, "Un lungo discorso sull'unicità di Dio, con immagini della natura: il bestiame, i frutti, le stelle, le tenebre e la luce.", "a ram and a lamb grazing among wild flowers"),
 (7, "Racconta di Adamo, di Noè, di Mosè e di altri messaggeri; prende il nome dalle «alture», un luogo elevato tra il giardino e il fuoco.", "a high wall on a ridge between a green garden and a barren plain"),
 (8, "Riflette sulla vita della comunità dopo la battaglia di Badr, su unione, fiducia e correttezza nel dividere ciò che si ottiene.", "an open chest of coins with crossed palm branches"),
 (9, "Parla di accordi che finiscono e di accordi da rispettare, del pentimento e delle fatiche di una comunità; è l'unica Sura senza la formula iniziale.", "a door opening onto a beam of light"),
 (10, "Si apre con i segni della creazione e ricorda Giona, il profeta il cui popolo si pentì in tempo e fu risparmiato.", "a whale with a gourd plant, engraved in golden lines"),
 (11, "Racconta di profeti inviati a popoli diversi, tra cui Hud, con l'invito a perseverare e a non scoraggiarsi.", "a lone acacia tree on a wind-swept dune"),
 (12, "Il racconto continuo di Giuseppe: il sogno, i fratelli, il pozzo, la prova in Egitto e il perdono finale.", "a stone well with a rope beneath eleven small stars, a sun and a moon"),
 (13, "Il tuono e la pioggia come segni: tutto glorifica Dio. Ricorda che il cuore trova pace nel ricordo di Lui.", "a storm cloud with a lightning bolt and falling raindrops"),
 (14, "La preghiera di Abramo per la sua famiglia e per un luogo sicuro; la parola buona è paragonata a un albero dalle radici profonde.", "a tree with deep visible roots and rising branches"),
 (15, "Parla della custodia del Libro, della creazione e dei popoli scomparsi, tra cui gli abitanti di Al-Hijr, che scavavano case nella roccia.", "a rock-carved facade in a rocky valley"),
 (16, "Un elenco di doni di Dio nella natura: la pioggia, il bestiame, le api e il miele, il mare. Invita alla gratitudine.", "a honeybee over a hexagonal honeycomb"),
 (17, "Si apre con il viaggio notturno del Profeta a Gerusalemme; segue una serie di principi di vita: rispetto dei genitori, misura, giustizia.", "a crescent moon above a starry sky and a luminous path between two domes"),
 (18, "Quattro racconti: i giovani nella caverna, il proprietario dei due giardini, Mosè e il suo compagno, Dhul-Qarnayn. Parlano di fede, ricchezza e sapere.", "a cave mouth with sunbeams and ferns"),
 (19, "La storia di Maria e della nascita di Gesù, di Zaccaria e di Giovanni, di Abramo: racconti di fiducia e di vicinanza di Dio.", "a date palm with fruit beside a small spring"),
 (20, "Racconta di Mosè: la chiamata sul monte, il bastone, l'incontro con il faraone. Si apre con un invito a non sentirsi in affanno.", "a wooden staff and a small flame on a mountain slope"),
 (21, "Passa in rassegna molti profeti, tra cui Abramo, Giobbe, Giona, e sottolinea che il messaggio è uno solo.", "a lantern with seven stars surrounded by olive branches"),
 (22, "Parla del pellegrinaggio e del suo senso, del rispetto per i luoghi sacri e del permesso di difendersi.", "a camel on a road leading to a domed archway"),
 (23, "Descrive le qualità di chi crede: umiltà nella preghiera, cura degli impegni, modestia. Ripercorre la creazione dell'essere umano.", "a mihrab niche with sprigs of wheat and a crescent"),
 (24, "Indicazioni su riservatezza, famiglia e rapporti sociali. Contiene il «versetto della luce», paragonata a una lampada in una nicchia.", "a glass oil lamp in a niche with an olive tree"),
 (25, "Il Corano come «criterio» che distingue il vero dal falso; descrive i servi del Misericordioso, che camminano sulla terra con dolcezza.", "a balance scale with a radiant star above"),
 (26, "Racconti di Mosè, Abramo, Noè e di altri messaggeri e dei loro popoli. Il ritornello ricorda la fiducia in un Dio potente e misericordioso.", "a reed pen beside a rolled, tied scroll in the wind"),
 (27, "Racconta di Salomone, che comprende il linguaggio degli uccelli, della regina di Saba e di una formica che avvisa le altre.", "an ant carrying a grain on a leaf"),
 (28, "Il racconto di Mosè: la nascita, la cesta sul fiume, la fuga a Madian, il ritorno. Parla di orgoglio e di umiltà.", "a small basket floating on river waves among reeds"),
 (29, "Parla delle prove della fede e della pazienza dei messaggeri; paragona chi si affida a ciò che è fragile alla ragnatela.", "a spider on an intricate web"),
 (30, "Parla della sconfitta e della vittoria dei Romani e dei segni nella creazione: il sonno, l'amore, la pioggia, la varietà delle lingue e dei colori.", "a classical column with a laurel wreath and a rising sun"),
 (31, "I consigli di un uomo saggio al figlio: gratitudine, preghiera, rispetto dei genitori, voce misurata, passo umile.", "a mustard seed sprouting from a rock"),
 (32, "Un invito a meditare sulla creazione e sul ritorno a Dio; descrive chi lascia il letto di notte per pregare. Prende il nome dalla prosternazione.", "a prayer mat seen from above with a hanging lamp"),
 (33, "Parla della coesione della comunità nella battaglia del Fossato e di regole di comportamento nella casa del Profeta.", "desert tents encircling a dug trench"),
 (34, "Ricorda il regno di Saba e la sua prosperità, i due giardini e la diga, e come la gratitudine si perde nell'abbondanza.", "a dam with flowing water between two gardens"),
 (35, "Un inno al Creatore: i cieli e la terra, la pioggia che dà vita, le creature con le ali. Invita a ricordare i suoi doni.", "a flock of birds rising toward a sunrise"),
 (36, "Una Sura breve e densa su messaggio, creazione e ritorno alla vita. È molto letta e spesso chiamata «il cuore del Corano».", "a heart-shaped rosette of vines"),
 (37, "Si apre con schiere in ranghi serrati e racconta di Noè, Abramo, Mosè, Giona, tra le prove di chi si affida a Dio.", "a flock of birds in clear dark silhouettes rising in a wide V toward a bright sunrise, strong contrast against the glowing sky"),
 (38, "Parla di Davide e di Salomone, di Giobbe e della pazienza, e dell'inizio dell'uomo, creato dalla terra.", "mountains at dawn with birds in flight"),
 (39, "Un invito a rivolgersi sinceramente a Dio solo. Descrive le persone condotte a gruppi, nel giorno finale, ciascuna verso il proprio destino.", "two arched gates with flocks of doves"),
 (40, "Parla di Dio che perdona le colpe e accoglie il pentimento; racconta di un credente che difese Mosè presso il faraone.", "an open lock with a large key and light"),
 (41, "Il Corano è un libro con versetti spiegati chiaramente, in arabo, per chi vuole capire. Parla anche dei segni dentro di noi.", "a closed book with fine radiating lines of light"),
 (42, "Sul consultarsi tra credenti e sul perdono: chi perdona e rimedia ha la sua ricompensa. Il messaggio dei profeti è lo stesso.", "a circle of seven lanterns around a central star"),
 (43, "Ricorda che l'oro e gli ornamenti sono beni passeggeri; riprende le storie di Abramo, di Mosè e di Gesù.", "a golden necklace with geometric patterns"),
 (44, "Parla di una notte benedetta in cui il Corano scese, di un popolo messo alla prova e dell'avvertimento di un fumo che copre il cielo.", "swirling smoke rising among stars"),
 (45, "Invita a osservare i segni nella natura, l'alternarsi di notte e giorno, e ricorda che ognuno risponde delle proprie azioni.", "a bowed palm tree in a swirling wind"),
 (46, "Si apre con la creazione e ricorda il popolo di Ad, che viveva tra le dune. Parla anche dei genitori e della gratitudine verso di loro.", "sand dunes with wind ripples and a crescent"),
 (47, "Parla della fermezza nella prova e dell'impegno della comunità; descrive il giardino promesso, con fiumi di acqua pura, di latte e di miele.", "a garden with streams of clear water"),
 (48, "La pace di Hudaybiyya come una vittoria evidente: la calma scende nei cuori di chi si affida a Dio.", "an olive branch with a laurel wreath and a gate opening"),
 (49, "Poche regole di buona educazione: rispetto, verificare le notizie, evitare scherno e maldicenze, riconciliare chi è in lite.", "a small house facade with an arched window and a wall lantern"),
 (50, "Una riflessione sulla vita e sul ritorno: la terra che rinasce dopo la pioggia e Dio che è più vicino all'uomo di quanto egli stesso sappia.", "rain falling on a valley turning green"),
 (51, "Si apre con i venti che spargono e la promessa di un futuro certo; ricorda gli ospiti di Abramo e le storie di popoli passati.", "swirling wind lines carrying seeds and small clouds"),
 (52, "Giura sul monte Sinai, sul libro e sul tempio frequentato: un richiamo a una verità vicina e a una ricompensa per chi ha creduto.", "a mountain peak with a rising star"),
 (53, "Parla della visione del Profeta e della verità di ciò che vide; invita a non seguire congetture e ricorda che ognuno è responsabile.", "a single star setting with radiating lines"),
 (54, "Si apre con la luna che si spezza e ricorda i popoli passati; un ritornello ripete che il Corano è stato reso facile da ricordare.", "a full golden moon with one clean vertical crack of radiant light splitting it into two halves, set in a deep night sky"),
 (55, "Un lungo elenco dei doni di Dio, con un ritornello che invita a riconoscerli uno per uno. Descrive due giardini.", "two pomegranates and a date palm with two streams"),
 (56, "Parla dell'evento inevitabile e della distinzione delle persone in tre gruppi, con i doni della vita eterna per i vicini a Dio.", "an hourglass with falling sand and a star"),
 (57, "Si apre con la lode di Dio e parla del ferro, simbolo di forza e di utilità; invita a donare e a non attaccarsi ai beni.", "an anvil with a hammer, iron ingots and sparks"),
 (58, "Parla di una donna che espose il suo problema al Profeta e fu ascoltata, e di regole di cortesia nelle riunioni.", "two olive branches facing each other above a scale"),
 (59, "Riflette sull'esilio di una tribù e sulla distribuzione dei beni; si chiude con i nomi più belli di Dio.", "a fortress wall with towers beside a palm grove"),
 (60, "Parla dei rapporti con chi non la pensa come noi: giustizia, lealtà e correttezza dei patti, con l'esempio di Abramo.", "a signet ring with a rosette seal"),
 (61, "Invita a essere compatti e coerenti con ciò che si dice, come una costruzione solida; ricorda Mosè e Gesù.", "a firm wall of regular bricks with a star"),
 (62, "Sulla preghiera del venerdì: lasciare il commercio al momento della chiamata e poi tornare al lavoro ricordando Dio.", "mosque pulpit steps with a hanging lamp"),
 (63, "Descrive la doppiezza di chi dice una cosa e ne pensa un'altra; invita a non lasciare che beni e figli distolgano dal ricordo di Dio.", "a cracked mirror beside a candle"),
 (64, "Parla di ciò che si guadagna e si perde nella vita: la famiglia e i beni come prova, e l'invito a donare e a perdonare.", "a balance scale with coins and a fruit"),
 (65, "Regole sul periodo di attesa dopo la separazione, con l'invito a trattarsi con giustizia e a confidare in Dio.", "a circle of moon phases"),
 (66, "Riguarda il comportamento in famiglia e l'invito al pentimento sincero; ricorda due donne esemplari: la moglie del faraone e Maria.", "a honey jar with a honeycomb dipper"),
 (67, "Contempla la sovranità di Dio sul mondo, i cieli in armonia e la creazione della vita e della morte. È una delle Sure più lette la sera.", "seven nested arches under a starry canopy"),
 (68, "Si apre con il calamo e ciò che si scrive; elogia la grandezza del carattere del Profeta e racconta degli abitanti di un giardino.", "a reed pen and an inkwell, no writing"),
 (69, "Parla dell'evento inevitabile e del libro delle azioni consegnato a ciascuno, a destra o a sinistra.", "a single beam of light piercing heavy clouds over a plain"),
 (70, "Descrive il giorno lungo cinquantamila anni e l'inquietudine dell'uomo; elogia chi è costante nella preghiera.", "a stairway of light rising through clouds"),
 (71, "Il racconto di Noè: anni di invito al suo popolo, la preghiera per i credenti e la promessa del perdono.", "a wooden ark on calm waves under a clearing sky"),
 (72, "Un gruppo di geni ascolta il Corano e lo riconosce; ognuno è responsabile di ciò che crede.", "a flame inside an ornate lantern with swirling smokeless fire"),
 (73, "Un invito a vegliare di notte, a recitare con calma e a confidare in Dio; poi alleggerisce l'impegno: si reciti quanto è facile.", "a folded wool blanket beside a candle and a moon"),
 (74, "Uno degli inizi della rivelazione: l'invito ad alzarsi e ad avvertire, la cura della purezza, la pazienza, la consapevolezza delle proprie azioni.", "a folded dark-blue cloak resting on a smooth stone, beneath one bright morning star, no human shape"),
 (75, "Parla del giorno della risurrezione, della coscienza dell'uomo e della fragilità del suo inizio.", "a seed sprouting from dry earth under a rising sun"),
 (76, "Racconta dell'essere umano creato da una goccia e dei suoi doni, e descrive la ricompensa dei giusti con coppe e giardini.", "a silver cup beside a spring with a ginger plant"),
 (77, "Giura sui venti e sui messaggi e ripete, come un ritornello, l'avvertimento per chi smentisce.", "wind-swept clouds racing over a dark plain"),
 (78, "Parla del grande annuncio: la risurrezione. Richiama la terra, i monti, il sonno, la notte come mantello, il sole come lampada.", "a luminous dawn breaking over layered mountain ridges, with a single bright star above and soft rays"),
 (79, "Descrive il giorno in cui tutto si scuote e ricorda Mosè davanti al faraone; invita al timore e al dominio di sé.", "swift wind swirls with shooting stars"),
 (80, "Un rimprovero gentile per aver trascurato chi veniva in cerca di guida; richiama i doni del cibo e della terra.", "a lamp turning its light toward a sapling"),
 (81, "Descrive il sole che si spegne, le stelle che cadono, i monti che si muovono: un cielo che cambia nel giorno del giudizio.", "a dimmed sun with falling stars"),
 (82, "Scene di un cielo che si spacca e di mari che traboccano; ricorda che gli angeli annotano ciò che facciamo.", "a cracked sky with scattered stars"),
 (83, "Rimprovera chi pesa e misura frodando; parla del libro dei giusti e di chi, tra i credenti, veniva deriso dai trasgressori.", "a scale with unequal pans"),
 (84, "Il cielo si fende, la terra si spiana e ognuno riceve il suo libro: un invito a procedere verso il Signore con sforzo costante.", "a ribbon of light parting an opening sky"),
 (85, "Si apre con il cielo delle costellazioni e ricorda la prova di chi fu perseguitato per la fede, con una speranza che resta.", "an arc of constellations in a star map"),
 (86, "Un giuramento sul cielo e sull'astro notturno: ogni anima ha un custode. Ricorda l'origine umile dell'uomo.", "a bright star piercing the night"),
 (87, "Una lode all'Altissimo che ha creato con misura e guidato; parla dell'erba che spunta e di purificarsi.", "grass sprouting under a high sun"),
 (88, "Contrappone due condizioni: volti stanchi e volti sereni, in un giardino dove scorre una fonte e ci sono cuscini disposti.", "a cool spring garden with arranged cushions"),
 (89, "Giura sull'alba e sulle dieci notti e parla dei popoli che si ribellarono; finisce con l'invito all'anima serena.", "a sunrise over the horizon with ten glowing rays"),
 (90, "Parla della fatica come parte della vita e dell'invito a liberare chi è prigioniero, a nutrire l'orfano e il povero.", "a city gate on a hill with two paths"),
 (91, "Giura sul sole, la luna, il giorno, la notte e l'anima: chi la purifica riesce, chi la trascura fallisce.", "a sun and a moon side by side"),
 (92, "Il contrasto tra due modi di vivere: chi dona e teme Dio avrà facilità, chi trattiene avrà difficoltà. Giura sulla notte.", "a half moon and a day and night disc"),
 (93, "Dopo un periodo di silenzio, Dio rassicura il Profeta: non ti ha abbandonato; ricorda l'orfano, il povero, i doni ricevuti.", "morning sun rays over a calm landscape"),
 (94, "Una breve consolazione: il petto si dilata e il peso viene tolto; ogni difficoltà è accompagnata da una facilità.", "a blossom opening with a ray of light"),
 (95, "Giura sul fico, sull'olivo e sul monte Sinai: l'uomo è stato creato nella forma migliore, e chi crede e fa il bene ha una ricompensa.", "a fig and an olive branch crossed above a mountain"),
 (96, "Le prime parole rivelate: l'invito a leggere, e il ricordo che Dio insegna con il calamo e insegna all'uomo ciò che non sapeva.", "a reed pen beside a blank glowing tablet"),
 (97, "La notte del destino, migliore di mille mesi, in cui il Corano scese. Parla di pace fino all'alba.", "a luminous night sky with descending beams of light"),
 (98, "Parla del messaggio chiaro arrivato alla gente del Libro e ai non credenti; descrive la religione pura come adorare Dio sinceramente.", "a seal stamp beside a lamp"),
 (99, "Il giorno in cui la terra trema e racconta ciò che ha visto; ognuno vedrà il bene e il male, anche un atomo di entrambi.", "cracked earth with a tiny seed and a balance"),
 (100, "Giura su cavalli che galoppano e sollevano polvere al mattino; richiama l'uomo alla gratitudine verso il suo Signore.", "a galloping horse with a cloud of dust"),
 (101, "Un colpo che desta: il giorno in cui gli uomini saranno come falene sparse; ciò che peserà sarà il bene compiuto.", "scattered moths around a soft light in the night"),
 (102, "Richiama la corsa a possedere di più, finché non si visitano le tombe; invita a riflettere sulla vera ricchezza.", "heaps of coins beside a dry tree"),
 (103, "Tre versetti sul tempo: l'uomo è in perdita, salvo chi crede, fa il bene e si esorta alla verità e alla pazienza.", "an hourglass above a setting sun"),
 (104, "Un rimprovero a chi sparla e a chi accumula ricchezze credendo che gli dureranno per sempre.", "a net filled with coins"),
 (105, "Racconta la storia dell'esercito con gli elefanti che voleva distruggere la Kaaba e fu fermato da uccelli in stormo.", "an elephant in an ornate cloth with birds in flight above"),
 (106, "Ricorda i viaggi di inverno e di estate dei Coreisciti e invita a servire il Signore di questa casa che li nutre e protegge.", "a caravan of camels on summer and winter paths"),
 (107, "Rimprovera chi respinge l'orfano e non incoraggia a nutrire il povero: la fede si vede nei piccoli gesti di aiuto.", "a simple bowl, a loaf and a pot"),
 (108, "La Sura più breve: un dono abbondante per il Profeta e l'invito a pregare e a offrire.", "a flowing river with water lilies"),
 (109, "Distingue con chiarezza il proprio culto da quello altrui e si chiude con la pace di chi segue ciascuno la propria strada.", "two diverging roads between a sun and a moon"),
 (110, "Annuncia l'arrivo dell'aiuto e della vittoria e le persone che entrano a gruppi nella fede; invita a lodare e a chiedere perdono.", "wide-open gates with a laurel wreath and a sunrise"),
 (111, "Riguarda uno degli oppositori del Profeta e sua moglie; la fine di chi si oppone con ostilità e orgoglio.", "a twisted rope of palm fibre beside a flame"),
 (112, "Quattro versetti sull'unicità di Dio: Egli è uno, l'Assoluto a cui tutto si rivolge; non genera, non è generato, e nulla Gli è simile.", "a perfect single circle with a radiating point and a geometric star"),
 (113, "Una preghiera di rifugio presso il Signore dell'alba dal male delle creature, dalla notte e dall'invidia.", "dawn breaking through the night over a horizon"),
 (114, "Una preghiera di rifugio presso il Signore degli uomini, dal sussurro che si nasconde e si ritrae.", "concentric circles forming a shield with a crescent"),
]

# Proposte per momento della giornata (stesse fasce del saluto: 5-12, 12-18, 18-22, 22-5). Neutre: tema e ritmo, non regole.
# Con una voce a selezione protetta (Afasy) il lettore mostra solo le Sure che esistono con quella voce.
MOMENTI = {
    "mattino": {"titolo": "Per il mattino", "testo": "Sure di luce e di speranza per iniziare la giornata.", "sure": [93, 94, 87, 91, 1]},
    "pomeriggio": {"titolo": "Per il pomeriggio", "testo": "Sure brevi e di riflessione, adatte a una pausa.", "sure": [103, 55, 95, 108]},
    "sera": {"titolo": "Per la sera", "testo": "Per chiudere la giornata con calma.", "sure": [36, 67, 55, 112, 113, 114]},
    "notte": {"titolo": "Per la notte", "testo": "Ritmo lento, per addormentarsi: meglio con il timer di spegnimento.", "sure": [67, 32, 19, 112, 113, 114]},
}

# ---------- stile D (scelto dall'utente l'8 novembre 2026): acquerello notturno con foglia d'oro ----------
STILE = (
    "Luminous gouache and watercolour painting with real gold-leaf accents, cold-press paper grain visible. "
    "Soft blended washes: {PALETTE}. "
    "Subject: {SOGGETTO}, softly lit, with gentle gold-leaf highlights and fine gold contour lines, and a scatter of tiny gold-leaf stars or sparkles. "
    "Everything sits inside one large circular moon-gate with a fine thin gold ring and, just outside it, a delicate band of a gold triangle-and-diamond lattice; "
    "outside the circle the same wash colours continue to the edges of the paper. "
    "Flat, front-facing, the artwork fills the whole square canvas edge to edge, with at most a very thin paper margin; no frame object, no table, no shadow. "
    "Serene, dignified, hand-painted, readable at thumbnail size (clear silhouette, strong central focus). "
    "Absolutely NO text, NO letters, NO calligraphy, NO numbers, NO people, NO faces, NO logos, NO watermark. Original artwork."
)

PALETTE = {
    "notte": "deep indigo at the top through midnight teal, with a pale pearl glow near the horizon",
    "mare": "deep navy at the top through turquoise-teal, with a pale sea-foam cream glow near the horizon",
    "giardino": "deep emerald green at the top through dark teal, with a pale warm gold glow near the horizon",
    "deserto": "deep violet-umber at the top through ochre and warm sand, with a pale apricot glow near the horizon",
    "alba": "deep plum-indigo at the top through rose and soft apricot, with a luminous pale gold glow near the horizon",
    "montagna": "slate blue-grey at the top through dusky lavender, with a pale silver glow near the horizon",
    "giudizio": "deep aubergine at the top through dark indigo, with a pale amber glow near the horizon (solemn but calm)",
}

# tema di colore di ogni Sura (a seconda del soggetto)
CLIMA = {}
for _k, _v in {
    "alba": [1, 9, 30, 35, 37, 39, 48, 70, 74, 75, 78, 84, 87, 89, 91, 93, 94, 110, 113],
    "deserto": [2, 8, 11, 15, 22, 33, 43, 45, 46, 59, 64, 66, 83, 90, 99, 100, 102, 103, 104, 105, 106, 107],
    "giardino": [3, 4, 5, 6, 14, 16, 19, 23, 27, 31, 34, 47, 50, 55, 58, 76, 80, 88, 95],
    "montagna": [7, 13, 18, 20, 38, 51, 52, 57, 61],
    "mare": [10, 28, 71, 108],
    "giudizio": [44, 56, 69, 77, 81, 82, 111],
    "notte": [12, 17, 21, 24, 25, 26, 29, 32, 36, 40, 41, 42, 49, 53, 54, 60, 62, 63, 65, 67, 68, 72, 73, 79, 85, 86, 92, 96, 97, 98, 101, 109, 112, 114],
}.items():
    for _n in _v:
        assert _n not in CLIMA, _n
        CLIMA[_n] = _k


def main():
    assert [n for n, _, _ in SURE] == list(range(1, 115)), "mancano o sono doppie delle Sure"
    info = {}
    for n, tema, _ in SURE:
        luogo = "" if n in DISCUSSE else ("Medina" if n in MEDINA else "Mecca")
        info[n] = {"l": luogo, "t": tema.replace("'", "’")}
    corpo = ",\n".join(f"  {n}: {json.dumps(v, ensure_ascii=False)}" for n, v in info.items())
    (RADICE / "js" / "sure_info.js").write_text(
        "/* Sakina – mini descrizioni delle 114 Sure. Le scrive tools/immagini/genera_dati.py: non modificarle qui.\n"
        "   l = luogo della rivelazione secondo l'elenco tradizionale (vuoto dove gli studiosi sono divisi); t = tema, in parole semplici. */\n"
        "window.Sakina = window.Sakina || {};\n"
        "window.Sakina.SureInfo = {\n" + corpo + "\n};\n"
        "/* Proposte per momento della giornata (mattino 5-12, pomeriggio 12-18, sera 18-22, notte 22-5). */\n"
        "window.Sakina.Momenti = " + json.dumps(MOMENTI, ensure_ascii=False, indent=1) + ";\n", encoding="utf-8")
    assert sorted(CLIMA) == list(range(1, 115)), "manca il tema di colore di qualche Sura"
    soggetti = {"_stile": STILE}
    for n, _, sj in SURE:
        k = CLIMA[n]
        soggetti[str(n)] = {"soggetto": sj, "tema": k, "prompt": STILE.format(PALETTE=PALETTE[k], SOGGETTO=sj)}
    (RADICE / "tools" / "immagini" / "soggetti.json").write_text(json.dumps(soggetti, ensure_ascii=False, indent=1), encoding="utf-8")
    print("scritti js/sure_info.js e tools/immagini/soggetti.json (114 Sure)")


if __name__ == "__main__":
    main()
