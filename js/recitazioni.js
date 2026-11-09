/* Sakina – lettore e interfaccia delle recitazioni coraniche (tradizione Hafs).
   Streaming immediato delle 114 Sure con 5 voci (alcune con una selezione ristretta di Sure),
   salvataggio selettivo offline nella Cache del browser e sottofondo leggero di natura
   (pioggia, onde, vento, ruscello) dal motore di js/audio.js. */
(function () {
  'use strict';

  var B = window.Sakina = window.Sakina || {};
  var D = B.QuranData;
  if (!D) return;

  var CACHE_NAME = 'sakina-recitazioni-v1';
  var OLD_CACHE_NAME = 'bonaccia-recitazioni-v1';   // le Sure salvate quando le recitazioni stavano dentro Bonaccia (stesso indirizzo, stessa memoria del browser)

  /* Due elementi audio. Quello «con livelli» passa dal motore audio (js/audio.js), che applica un guadagno
     per voce e per Sura (js/recitazioni_livelli.js) e un limitatore: porta tutte le registrazioni allo stesso livello.
     Quello «semplice» è un normale <audio>, usato se i livelli sono spenti o se il percorso con livelli non funziona. */
  var RECITERS = ['minshawi', 'basit', 'hussary', 'salimi', 'afasy'].filter(function (id) { return !!D.reciters[id]; });
  var elPlain = new Audio();
  elPlain.preload = 'none';
  var elRouted = new Audio();
  elRouted.preload = 'none';
  elRouted.crossOrigin = 'anonymous';
  var audioEl = elPlain;
  var routedFailed = false;
  var fallbackTrial = false;   // si sta provando l'audio semplice dopo un errore del percorso con livelli
  var playToken = 0;           // ogni avvio ha il suo numero: l'esito di un tentativo già sostituito si ignora
  var pendingSeek = null;
  var LV = B.QuranLevels || null;

  var state = {
    reciter: 'minshawi', // 'basit' | 'minshawi' | 'hussary'
    surah: 55,           // default: Ar-Rahman
    playing: false,
    bgPreset: 'nessuno', // 'nessuno' | 'pioggia' | 'vento' | 'onde' | 'ruscello'
    bgRel: -12,          // sottofondo: dB sotto il livello della voce
    leveling: true,      // pareggia il volume delle voci
    cachedUrls: {},      // url -> true
    filter: '',
    downloading: null,   // url currently downloading
    moreOpen: false,     // pannello «Sottofondo e offline» aperto
    endMode: 'stop',     // a fine Sura: 'stop' | 'next' | 'repeat'
    sleepMin: 0,         // timer di spegnimento (minuti, 0 = nessuno)
    sleepEnd: 0,         // istante di spegnimento (ms), 0 = non ancora partito
    loading: false,      // in attesa dei primi dati dalla rete
    scrub: false         // si sta trascinando la barra
  };

  /* Carica preferenze salvate */
  try {
    var saved = localStorage.getItem('sakina.settings') || localStorage.getItem('bonaccia.quran_settings');   // la seconda: impostazioni fatte dentro Bonaccia
    if (saved) {
      var parsed = JSON.parse(saved);
      if (typeof parsed.reciter === 'string' && Object.prototype.hasOwnProperty.call(D.reciters, parsed.reciter)) state.reciter = parsed.reciter;
      var sn = parseInt(parsed.surah, 10);
      if (sn >= 1 && sn <= D.surahs.length) state.surah = sn;
      if (['nessuno', 'pioggia', 'vento', 'onde', 'ruscello'].indexOf(parsed.bgPreset) >= 0) state.bgPreset = parsed.bgPreset;
      if (typeof parsed.bgRel === 'number') state.bgRel = Math.max(-24, Math.min(-4, parsed.bgRel));
      if (typeof parsed.leveling === 'boolean') state.leveling = parsed.leveling;
      if (parsed.endMode === 'next' || parsed.endMode === 'repeat') state.endMode = parsed.endMode;
    }
  } catch (e) {}

  /* Sure escluse dall'utente («Su Sakina» → Sure escluse), per una voce o per tutte. Reversibili.
     Con quella voce una Sura esclusa sparisce da elenco, ricerca, consigliate, precedente/successiva, «Alla fine» e coda;
     le proposte del giorno la offrono con un'altra voce. Una voce non resta mai senza Sure. */
  var ESCL_KEY = 'sakina.escluse';
  var escluse = {};          // { tutte: [n…], minshawi: [n…], … }
  var exclMap = {};          // voce -> { n: true }
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function cleanNums(a) {
    var out = [], seen = {};
    if (!Array.isArray(a)) return out;
    a.forEach(function (x) { var n = Number(x); if (n % 1 === 0 && n >= 1 && n <= D.surahs.length && !seen[n]) { seen[n] = true; out.push(n); } });
    return out.sort(function (x, y) { return x - y; });
  }
  try {
    var es = JSON.parse(localStorage.getItem(ESCL_KEY) || '{}');
    if (es && typeof es === 'object') ['tutte'].concat(RECITERS).forEach(function (k) { if (own(es, k)) { var l = cleanNums(es[k]); if (l.length) escluse[k] = l; } });
  } catch (e) {}
  function exclFor(rid, src) {     // le escluse di una voce; nessuna se toglierebbero tutte le sue Sure
    var m = {};
    (src.tutte || []).concat(src[rid] || []).forEach(function (n) { m[n] = true; });
    return baseSurahs(rid).some(function (x) { return !m[x.n]; }) ? m : {};
  }
  function voceSenzaSure(src) {    // la prima voce che resterebbe senza Sure con queste esclusioni
    for (var i = 0; i < RECITERS.length; i++) {
      var rid = RECITERS[i], m = {};
      (src.tutte || []).concat(src[rid] || []).forEach(function (n) { m[n] = true; });
      if (!baseSurahs(rid).some(function (x) { return !m[x.n]; })) return rid;
    }
    return null;
  }
  function rebuildExcl() { exclMap = {}; RECITERS.forEach(function (rid) { exclMap[rid] = exclFor(rid, escluse); }); }
  rebuildExcl();

  /* Coda e liste di riproduzione: ogni elemento è una Sura con la sua voce. Restano nel telefono. */
  var CODA_KEY = 'sakina.coda', LISTE_KEY = 'sakina.liste', MAX_ITEMS = 200, MAX_LISTE = 40;
  function cleanItem(x) {
    if (!x || typeof x !== 'object') return null;
    var n = Number(x.n);
    if (!(n % 1 === 0 && n >= 1 && n <= D.surahs.length)) return null;
    if (typeof x.voice !== 'string' || RECITERS.indexOf(x.voice) < 0) return null;
    return { n: n, voice: x.voice };
  }
  function cleanItems(a) { return Array.isArray(a) ? a.map(cleanItem).filter(Boolean).slice(0, MAX_ITEMS) : []; }
  function cleanNome(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, 40); }
  function newId() {
    var id;
    do { id = 'l' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); } while (liste.some(function (l) { return l.id === id; }));
    return id;
  }
  var coda = { items: [], pos: -1, ripeti: false };   // pos: l'elemento suonato per ultimo dalla coda (-1: nessuno)
  var liste = [];
  try {
    var cs = JSON.parse(localStorage.getItem(CODA_KEY) || 'null');
    if (cs && typeof cs === 'object') {
      coda.items = cleanItems(cs.items);
      var cp = Number(cs.pos);
      coda.pos = (cp % 1 === 0 && cp >= -1 && cp < coda.items.length) ? cp : -1;
      coda.ripeti = cs.ripeti === true;
    }
  } catch (e) {}
  try {
    var ls = JSON.parse(localStorage.getItem(LISTE_KEY) || '[]');
    if (Array.isArray(ls)) ls.slice(0, MAX_LISTE).forEach(function (l, i) {
      if (!l || typeof l !== 'object') return;
      var id = (typeof l.id === 'string' && /^[a-z0-9]{1,24}$/.test(l.id) && !liste.some(function (x) { return x.id === l.id; })) ? l.id : newId();
      liste.push({ id: id, nome: cleanNome(l.nome) || ('Lista ' + (i + 1)), items: cleanItems(l.items) });
    });
  } catch (e) {}

  if (!isAllowed(state.reciter, state.surah)) state.surah = reciterSurahs(state.reciter)[0].n;

  function saveSettings() {
    try {
      localStorage.setItem('sakina.settings', JSON.stringify({
        reciter: state.reciter,
        surah: state.surah,
        bgPreset: state.bgPreset,
        bgRel: state.bgRel,
        leveling: state.leveling,
        endMode: state.endMode
      }));
    } catch (e) {}
  }

  function getSurah(n) {
    for (var i = 0; i < D.surahs.length; i++) {
      if (D.surahs[i].n === n) return D.surahs[i];
    }
    return D.surahs[0];
  }

  /* Sure che esistono con un recitatore: se ha «surahs», solo quelle (selezione protetta, vedi recitazioni_data.js) */
  function baseSurahs(rid) {
    var r = D.reciters[rid];
    if (!r || !r.surahs) return D.surahs;
    return D.surahs.filter(function (s) { return r.surahs.indexOf(s.n) >= 0; });
  }
  /* …tolte quelle che l'utente ha escluso con quella voce */
  function reciterSurahs(rid) {
    var m = exclMap[rid] || {};
    return baseSurahs(rid).filter(function (s) { return !m[s.n]; });
  }
  function isAllowed(rid, n) {
    var r = D.reciters[rid];
    if (!r || !own(D.reciters, rid) || typeof n !== 'number' || n % 1 !== 0 || n < 1 || n > D.surahs.length) return false;
    return (!r.surahs || r.surahs.indexOf(n) >= 0) && !(exclMap[rid] || {})[n];
  }
  /* Sura ammessa più vicina nella direzione data (anche se quella di partenza non è più ammessa) */
  function neighbour(n, dir) {
    for (var k = n + dir; k >= 1 && k <= D.surahs.length; k += dir) if (isAllowed(state.reciter, k)) return k;
    return null;
  }
  function isRecommended(rid, s) {
    var r = D.reciters[rid];
    return s.cons || !!(r && r.cons && r.cons.indexOf(s.n) >= 0);
  }
  function surahNote(rid, s) {
    var r = D.reciters[rid];
    return (r && r.note && r.note[s.n]) || s.nota || '';
  }

  /* Immagine, luogo e mini descrizione di ogni Sura (js/sure_info.js, immagini in img/sure/). Se manca un'immagine, la scheda resta com'è. */
  var SI = B.SureInfo || {};
  var MOM = B.Momenti || {};
  /* Momento della giornata (le stesse fasce del saluto): mattino 5-12, pomeriggio 12-18, sera 18-22, notte 22-5. */
  function dayPart(d) {
    var h = (d || new Date()).getHours();
    return h >= 5 && h < 12 ? 'mattino' : (h >= 12 && h < 18 ? 'pomeriggio' : (h >= 18 && h < 22 ? 'sera' : 'notte'));
  }
  B.dayPart = dayPart;

  /* Ricorrenze: il giorno islamico comincia al tramonto (ora indicativa in Italia, per mese: Sakina.Ricorrenze.tramonto).
     Le date lunari le dà il telefono (calendario Umm al-Qura); se il browser non lo conosce, restano solo il venerdì e le proposte dell'ora. */
  var RIC = B.Ricorrenze || null;
  function afterSunset(d) {
    var t = ((RIC && RIC.tramonto[d.getMonth()]) || '18:00').split(':');
    return d.getHours() * 60 + d.getMinutes() >= parseInt(t[0], 10) * 60 + parseInt(t[1], 10);
  }
  var hijriFmt = null;
  try {
    var hf = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric' });
    if (/^islamic/.test(hf.resolvedOptions().calendar)) hijriFmt = hf;
  } catch (e) {}
  function hijri(d) {
    if (!hijriFmt) return null;
    var x = new Date(d.getTime());
    if (afterSunset(d)) x.setDate(x.getDate() + 1);          // dopo il tramonto è già il giorno islamico seguente
    var o = {};
    try { hijriFmt.formatToParts(x).forEach(function (p) { if (p.type === 'day' || p.type === 'month') o[p.type] = parseInt(p.value, 10); }); } catch (e) { return null; }
    return o.day && o.month ? o : null;
  }
  /* Ricorrenze attive in questo momento, in ordine: notte dispari, feste, venerdì, Ramadan */
  function activeEvents(d) {
    d = d || new Date();
    var V = (RIC && RIC.voci) || {}, h = hijri(d), sera = afterSunset(d), wd = d.getDay(), ids = [];
    if (h && h.month === 9 && h.day >= 21 && h.day % 2 === 1 && (sera || d.getHours() < 5)) ids.push('notte_destino');
    if (h && h.month === 10 && h.day <= 3) ids.push('fitr');
    if (h && h.month === 12 && h.day >= 10 && h.day <= 13) ids.push('adha');
    if ((wd === 4 && sera) || (wd === 5 && !sera)) ids.push('venerdi');
    if (h && h.month === 9) ids.push('ramadan');
    return ids.filter(function (k) { return V[k]; }).map(function (k) {
      var v = V[k];
      return { id: k, titolo: (k === 'venerdi' && wd === 4 && v.titolo_vigilia) ? v.titolo_vigilia : v.titolo, testo: v.testo, sure: v.sure, nota: v.nota || '', saluto: v.saluto || '' };
    });
  }
  B.activeEvents = activeEvents;
  function coverUrl(s) { return 'img/sure/' + s.pad + '.webp'; }
  function thumbHtml(s) {
    return '<span class="q-th"><span class="q-badge-num">' + s.n + '</span><img class="q-thumb" src="img/sure/t/' + s.pad + '.webp" alt="" width="52" height="52" loading="lazy" decoding="async"></span>';
  }
  function placeLine(s) {
    var i = SI[s.n] || {};
    return (i.l ? 'Rivelata a ' + i.l + ' · ' : '') + s.ayahs + (s.ayahs === 1 ? ' versetto' : ' versetti');
  }
  /* un'immagine che non si carica sparisce senza lasciare un buco (l'evento error non risale: lo si ascolta in cattura) */
  document.addEventListener('error', function (e) {
    var t = e.target;
    if (!t || t.tagName !== 'IMG') return;
    if (t.classList.contains('q-thumb') || t.classList.contains('q-dock-thumb')) t.style.display = 'none';
    else if (t.classList.contains('q-cover-img')) { var f = t.closest('.q-cover'); if (f) f.hidden = true; }
  }, true);

  function getAudioUrl(reciterId, surahPad) {
    var r = D.reciters[reciterId];
    if (!r) return '';
    return r.baseUrl + surahPad + '.mp3';
  }

  /* Controllo cache offline */
  async function checkCached(url) {
    if (!('caches' in window)) return false;
    try {
      var c = await caches.open(CACHE_NAME);
      var m = await c.match(url);
      return !!m;
    } catch (e) {
      return false;
    }
  }

  /* Le Sure salvate offline dentro Bonaccia passano nella memoria di Sakina (una volta sola, in silenzio), poi la vecchia si svuota. */
  async function migrateOldCache() {
    if (!('caches' in window)) return;
    try {
      if (!(await caches.has(OLD_CACHE_NAME))) return;
      var oldC = await caches.open(OLD_CACHE_NAME), newC = await caches.open(CACHE_NAME);
      var keys = await oldC.keys(), ok = true;
      for (var i = 0; i < keys.length; i++) {
        try {
          if (!(await newC.match(keys[i]))) { var hit = await oldC.match(keys[i]); if (hit) await newC.put(keys[i], hit); }
        } catch (e) { ok = false; }
      }
      if (ok) await caches.delete(OLD_CACHE_NAME);
    } catch (e) {}
  }

  async function updateCacheIndex() {
    if (!('caches' in window)) return;
    try {
      var c = await caches.open(CACHE_NAME);
      var keys = await c.keys();
      state.cachedUrls = {};
      keys.forEach(function (k) {
        state.cachedUrls[k.url] = true;
      });
      renderOfflineBadges();
    } catch (e) {}
  }

  async function toggleOffline(surahN, btnEl) {
    if (!('caches' in window)) {
      alert('La memoria offline non è supportata da questo browser.');
      return;
    }
    var s = getSurah(surahN);
    var url = getAudioUrl(state.reciter, s.pad);
    var isSaved = !!state.cachedUrls[url];

    try {
      var c = await caches.open(CACHE_NAME);
      if (isSaved) {
        if (!confirm('Vuoi rimuovere "' + s.nome + '" dallo spazio offline del telefono?')) return;
        await c.delete(url);
        delete state.cachedUrls[url];
        if (btnEl) btnEl.textContent = '📥 Salva offline';
        renderPlayerCard();
        renderOfflineBadges();
      } else {
        if (btnEl) {
          btnEl.disabled = true;
          btnEl.textContent = 'Scaricamento in corso...';
        }
        state.downloading = url;
        try {   // file enormi (Al-Baqarah di Salimi: 269 MB) non si tengono in memoria sul telefono
          var head = await fetch(url, { method: 'HEAD' });
          var size = parseInt(head.headers.get('content-length') || '0', 10);
          if (size > 100 * 1024 * 1024) {
            state.downloading = null;
            if (btnEl) { btnEl.disabled = false; btnEl.textContent = '📥 Salva sul telefono (ascolto offline)'; }
            alert('Questa Sura è troppo grande per essere salvata sul telefono (' + Math.round(size / 1048576) + ' MB). Si ascolta solo in streaming.');
            renderPlayerCard();
            return;
          }
        } catch (e) { /* senza HEAD si prova comunque */ }
        var res = await fetch(url);
        if (!res.ok) throw new Error('Errore di rete: ' + res.status);
        await c.put(url, res);
        state.cachedUrls[url] = true;
        state.downloading = null;
        if (btnEl) {
          btnEl.disabled = false;
          btnEl.textContent = '✓ Salvato offline';
        }
        renderPlayerCard();
        renderOfflineBadges();
      }
    } catch (err) {
      state.downloading = null;
      if (btnEl) {
        btnEl.disabled = false;
        btnEl.textContent = '📥 Salva offline';
      }
      alert('Impossibile scaricare la Sura. Verifica la connessione a Internet.');
    }
  }

  /* Livelli */
  function levelDb(rid, n) {
    if (!LV) return 0;
    var g = LV.gain && LV.gain[rid] && LV.gain[rid][n];
    if (typeof g === 'number') return g;
    return (LV.predefinito && LV.predefinito[rid]) || 0;
  }

  function wantRouted() {
    return state.leveling && !routedFailed && !!LV && !!B.Engine && B.Engine.supported;
  }

  function pickElement() {
    var next = elPlain;
    if (wantRouted()) {
      if (B.Engine.attachMedia(elRouted)) next = elRouted; else routedFailed = true;
    }
    if (next !== audioEl) {
      var old = audioEl;
      audioEl = next;       // da qui gli eventi del vecchio elemento vengono ignorati
      try { old.pause(); } catch (e) {}
    }
  }

  function applyLevel(immediate) {
    if (audioEl === elRouted && B.Engine) B.Engine.setMediaGainDb(levelDb(state.reciter, state.surah), immediate);
  }

  /* Gestione audio e mix */
  /* Livello (LUFS) di ogni atmosfera con il volume generale a 0 dB: calcolato dai guadagni del motore e corretto
     con una misura del livello in uscita in Chrome (vedi docs/analisi_suoni.md). Serve a tenere il sottofondo a una distanza fissa dalla voce. */
  var BG_REF = { pioggia: -13.6, onde: -13.0, ruscello: -15.9, vento: -16.9 };   // tarati con una misura in Chrome (RMS in uscita)

  function bgMaster() {
    var ref = BG_REF[state.bgPreset] != null ? BG_REF[state.bgPreset] : -15;
    var target = (LV ? LV.obiettivo : -18) + state.bgRel;      // LUFS voluti per il sottofondo
    var db = target - ref;                                       // volume generale in dB
    return Math.max(0.02, Math.min(1, (db + 54) / 51));          // inverso di masterCurve in audio.js
  }

  /* Gli strati del motore che compongono ogni sottofondo. */
  var BG_LAYERS = {
    pioggia: { rain: { on: true, vol: 0.8 } },
    onde: { waves: { on: true, vol: 0.85 } },
    ruscello: { stream: { on: true, vol: 0.8 } },
    vento: { wind: { on: true, vol: 0.8 }, stream: { on: true, vol: 0.18 } }
  };

  function syncBackgroundSound(start) {
    var E = B.Engine;
    if (!E) return;
    if (state.bgPreset === 'nessuno' || !start || !BG_LAYERS[state.bgPreset]) {
      if (B._quranBgActive) {
        B._quranBgActive = false;
        E.stop(1.5);
        applyMediaSession();     // per sicurezza i comandi della schermata di blocco restano quelli della recitazione
      }
      return;
    }
    B._quranBgActive = true;
    E.setLayers(BG_LAYERS[state.bgPreset]);
    E.setMaster(bgMaster());
    if (!E.playing) E.start(2);
  }

  function applyMediaSession(s) {
    if (!('mediaSession' in navigator)) return;
    s = s || getSurah(state.surah);
    var r = D.reciters[state.reciter];
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: s.n + '. ' + s.nome + ' (' + s.trad + ') - ' + s.ar,
        artist: r.nome + ' (' + (r.stile ? r.stile.replace(/ \(studio\)/, '') : 'Hafs') + ')',
        album: 'Recitazioni coraniche - Sakina',
        // immagine della Sura sulla schermata di blocco e nel centro di controllo (JPEG: il WebP non è sicuro su iOS); senza file, il sistema usa l'icona dell'app
        artwork: [{ src: new URL('img/sure/art/' + s.pad + '.jpg', location.href).href, sizes: '512x512', type: 'image/jpeg' }]
      });
    } catch (e) {}
    function azione(nome, fn) { try { navigator.mediaSession.setActionHandler(nome, fn); } catch (e) {} }   // un browser può non supportarla
    azione('play', function () { playSurah(state.surah); });
    azione('pause', function () { audioEl.pause(); });
    azione('seekbackward', function () { skip(-15); });
    azione('seekforward', function () { skip(15); });
    azione('previoustrack', function () { goPrev(); });
    azione('nexttrack', function () { goNext(); });
    azione('seekto', function (d) {
      if (d && typeof d.seekTime === 'number' && audioEl.duration) audioEl.currentTime = Math.max(0, Math.min(audioEl.duration, d.seekTime));
    });
  }

  function playSurah(n, seekTo) {
    if (!isAllowed(state.reciter, n)) return;      // selezione protetta: nessuna Sura fuori elenco parte mai
    var s = getSurah(n);
    state.surah = n;
    saveSettings();

    pickElement();
    var url = getAudioUrl(state.reciter, s.pad);
    if (audioEl.src !== url) {
      audioEl.src = url;
    }
    if (typeof seekTo === 'number') pendingSeek = seekTo;
    audioEl.volume = 1;          // dopo una dissolvenza del timer (dove il volume si può regolare)
    applyLevel(true);
    applyMediaSession(s);
    state.loading = true;
    syncTransport();
    renderActiveItem();

    var token = ++playToken;
    var p = audioEl.play();
    if (p && p.then) {
      p.then(function () {
        if (token !== playToken) return;
        state.playing = true;
        syncBackgroundSound(true);
        applyMediaSession(s);
        renderPlayerCard();
        renderActiveItem();
      }).catch(function (err) {
        if (token !== playToken) return;               // un tentativo più recente ha preso il posto di questo
        if (err && err.name === 'AbortError') return;   // pausa o cambio Sura durante il caricamento
        if (audioEl === elRouted && !routedFailed) {   // il percorso con livelli non parte: si prova l'audio semplice
          routedFailed = true;
          fallbackTrial = true;
          playSurah(n, seekTo);
          return;
        }
        if (fallbackTrial) { routedFailed = false; fallbackTrial = false; }   // falliva anche l'audio semplice: era la rete, non i livelli
        state.playing = false;
        state.loading = false;
        renderPlayerCard();
        alert('Non è stato possibile avviare la recitazione. Controlla la connessione.');
      });
    }
  }

  /* Svuota l'elemento audio (cambio di voce o di Sura senza avviare l'ascolto): niente tempi del brano precedente */
  function resetMedia() {
    try { audioEl.pause(); audioEl.removeAttribute('src'); audioEl.load(); } catch (e) {}
    // load() annulla l'evento 'pause' in coda: lo stato si aggiorna qui
    state.playing = false;
    state.loading = false;
    syncBackgroundSound(false);
    if (B.Engine) B.Engine.mediaActive(false);
  }

  function togglePlay() {
    if (state.playing || state.loading) {
      audioEl.pause();            // l'evento 'pause' aggiorna lo stato e ferma il sottofondo
    } else {
      playSurah(state.surah);
    }
  }

  /* Sura precedente e successiva */
  function goNext() {
    var qi = codaNext();
    if (qi >= 0) { playCodaAt(qi); return; }       // la coda ha la precedenza
    var n = neighbour(state.surah, 1);
    if (n) playSurah(n);
  }
  function goPrev() {
    if (audioEl.currentTime > 5) { audioEl.currentTime = 0; return; }
    var n = neighbour(state.surah, -1);
    if (n) playSurah(n);
  }

  function skip(delta) {
    if (!audioEl.duration) return;
    audioEl.currentTime = Math.max(0, Math.min(audioEl.duration, audioEl.currentTime + delta));
  }

  /* Lettore compatto fisso in basso: resta a portata di pollice mentre si scorre l'elenco */
  var ICON_PLAY = '<svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>';
  var ICON_PAUSE = '<svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
  var ICON_BWD = '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M12.5 8c-3.1 0-5.8 1.9-6.9 4.7l-2.1-2.1V16h5.4L6.8 13.9c.9-2.2 3-3.9 5.7-3.9 3.3 0 6 2.7 6 6s-2.7 6-6 6c-1.7 0-3.2-.7-4.2-1.8l-1.4 1.4c1.4 1.5 3.4 2.4 5.6 2.4 4.4 0 8-3.6 8-8s-3.6-8-8-8z" fill="currentColor"/><text x="12" y="17" font-size="7" text-anchor="middle" font-weight="bold" fill="currentColor">15</text></svg>';
  var ICON_FWD = '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d="M11.5 8c3.1 0 5.8 1.9 6.9 4.7l2.1-2.1V16h-5.4l2.1-2.1c-.9-2.2-3-3.9-5.7-3.9-3.3 0-6 2.7-6 6s2.7 6 6 6c1.7 0 3.2-.7 4.2-1.8l1.4 1.4c-1.4 1.5-3.4 2.4-5.6 2.4-4.4 0-8-3.6-8-8s3.6-8 8-8z" fill="currentColor"/><text x="12" y="17" font-size="7" text-anchor="middle" font-weight="bold" fill="currentColor">15</text></svg>';
  var ICON_PREV = '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><rect x="5" y="5" width="2.6" height="14" rx="1"/><path d="M19 5.5v13L9.5 12z"/></svg>';
  var ICON_NEXT = '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true"><rect x="16.4" y="5" width="2.6" height="14" rx="1"/><path d="M5 5.5v13l9.5-6.5z"/></svg>';
  var ICON_SPIN = '<svg class="q-spin" viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8" opacity=".25"/><path d="M12 4a8 8 0 0 1 8 8"/></svg>';
  var dockObserver = null;

  function fmtTime(sec) {
    if (!sec || isNaN(sec) || !isFinite(sec)) return '0:00';
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = Math.floor(sec % 60);
    return h ? h + ':' + (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s) : m + ':' + (s < 10 ? '0' + s : s);
  }

  /* Barra di avanzamento (quella grande e quella del lettore fisso) e tempi.
     previewPct: mentre si trascina si mostra solo l'anteprima, l'audio si sposta al rilascio. */
  function updateProgress(previewPct) {
    if (state.scrub && previewPct == null) return;      // non si tocca la barra mentre la si trascina
    var dur = audioEl.duration, has = isFinite(dur) && dur > 0;
    var pct = previewPct != null ? previewPct : (has ? (audioEl.currentTime / dur) * 100 : 0);
    var cur = has ? (pct / 100) * dur : audioEl.currentTime;
    ['q-prog', 'q-dock-prog'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.disabled = !has;
      el.value = pct;
      el.style.setProperty('--p', pct + '%');
      el.setAttribute('aria-valuetext', has ? fmtTime(cur) + ' su ' + fmtTime(dur) : 'Non ancora caricato');
    });
    var c = document.getElementById('q-time-cur');
    var d = document.getElementById('q-time-dur');
    if (c) c.textContent = fmtTime(cur);
    if (d) d.textContent = has ? '−' + fmtTime(dur - cur) : '–:––';
  }

  function bindScrub(el) {
    if (!el) return;
    function commit() {
      if (!state.scrub) return;
      state.scrub = false;
      if (audioEl.duration) audioEl.currentTime = (el.value / 100) * audioEl.duration;
      updateProgress();
    }
    el.addEventListener('input', function () { state.scrub = true; updateProgress(parseFloat(el.value)); });
    el.addEventListener('change', commit);
    el.addEventListener('pointerup', commit);
    el.addEventListener('touchend', commit);
    el.addEventListener('blur', commit);
  }

  /* Tasti play/pausa (grande e fisso): riproduzione, pausa o caricamento */
  function syncTransport() {
    [['q-play-toggle', 38], ['q-dock-play', 30]].forEach(function (x) {
      var b = document.getElementById(x[0]);
      if (!b) return;
      var icon = state.loading ? ICON_SPIN : (state.playing ? ICON_PAUSE : ICON_PLAY);
      b.innerHTML = icon.replace(/width="30" height="30"/, 'width="' + x[1] + '" height="' + x[1] + '"');
      b.setAttribute('aria-label', state.loading ? 'Caricamento, tocca per annullare' : (state.playing ? 'Pausa' : 'Avvia'));
      b.classList.toggle('is-loading', state.loading);
    });
  }

  function renderDock() {
    var dock = document.getElementById('q-dock');
    if (!dock) return;
    var s = getSurah(state.surah);
    var r = D.reciters[state.reciter];
    var t = document.getElementById('q-dock-title');
    var sub = document.getElementById('q-dock-sub');
    if (t) t.textContent = s.n + '. ' + s.nome;
    if (sub) sub.textContent = r.nome;
    var im = document.getElementById('q-dock-img');
    var src = 'img/sure/t/' + s.pad + '.webp';   // la stessa miniatura dell'elenco (104 px), già in memoria
    if (im && im.getAttribute('src') !== src) { im.style.display = ''; im.setAttribute('src', src); }
    syncTransport();
    updateProgress();
  }

  function setupDock() {
    if (dockObserver) { dockObserver.disconnect(); dockObserver = null; }
    var dock = document.getElementById('q-dock');
    var box = document.getElementById('q-player-box');
    if (!dock || !box) return;
    document.getElementById('q-dock-bwd').addEventListener('click', function () { skip(-15); });
    /* toccando il nome della Sura nella barra fissa si torna in cima, al lettore grande */
    document.getElementById('q-dock-top').addEventListener('click', function () {
      var calmo = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      try { window.scrollTo({ top: 0, behavior: calmo ? 'auto' : 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
      var play = document.getElementById('q-play-toggle');
      if (play) { try { play.focus({ preventScroll: true }); } catch (e) {} }   // chi usa la tastiera ritrova il tasto play
    });
    document.getElementById('q-dock-fwd').addEventListener('click', function () { skip(15); });
    document.getElementById('q-dock-play').addEventListener('click', togglePlay);
    bindScrub(document.getElementById('q-dock-prog'));
    /* il lettore compatto compare solo quando quello grande è uscito dallo schermo */
    if ('IntersectionObserver' in window) {
      dockObserver = new IntersectionObserver(function (entries) {
        dock.classList.toggle('show', !entries[0].isIntersecting);
      }, { threshold: 0.05 });
      dockObserver.observe(box);
    } else {
      dock.classList.add('show');
    }
    renderDock();
  }

  /* Timer di spegnimento: dissolvenza negli ultimi secondi, poi pausa. Parte quando parte l'ascolto. */
  var FADE_S = 12;
  var sleepIv = null, fading = false, lastPos = 0;

  function sleepLabel() {
    var el = document.getElementById('q-sleep-left');
    if (!el) return;
    if (!state.sleepMin) { el.textContent = ''; return; }
    if (!state.sleepEnd) { el.textContent = 'Il timer parte con l’ascolto.'; return; }
    var left = Math.max(0, Math.round((state.sleepEnd - Date.now()) / 1000));
    el.textContent = 'Si spegne tra ' + fmtTime(left) + '.';
  }

  function sleepClear() {
    clearInterval(sleepIv);
    sleepIv = null;
    fading = false;
  }

  function sleepStartClock() {
    if (!state.sleepMin || state.sleepEnd) return;
    state.sleepEnd = Date.now() + state.sleepMin * 60000;
    sleepClear();
    sleepIv = setInterval(sleepTick, 1000);
    sleepLabel();
  }

  function setSleep(min) {
    sleepClear();
    state.sleepMin = min;
    state.sleepEnd = 0;
    if (min && (state.playing || state.loading)) sleepStartClock();
    sleepLabel();
  }

  function sleepTick() {
    var left = (state.sleepEnd - Date.now()) / 1000;
    if (left <= 0) {
      sleepClear();
      state.sleepMin = 0; state.sleepEnd = 0;
      audioEl.pause();
      audioEl.volume = 1;
      var sel = document.getElementById('q-sleep-select');
      if (sel) sel.value = '0';
      sleepLabel();
      return;
    }
    if (left <= FADE_S && state.playing) {
      if (!fading) {
        fading = true;
        if (audioEl === elRouted && B.Engine) B.Engine.fadeMedia(left);
      }
      if (audioEl === elPlain) audioEl.volume = Math.max(0, left / FADE_S);   // su iPhone il volume non si regola: si ferma e basta
    }
    sleepLabel();
  }

  function updatePositionState() {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
    var now = Date.now();
    if (now - lastPos < 1000) return;
    lastPos = now;
    var d = audioEl.duration;
    if (!isFinite(d) || d <= 0) return;
    try { navigator.mediaSession.setPositionState({ duration: d, playbackRate: 1, position: Math.min(d, audioEl.currentTime) }); } catch (e) {}
  }

  function wire(el) {
    function mine() { return el === audioEl; }
    el.addEventListener('play', function () {
      if (!mine()) return;
      if (B.Engine) B.Engine.mediaActive(el === elRouted);
      state.playing = true;
      sleepStartClock();
      syncBackgroundSound(true);
      applyMediaSession();
      renderPlayerCard();
      renderActiveItem();
    });
    el.addEventListener('playing', function () {
      if (!mine()) return;
      if (el === elPlain) fallbackTrial = false;       // l'audio semplice funziona: il guasto era del percorso con livelli
      state.loading = false;
      syncTransport();
    });
    el.addEventListener('waiting', function () {
      if (!mine() || !state.playing) return;
      state.loading = true;
      syncTransport();
    });
    el.addEventListener('pause', function () {
      if (!mine()) return;
      state.playing = false;
      state.loading = false;
      syncBackgroundSound(false);
      if (B.Engine) B.Engine.mediaActive(false);
      renderPlayerCard();
      renderActiveItem();
    });
    el.addEventListener('ended', function () {
      if (!mine()) return;
      state.playing = false;
      state.loading = false;
      syncBackgroundSound(false);
      if (B.Engine) B.Engine.mediaActive(false);
      renderPlayerCard();
      renderActiveItem();
      // a fine Sura: prima la coda; finita la coda, «Alla fine» (ferma, successiva o ripeti)
      var qi = codaNext();
      if (qi >= 0) { playCodaAt(qi); return; }
      if (state.endMode === 'repeat') {
        playSurah(state.surah);
      } else if (state.endMode === 'next') {
        var nx = neighbour(state.surah, 1);
        if (nx) playSurah(nx);
      }
    });
    el.addEventListener('loadedmetadata', function () {
      if (!mine()) return;
      if (pendingSeek != null) {
        try { el.currentTime = pendingSeek; } catch (e) {}
        pendingSeek = null;
      }
      updateProgress();
    });
    el.addEventListener('durationchange', function () { if (mine()) updateProgress(); });
    el.addEventListener('error', function () {
      if (!mine()) return;
      if (!el.getAttribute('src')) return;                  // elemento svuotato da noi (resetMedia): non è un guasto
      if (el === elRouted && !routedFailed && (state.playing || state.loading)) {
        routedFailed = true;
        fallbackTrial = true;
        playSurah(state.surah);
        return;
      }
      if (el === elPlain && fallbackTrial) { routedFailed = false; fallbackTrial = false; }
      state.loading = false;
      syncTransport();
    });
    el.addEventListener('timeupdate', function () {
      if (!mine()) return;
      updateProgress();
      updatePositionState();
    });
  }
  wire(elPlain);
  wire(elRouted);

  /* Rendering dell'interfaccia */
  function renderView() {
    var v = document.getElementById('v-recitazioni');
    if (!v) return;

    var html = '' +
      '<h1>Recitazioni coraniche</h1>' +

      '<!-- Scelta della voce -->' +
      '<div class="q-reciter-chips" role="radiogroup" aria-label="Seleziona il recitatore">' +
        RECITERS.map(function (rid) {
          var r = D.reciters[rid];
          return '<button type="button" class="chip' + (state.reciter === rid ? ' on' : '') + '" data-reciter="' + rid + '">' + (r.corto || r.nome) + '</button>';
        }).join('') +
      '</div>' +

      '<!-- Player attivo -->' +
      '<div class="panel q-player-card" id="q-player-box"></div>' +

      '<div id="q-special"></div>' +
      '<div id="q-moment"></div>' +

      '<!-- Consigliate per la notte -->' +
      '<h2 id="q-rec-title">⭐ Consigliate per il riposo</h2>' +
      '<p class="sub" id="q-rec-sub">Sure scelte specificamente per la cadenza distensiva, i messaggi di conforto interiore e l\'assenza di picchi acustici improvvisi.</p>' +
      '<div class="list" id="q-recommended-list"></div>' +

      '<!-- Catalogo Completo 114 Sure -->' +
      '<h2 id="q-all-title">📖 Tutte le 114 Sure</h2>' +
      '<p class="sub" id="q-all-sub">Puoi ascoltare in streaming qualsiasi Sura del Corano. Seleziona una Sura per avviare l\'ascolto immediato o salvarla per l\'uso senza rete.</p>' +
      '<div class="q-search-box" id="q-search-wrap">' +
        '<input type="search" id="q-search-input" aria-label="Cerca una Sura" placeholder="Cerca Sura per nome, significato o numero (es. Maryam, 55, Il Misericordioso)..." autocomplete="off">' +
      '</div>' +
      '<div class="list" id="q-all-surahs-list"></div>' +

      '<p class="fine">Le recitazioni arrivano in streaming dal servizio pubblico gratuito MP3Quran, che, come ogni sito, vede l’indirizzo del tuo dispositivo mentre ascolti. Sakina non raccoglie nessun dato. I file salvati offline restano nella memoria del telefono e si ascoltano anche senza rete.</p>' +

      '<!-- Lettore compatto fisso -->' +
      '<div class="q-dock" id="q-dock" role="group" aria-label="Comandi di ascolto">' +
        '<input type="range" class="q-range q-dock-prog" id="q-dock-prog" min="0" max="100" step="0.1" value="0" aria-label="Avanzamento audio" disabled>' +
        '<div class="q-dock-row">' +
          '<button type="button" class="q-dock-info" id="q-dock-top" aria-label="Torna su, al lettore">' +
            '<img class="q-dock-thumb" id="q-dock-img" alt="" width="44" height="44" decoding="async">' +
            '<span class="q-dock-text"><strong id="q-dock-title"></strong><small id="q-dock-sub"></small></span>' +
          '</button>' +
          '<button type="button" class="q-dock-btn" id="q-dock-bwd" aria-label="Indietro 15 secondi">' + ICON_BWD + '</button>' +
          '<button type="button" class="q-dock-btn q-dock-main" id="q-dock-play" aria-label="Avvia"></button>' +
          '<button type="button" class="q-dock-btn" id="q-dock-fwd" aria-label="Avanti 15 secondi">' + ICON_FWD + '</button>' +
        '</div>' +
      '</div>';

    v.innerHTML = html;
    setupDock();

    // Event listener per recitatori
    var rChips = v.querySelectorAll('[data-reciter]');
    rChips.forEach(function (btn) {
      btn.addEventListener('click', function () { switchReciter(btn.getAttribute('data-reciter')); });
    });

    // Ricerca live
    var searchIn = document.getElementById('q-search-input');
    if (searchIn) {
      searchIn.value = state.filter;
      searchIn.addEventListener('input', function (e) {
        state.filter = e.target.value.toLowerCase().trim();
        renderAllSurahs();
      });
    }

    renderPlayerCard();
    renderMoment(true);
    renderRecommended();
    renderAllSurahs();
    updateCacheIndex();
  }

  /* Cambio di voce. Con «target» (una Sura proposta con un'altra voce) passa a quella voce e avvia quella Sura;
     senza, tiene la Sura in corso se esiste con la nuova voce, altrimenti resta in pausa sulla prima disponibile. */
  function switchReciter(rId, target) {
    if (!D.reciters[rId]) return;
    if (state.reciter === rId && target == null) return;
    var wasPlaying = state.playing || state.loading;
    state.reciter = rId;
    var keep = isAllowed(rId, state.surah);
    if (target != null && isAllowed(rId, target)) { state.surah = target; keep = false; }
    else if (!keep) state.surah = reciterSurahs(rId)[0].n;    // la Sura in corso non esiste con questa voce
    saveSettings();
    if (!(wasPlaying && keep)) resetMedia();                   // se suonava la stessa Sura riparte da sola con la nuova voce
    document.querySelectorAll('[data-reciter]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-reciter') === rId); });
    updateCacheIndex();
    renderPlayerCard();
    renderMoment(true);
    renderRecommended();
    renderAllSurahs();
    if (target != null) playSurah(state.surah);                 // scelta esplicita dell'utente: «Ascolta» su una Sura proposta con un'altra voce
    else if (wasPlaying && keep) playSurah(state.surah);        // se la Sura non esiste con questa voce resta in pausa: non parte mai una Sura che non hai scelto tu
  }

  function renderPlayerCard() {
    var box = document.getElementById('q-player-box');
    if (!box) return;

    var s = getSurah(state.surah);
    var r = D.reciters[state.reciter];
    var url = getAudioUrl(state.reciter, s.pad);
    var isSaved = !!state.cachedUrls[url];
    var isDownloading = state.downloading === url;

    var info = SI[s.n] || {};
    var h = '' +
      '<figure class="q-cover"><img class="q-cover-img" src="' + coverUrl(s) + '" alt="" width="480" height="480" decoding="async"></figure>' +
      '<div class="q-now-row">' +
        '<div class="q-now-info">' +
          '<span class="q-badge-num">' + s.n + '</span>' +
          '<div>' +
            '<h3 class="q-now-title">' + s.nome + ' <span class="q-ar">' + s.ar + '</span></h3>' +
            '<p class="piccolo" style="margin:0;">' + s.trad + ' · <span class="tenue">' + r.nome + '</span></p>' +
          '</div>' +
        '</div>' +
      '</div>' +
      (info.t ? '<p class="q-desc"><small class="tenue q-place">' + placeLine(s) + '</small>' + info.t + '</p>' : '') +

      '<div class="q-timeline">' +
        '<input type="range" class="q-range" id="q-prog" min="0" max="100" step="0.1" value="0" aria-label="Avanzamento audio" disabled>' +
        '<div class="q-time-row">' +
          '<span id="q-time-cur">0:00</span>' +
          '<span id="q-time-dur">–:––</span>' +
        '</div>' +
      '</div>' +

      '<div class="q-controls">' +
        '<button type="button" class="q-nav" id="q-prev" aria-label="Sura precedente"' + (neighbour(state.surah, -1) ? '' : ' disabled') + '>' + ICON_PREV + '</button>' +
        '<button type="button" class="q-skip" id="q-bwd" aria-label="Indietro 15 secondi">' + ICON_BWD + '<span>15 s</span></button>' +
        '<button type="button" class="q-play-btn" id="q-play-toggle" aria-label="Avvia"></button>' +
        '<button type="button" class="q-skip" id="q-fwd" aria-label="Avanti 15 secondi">' + ICON_FWD + '<span>15 s</span></button>' +
        '<button type="button" class="q-nav" id="q-next" aria-label="Sura successiva"' + ((neighbour(state.surah, 1) || codaNext() >= 0) ? '' : ' disabled') + '>' + ICON_NEXT + '</button>' +
      '</div>' +

      '<div class="q-opts-row">' +
        '<label>Spegni dopo<select id="q-sleep-select" aria-label="Timer di spegnimento">' +
          '<option value="0"' + (!state.sleepMin ? ' selected' : '') + '>Mai</option>' +
          [15, 30, 45, 60, 90].map(function (m) { return '<option value="' + m + '"' + (state.sleepMin === m ? ' selected' : '') + '>' + m + ' minuti</option>'; }).join('') +
        '</select></label>' +
        '<label>Alla fine<select id="q-end-select" aria-label="Cosa fare alla fine della Sura">' +
          '<option value="stop"' + (state.endMode === 'stop' ? ' selected' : '') + '>Fermati</option>' +
          '<option value="next"' + (state.endMode === 'next' ? ' selected' : '') + '>Prossima Sura</option>' +
          '<option value="repeat"' + (state.endMode === 'repeat' ? ' selected' : '') + '>Ripeti questa</option>' +
        '</select></label>' +
      '</div>' +
      '<p class="hint q-sleep-left" id="q-sleep-left" role="status" aria-live="off"></p>' +
      queueRowHtml() +

      (state.reciter === 'basit' && !wantRouted()
        ? '<p class="hint q-warn">Questa voce è registrata molto più forte delle altre (fino a 10 dB). Abbassa il volume del telefono prima di avviare.</p>'
        : '') +

      '<details class="q-more" id="q-more"' + (state.moreOpen ? ' open' : '') + '>' +
        '<summary>Sulla voce, sottofondo e offline' + (state.bgPreset !== 'nessuno' ? ' <small class="tenue">· ' + state.bgPreset + '</small>' : '') + (isSaved ? ' <small class="tenue">· salvata</small>' : '') + '</summary>' +
        '<p class="sub q-reciter-desc">' + r.desc + '</p>' +

        '<div class="q-mix-box">' +
          '<div class="q-mix-head">' +
            '<span class="q-mix-label">Sottofondo di natura:</span>' +
            '<select id="q-bg-select" aria-label="Seleziona sottofondo ambientale">' +
              '<option value="nessuno"' + (state.bgPreset === 'nessuno' ? ' selected' : '') + '>Nessuno (voce pura)</option>' +
              '<option value="pioggia"' + (state.bgPreset === 'pioggia' ? ' selected' : '') + '>+ Pioggia leggera</option>' +
              '<option value="vento"' + (state.bgPreset === 'vento' ? ' selected' : '') + '>+ Vento morbido</option>' +
              '<option value="onde"' + (state.bgPreset === 'onde' ? ' selected' : '') + '>+ Onde lente</option>' +
              '<option value="ruscello"' + (state.bgPreset === 'ruscello' ? ' selected' : '') + '>+ Ruscello calmo</option>' +
            '</select>' +
          '</div>' +
          (state.bgPreset !== 'nessuno'
            ? '<div class="q-mix-slider-row">' +
                '<small class="tenue">Più lontano</small>' +
                '<input type="range" id="q-bg-rel" min="-24" max="-4" step="1" value="' + state.bgRel + '" aria-label="Quanto è presente il sottofondo rispetto alla voce" aria-describedby="q-bg-rel-o">' +
                '<small class="tenue">Più vicino</small>' +
              '</div>' +
              '<small class="tenue" id="q-bg-rel-o">' + (-state.bgRel) + ' dB sotto la voce</small>'
            : '') +
        '</div>' +

        '<label class="check q-level-row"><input type="checkbox" id="q-level"' + (state.leveling ? ' checked' : '') + (LV ? '' : ' disabled') + '> ' +
          '<span>Pareggia il volume delle voci<small class="tenue" style="display:block">Porta tutte le Sure e tutte le voci allo stesso livello, senza sbalzi tra una voce e l’altra. Se la riproduzione a schermo bloccato si interrompe, spegnilo.</small></span></label>' +

        '<div class="q-offline-row">' +
          '<button type="button" class="btn secondary piccolo q-btn-offline" id="q-offline-btn"' + (isDownloading ? ' disabled' : '') + '>' +
            (isDownloading ? 'Scaricamento in corso...' : (isSaved ? '✓ Salvato sul telefono (offline)' : '📥 Salva sul telefono (ascolto offline)')) +
          '</button>' +
          '<small class="tenue">' + (isSaved ? 'Disponibile anche in modalità aereo' : 'In streaming CDN (0 MB occupati)') + '</small>' +
        '</div>' +
      '</details>';

    var focusId = (document.activeElement && box.contains(document.activeElement)) ? document.activeElement.id : '';
    box.innerHTML = h;
    renderDock();      // aggiorna anche play/pausa e barra della card
    if (focusId) { var fe = document.getElementById(focusId); if (fe && !fe.disabled) fe.focus(); }   // la scheda viene ridisegnata: il focus da tastiera non si perde

    var btnPlay = document.getElementById('q-play-toggle');
    if (btnPlay) btnPlay.addEventListener('click', togglePlay);

    var btnBwd = document.getElementById('q-bwd');
    if (btnBwd) btnBwd.addEventListener('click', function () { skip(-15); });

    var btnFwd = document.getElementById('q-fwd');
    if (btnFwd) btnFwd.addEventListener('click', function () { skip(15); });

    var btnPrev = document.getElementById('q-prev');
    if (btnPrev) btnPrev.addEventListener('click', goPrev);
    var btnNext = document.getElementById('q-next');
    if (btnNext) btnNext.addEventListener('click', goNext);

    var sleepSel = document.getElementById('q-sleep-select');
    if (sleepSel) sleepSel.addEventListener('change', function () { setSleep(parseInt(sleepSel.value, 10)); });
    var endSel = document.getElementById('q-end-select');
    if (endSel) endSel.addEventListener('change', function () { state.endMode = endSel.value; saveSettings(); });
    sleepLabel();

    var more = document.getElementById('q-more');
    if (more) more.addEventListener('toggle', function () { state.moreOpen = more.open; });

    bindScrub(document.getElementById('q-prog'));

    var bgSel = document.getElementById('q-bg-select');
    if (bgSel) {
      bgSel.addEventListener('change', function () {
        state.bgPreset = bgSel.value;
        saveSettings();
        syncBackgroundSound(state.playing);
        renderPlayerCard();
      });
    }

    var bgRel = document.getElementById('q-bg-rel');
    if (bgRel) {
      bgRel.addEventListener('input', function () {
        state.bgRel = parseInt(bgRel.value, 10);
        saveSettings();
        var o = document.getElementById('q-bg-rel-o');
        if (o) o.textContent = (-state.bgRel) + ' dB sotto la voce';
        if (B.Engine && B._quranBgActive) B.Engine.setMaster(bgMaster());
      });
    }

    var lvl = document.getElementById('q-level');
    if (lvl) {
      lvl.addEventListener('change', function () {
        state.leveling = lvl.checked;
        saveSettings();
        var wasPlaying = state.playing, t = audioEl.currentTime;
        if (wasPlaying) playSurah(state.surah, t); else { pickElement(); renderPlayerCard(); }
      });
    }

    var btnOff = document.getElementById('q-offline-btn');
    if (btnOff) {
      btnOff.addEventListener('click', function () {
        toggleOffline(state.surah, btnOff);
      });
    }

    var btnQ = document.getElementById('q-queue-btn');
    if (btnQ) btnQ.addEventListener('click', openCoda);
    renderCodaSheet();      // la finestra della coda, se aperta, segue l'ascolto
  }

  /* Proposte per il momento della giornata: solo Sure che esistono con la voce scelta (selezione protetta rispettata). */
  var lastBand = '';
  /* Una proposta (ora del giorno, venerdì, feste…) che non c'è con la voce scelta (esclusa dall'utente o fuori da una
     selezione protetta) si propone con un'altra voce, di preferenza Al-Minshawi, con la scritta «con …». */
  var VOCE_RISERVA = 'minshawi';
  function voceAlternativa(n) {
    var ordine = [VOCE_RISERVA].concat(RECITERS);
    for (var i = 0; i < ordine.length; i++) if (ordine[i] !== state.reciter && isAllowed(ordine[i], n)) return ordine[i];
    return null;
  }
  function rowHtml(it) {
    var s = getSurah(it.n), altra = it.voice ? D.reciters[it.voice] : null;
    var nomeVoce = altra ? (altra.corto || altra.nome) : '';
    var isCur = !altra && state.surah === s.n, isPl = isCur && state.playing;
    var isSaved = !!state.cachedUrls[getAudioUrl(it.voice || state.reciter, s.pad)];
    return '' +
      '<div class="session-item q-item' + (isCur ? ' active' : '') + (altra ? ' q-other-voice' : '') + '" data-surah="' + s.n + '"' + (altra ? ' data-voice="' + it.voice + '"' : '') + '>' +
        '<div class="session-main"><div class="session-meta">' + thumbHtml(s) +
          '<div><strong>' + s.nome + ' <span class="q-ar">' + s.ar + '</span></strong>' +
          '<small class="sub">' + s.trad + (altra ? ' · <span class="q-voice-tag">con ' + nomeVoce + '</span>' : '') + (isSaved ? ' · <span style="color:var(--deep)">✓ Offline</span>' : '') + '</small></div>' +
        '</div></div>' +
        '<button type="button" class="btn secondary piccolo q-play-item-btn" data-play-surah="' + s.n + '"' + (altra ? ' aria-label="Ascolta ' + s.nome + ' con ' + nomeVoce + '"' : '') + '>' + (isPl ? 'Pausa' : 'Ascolta') + '</button>' +
        moreBtn(s) +
      '</div>';
  }
  function proposalItems(list, max, gia) {
    var out = [];
    list.forEach(function (n) {
      if (out.length >= max || (gia && gia[n])) return;
      if (isAllowed(state.reciter, n)) out.push({ n: n, voice: null });
      else { var v = voceAlternativa(n); if (v) out.push({ n: n, voice: v }); }
    });
    return out;
  }

  function renderMoment(force) {
    var box = document.getElementById('q-moment');
    var sp = document.getElementById('q-special');
    if (!box) return;
    var band = dayPart(), ev = activeEvents();
    var key = band + '|' + ev.map(function (e) { return e.id + e.titolo; }).join(',');
    if (!force && key === lastBand) return;
    lastBand = key;
    // ricorrenze (venerdì, Ramadan, notti dispari, feste): sopra le proposte dell'ora; si mostrano solo se la voce ha quelle Sure
    if (sp) {
      var h = '', gia = {};
      ev.forEach(function (e) {
        var l = proposalItems(e.sure, 3, gia);   // una Sura già proposta più su non si ripete
        l.forEach(function (it) { gia[it.n] = true; });
        if (!l.length) return;
        h += '<section class="q-special" data-evento="' + e.id + '"><h2>' + e.titolo + '</h2><p class="sub">' + e.testo + '</p>' +
          '<div class="list">' + l.map(rowHtml).join('') + '</div>' +
          (e.nota ? '<p class="hint q-special-note">' + e.nota + '</p>' : '') + '</section>';
      });
      sp.innerHTML = h;
      bindListEvents(sp);
    }
    var m = MOM[band];
    var list = m ? proposalItems(m.sure, 4) : [];
    if (!list.length) { box.innerHTML = ''; return; }
    box.innerHTML = '<h2>' + m.titolo + '</h2><p class="sub">' + m.testo + '</p><div class="list" id="q-moment-list">' + list.map(rowHtml).join('') + '</div>';
    bindListEvents(box);
  }

  function renderRecommended() {
    var list = document.getElementById('q-recommended-list');
    if (!list) return;

    var rec = reciterSurahs(state.reciter).filter(function (s) { return isRecommended(state.reciter, s); });
    var html = '';
    var rt = document.getElementById('q-rec-title'), rs = document.getElementById('q-rec-sub');
    if (rt) rt.hidden = !rec.length;
    if (rs) rs.hidden = !rec.length;

    rec.forEach(function (s) {
      var isCur = state.surah === s.n;
      var isPl = isCur && state.playing;
      var url = getAudioUrl(state.reciter, s.pad);
      var isSaved = !!state.cachedUrls[url];

      html += '' +
        '<div class="session-item q-item' + (isCur ? ' active' : '') + '" data-surah="' + s.n + '">' +
          '<div class="session-main">' +
            '<div class="session-meta">' +
              thumbHtml(s) +
              '<div>' +
                '<strong>' + s.nome + ' <span class="q-ar">' + s.ar + '</span></strong>' +
                '<small class="sub">' + s.trad + (isSaved ? ' · <span style="color:var(--deep)">✓ Offline</span>' : '') + '</small>' +
              '</div>' +
            '</div>' +
            (surahNote(state.reciter, s) ? '<p class="q-item-nota">' + surahNote(state.reciter, s) + '</p>' : '') +
          '</div>' +
          '<button type="button" class="btn secondary piccolo q-play-item-btn" data-play-surah="' + s.n + '">' +
            (isPl ? 'Pausa' : 'Ascolta') +
          '</button>' +
          moreBtn(s) +
        '</div>';
    });

    list.innerHTML = html;
    bindListEvents(list);
  }

  function renderAllSurahs() {
    var list = document.getElementById('q-all-surahs-list');
    if (!list) return;

    var filter = state.filter;
    var all = reciterSurahs(state.reciter);
    var limited = all.length < D.surahs.length;
    var at = document.getElementById('q-all-title'), as = document.getElementById('q-all-sub'), sw = document.getElementById('q-search-wrap');
    if (at) at.textContent = limited ? '📖 Le Sure per questa voce (' + all.length + ')' : '📖 Tutte le 114 Sure';
    var nEscl = baseSurahs(state.reciter).length - all.length;
    if (as) as.textContent = (limited
      ? 'Con questa voce trovi queste Sure. Selezionane una per avviare l\'ascolto immediato.'
      : 'Puoi ascoltare in streaming qualsiasi Sura del Corano. Seleziona una Sura per avviare l\'ascolto immediato o salvarla per l\'uso senza rete.') +
      (nEscl ? ' ' + (nEscl === 1 ? 'Una Sura è esclusa' : nEscl + ' Sure sono escluse') + ' con questa voce: le rimetti in «Su Sakina» (ⓘ in alto).' : '');
    if (sw) sw.hidden = limited && all.length <= 12;
    var filtered = all.filter(function (s) {
      if (!filter) return true;
      return s.n.toString() === filter ||
             s.nome.toLowerCase().indexOf(filter) >= 0 ||
             s.trad.toLowerCase().indexOf(filter) >= 0;
    });

    if (filtered.length === 0) {
      list.innerHTML = '<p class="hint" style="padding:15px 0;">Nessuna Sura trovata con questo termine di ricerca.</p>';
      return;
    }

    var html = '';
    filtered.forEach(function (s) {
      var isCur = state.surah === s.n;
      var isPl = isCur && state.playing;
      var url = getAudioUrl(state.reciter, s.pad);
      var isSaved = !!state.cachedUrls[url];

      html += '' +
        '<div class="session-item q-item' + (isCur ? ' active' : '') + '" data-surah="' + s.n + '">' +
          '<div class="session-main">' +
            '<div class="session-meta">' +
              thumbHtml(s) +
              '<div>' +
                '<strong>' + s.nome + ' <span class="q-ar">' + s.ar + '</span></strong>' +
                '<small class="sub">' + s.trad + ' · ' + s.ayahs + ' versetti' + (isSaved ? ' · <span style="color:var(--deep)">✓ Offline</span>' : '') + '</small>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<button type="button" class="btn secondary piccolo q-play-item-btn" data-play-surah="' + s.n + '">' +
            (isPl ? 'Pausa' : 'Ascolta') +
          '</button>' +
          moreBtn(s) +
        '</div>';
    });

    list.innerHTML = html;
    bindListEvents(list);
  }

  function renderOfflineBadges() {
    var items = document.querySelectorAll('[data-surah]');
    items.forEach(function (it) {
      var sn = parseInt(it.getAttribute('data-surah'), 10);
      var s = getSurah(sn);
      var url = getAudioUrl(state.reciter, s.pad);
      var isSaved = !!state.cachedUrls[url];
      var badge = it.querySelector('.q-offline-badge');
      if (isSaved && !badge) {
        var sub = it.querySelector('small.sub');
        if (sub && sub.innerHTML.indexOf('✓ Offline') === -1) {
          sub.innerHTML += ' · <span style="color:var(--deep)" class="q-offline-badge">✓ Offline</span>';
        }
      }
    });
  }

  function renderActiveItem() {
    var items = document.querySelectorAll('[data-surah]');
    items.forEach(function (it) {
      var sn = parseInt(it.getAttribute('data-surah'), 10);
      var v = it.getAttribute('data-voice');
      var isCur = state.surah === sn && (!v || v === state.reciter);   // una proposta «con un'altra voce» non è la Sura in corso
      it.classList.toggle('active', isCur);
      var btn = it.querySelector('.q-play-item-btn');
      if (btn) {
        btn.textContent = (isCur && state.playing) ? 'Pausa' : 'Ascolta';
      }
    });
  }

  function bindListEvents(container) {
    container.querySelectorAll('[data-menu-surah]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var row = b.closest('[data-surah]'), v = row && row.getAttribute('data-voice');
        openMenu({ n: parseInt(b.getAttribute('data-menu-surah'), 10), voice: v || state.reciter });
      });
    });
    var btns = container.querySelectorAll('[data-play-surah]');
    btns.forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var sn = parseInt(b.getAttribute('data-play-surah'), 10);
        var row = b.closest('[data-voice]'), v = row && row.getAttribute('data-voice');
        if (v && v !== state.reciter) { switchReciter(v, sn); return; }
        if (state.surah === sn && state.playing) {
          togglePlay();
        } else {
          playSurah(sn);
        }
      });
    });

    var rows = container.querySelectorAll('.q-item');
    rows.forEach(function (r) {
      r.addEventListener('click', function () {
        var sn = parseInt(r.getAttribute('data-surah'), 10);
        var v = r.getAttribute('data-voice');
        if (v && v !== state.reciter) { switchReciter(v, sn); return; }
        if (state.surah === sn && state.playing) {
          togglePlay();
        } else {
          playSurah(sn);
        }
      });
    });
  }

  /* ======================================================================
     Coda (come su Spotify) e liste di riproduzione.
     - Ogni elemento è { n: Sura, voice: voce }: parte con la sua voce.
     - A fine Sura, e con «Sura successiva», la coda ha la precedenza; finita la coda vale «Alla fine».
     - «Ripeti la coda» ricomincia dalla prima. Il timer di spegnimento ferma tutto.
     - Una Sura esclusa con la sua voce si salta.
     ====================================================================== */
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function voceCorta(rid) { var r = D.reciters[rid]; return r ? (r.corto || r.nome) : ''; }
  function saveCoda() { try { localStorage.setItem(CODA_KEY, JSON.stringify(coda)); } catch (e) {} }
  function saveListe() { try { localStorage.setItem(LISTE_KEY, JSON.stringify(liste)); } catch (e) {} }
  function okItem(it) { return !!it && isAllowed(it.voice, it.n); }

  /* indice del prossimo elemento da suonare, -1 se la coda è finita */
  function codaNext() {
    var L = coda.items.length, i;
    for (i = coda.pos + 1; i < L; i++) if (okItem(coda.items[i])) return i;
    if (coda.ripeti) for (i = 0; i <= coda.pos && i < L; i++) if (okItem(coda.items[i])) return i;
    return -1;
  }
  function codaInArrivo() {
    var c = 0;
    for (var i = coda.pos + 1; i < coda.items.length; i++) if (okItem(coda.items[i])) c++;
    return c;
  }
  function playCodaAt(i) {
    var it = coda.items[i];
    if (!okItem(it)) return false;
    coda.pos = i;
    saveCoda();
    if (it.voice === state.reciter && it.n === state.surah && audioEl.getAttribute('src')) { try { audioEl.currentTime = 0; } catch (e) {} }   // dalla coda una Sura parte sempre dall'inizio
    if (it.voice !== state.reciter) switchReciter(it.voice, it.n); else playSurah(it.n);
    renderPlayerCard();
    return true;
  }
  function codaChanged() { saveCoda(); renderPlayerCard(); }
  function codaAdd(it, subito) {
    if (coda.items.length >= MAX_ITEMS) { toast('La coda è piena: al massimo ' + MAX_ITEMS + ' Sure.'); return false; }
    if (subito) coda.items.splice(coda.pos + 1, 0, { n: it.n, voice: it.voice });
    else coda.items.push({ n: it.n, voice: it.voice });
    codaChanged();
    return true;
  }
  function codaRemove(i) {
    if (i < 0 || i >= coda.items.length) return;
    coda.items.splice(i, 1);
    if (i <= coda.pos) coda.pos--;
    codaChanged();
  }
  function codaMove(i, d) {
    var j = i + d;
    if (i <= coda.pos || j <= coda.pos || j >= coda.items.length) return false;   // si riordinano solo le Sure in arrivo
    var t = coda.items[i]; coda.items[i] = coda.items[j]; coda.items[j] = t;
    codaChanged();
    return true;
  }
  function inAscolto(it) { return !!it && it.n === state.surah && it.voice === state.reciter && (state.playing || state.loading); }
  function codaTogliAscoltate() {
    var keep = inAscolto(coda.items[coda.pos]) ? coda.pos : coda.pos + 1;   // la Sura in ascolto resta
    if (keep <= 0) return;
    coda.items.splice(0, keep);
    coda.pos -= keep;
    codaChanged();
  }
  function codaSvuota() { coda.items = []; coda.pos = -1; codaChanged(); }

  function trovaLista(id) { for (var i = 0; i < liste.length; i++) if (liste[i].id === id) return liste[i]; return null; }
  function listaNuova(nome, items) {
    if (liste.length >= MAX_LISTE) { toast('Al massimo ' + MAX_LISTE + ' liste.'); return null; }
    var l = { id: newId(), nome: cleanNome(nome) || ('Lista ' + (liste.length + 1)), items: items.slice(0, MAX_ITEMS).map(function (x) { return { n: x.n, voice: x.voice }; }) };
    liste.push(l);
    saveListe();
    return l;
  }
  function listaPlay(id, da) {
    var l = trovaLista(id);
    if (!l) return;
    coda.items = l.items.map(function (x) { return { n: x.n, voice: x.voice }; });
    da = da || 0;
    var i = -1, k;
    for (k = da; k < coda.items.length && i < 0; k++) if (okItem(coda.items[k])) i = k;
    for (k = 0; k < da && i < 0; k++) if (okItem(coda.items[k])) i = k;
    if (i >= 0) { playCodaAt(i); toast('In coda: «' + l.nome + '».'); }
    else { codaChanged(); toast('In «' + l.nome + '» non resta niente da ascoltare: le sue Sure sono escluse.'); }
  }

  /* ---------- riga «Coda e liste» nel lettore ---------- */
  var ICON_QUEUE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h12M4 11h12M4 16h7"/><path d="M16 14v6l4.5-3z" fill="currentColor" stroke="none"/></svg>';
  var ICON_MORE = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>';
  var ICON_UP = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>';
  var ICON_DOWN = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  var ICON_X = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  function moreBtn(s) {
    return '<button type="button" class="q-more-btn" data-menu-surah="' + s.n + '" aria-haspopup="dialog" aria-label="Altre azioni: ' + s.nome + '">' + ICON_MORE + '</button>';
  }
  function queueRowHtml() {
    var up = codaInArrivo(), nx = codaNext(), it = nx >= 0 ? coda.items[nx] : null, s = it && getSurah(it.n);
    return '<div class="q-queue-row">' +
      '<button type="button" class="btn secondary piccolo q-queue-btn" id="q-queue-btn" aria-haspopup="dialog">' + ICON_QUEUE + '<span>Coda e liste</span>' +
        (up ? '<span class="q-count">' + up + '<span class="visually-hidden"> in coda</span></span>' : '') + '</button>' +
      (s ? '<small class="tenue q-queue-next" id="q-queue-next">Dopo: ' + s.nome + (it.voice !== state.reciter ? ', con ' + voceCorta(it.voice) : '') + '</small>' : '') +
    '</div>';
  }

  /* ---------- avviso breve in basso ---------- */
  var toastT = null;
  function toast(msg) {
    var t = document.getElementById('q-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.classList.remove('show'); }, 2800);
  }

  /* ---------- menu «⋯» di una Sura ---------- */
  var menuIt = null;
  function openMenu(it) {
    if (!okItem(it) || !B.openDialog) return;
    menuIt = it;
    renderMenu('azioni');
    var card = document.getElementById('q-menu-card');
    B.openDialog(document.getElementById('q-menu'), card, card.querySelector('[data-mact]'));
  }
  function renderMenu(modo) {
    var card = document.getElementById('q-menu-card');
    if (!card || !menuIt) return;
    var s = getSurah(menuIt.n);
    var h = '<div class="q-menu-head">' + thumbHtml(s) + '<div><h2 id="q-menu-title">' + s.nome + ' <span class="q-ar">' + s.ar + '</span></h2>' +
      '<p class="sub">' + s.trad + ' · con ' + D.reciters[menuIt.voice].nome + '</p></div></div>';
    if (modo === 'azioni') {
      h += '<div class="q-menu-actions">' +
        '<button type="button" class="btn secondary" data-mact="dopo">Riproduci dopo</button>' +
        '<button type="button" class="btn secondary" data-mact="fondo">Aggiungi in fondo alla coda</button>' +
        '<button type="button" class="btn secondary" data-mact="liste" aria-haspopup="true">Aggiungi a una lista…</button>' +
        '<button type="button" class="btn q-menu-close" data-mact="chiudi">Annulla</button>' +
      '</div>';
    } else {
      h += '<h3>Aggiungi a una lista</h3><div class="q-menu-actions">' +
        liste.map(function (l) {
          return '<button type="button" class="btn secondary" data-mact="in-lista" data-id="' + l.id + '">' + esc(l.nome) + ' <small class="tenue">· ' + l.items.length + '</small></button>';
        }).join('') +
        '</div>' +
        '<form class="name-form q-menu-new" data-mform="nuova">' +
          '<label class="visually-hidden" for="q-menu-nuova">Nome della nuova lista</label>' +
          '<input type="text" id="q-menu-nuova" maxlength="40" placeholder="' + (liste.length ? 'Oppure una lista nuova' : 'Nome della nuova lista') + '">' +
          '<button class="btn" type="submit">Crea</button>' +
        '</form>' +
        '<div class="sheet-actions"><button type="button" class="btn secondary" data-mact="indietro">Indietro</button></div>';
    }
    card.innerHTML = h;
  }
  function menuAction(act, id) {
    var s = getSurah(menuIt.n);
    if (act === 'chiudi') { B.closeDialog(); return; }
    if (act === 'liste') { renderMenu('liste'); var f = document.querySelector('#q-menu-card [data-mact="in-lista"]') || document.getElementById('q-menu-nuova'); if (f) f.focus(); return; }
    if (act === 'indietro') { renderMenu('azioni'); document.querySelector('#q-menu-card [data-mact="liste"]').focus(); return; }
    if (act === 'dopo') { if (codaAdd(menuIt, true)) toast(s.nome + ': la prossima in coda.'); B.closeDialog(); return; }
    if (act === 'fondo') { if (codaAdd(menuIt, false)) toast(s.nome + ': in fondo alla coda (' + codaInArrivo() + ' in arrivo).'); B.closeDialog(); return; }
    if (act === 'in-lista') {
      var l = trovaLista(id);
      if (!l) return;
      if (l.items.length >= MAX_ITEMS) { toast('La lista è piena.'); return; }
      l.items.push({ n: menuIt.n, voice: menuIt.voice });
      saveListe();
      renderCodaSheet();
      toast(s.nome + ': aggiunta a «' + l.nome + '».');
      B.closeDialog();
    }
  }

  /* ---------- finestra «Coda e liste» ---------- */
  var listeAperte = {};
  function openCoda() {
    var sheet = document.getElementById('q-coda'), card = document.getElementById('q-coda-card');
    if (!sheet || !card || !B.openDialog) return;
    sheet.hidden = false;      // renderCodaSheet disegna solo a finestra aperta
    renderCodaSheet();
    B.openDialog(sheet, card, card);
  }
  function itemHtml(it, i, lista) {
    var s = getSurah(it.n), ok = okItem(it), cls = '', stato = '';
    var L = lista ? lista.items.length : coda.items.length;
    var idA = lista ? ' data-id="' + lista.id + '"' : '';
    var pre = lista ? 'l-' : '';
    if (!ok) { cls = ' esclusa'; stato = ' · esclusa'; }
    else if (!lista && i === coda.pos && inAscolto(it)) { cls = ' ora'; stato = ' · in ascolto'; }
    else if (!lista && i <= coda.pos) { cls = ' fatta'; stato = ' · già ascoltata'; }
    var arrivo = lista || i > coda.pos;
    return '<li class="q-ci' + cls + '">' +
      '<button type="button" class="q-ci-main" data-act="' + pre + 'suona" data-i="' + i + '"' + idA + (ok ? '' : ' disabled') + ' aria-label="Ascolta ' + s.nome + ' con ' + voceCorta(it.voice) + '">' +
        thumbHtml(s) + '<span><strong>' + s.nome + '</strong><small>con ' + voceCorta(it.voice) + stato + '</small></span></button>' +
      (arrivo
        ? '<button type="button" class="q-ci-btn" data-act="' + pre + 'su" data-i="' + i + '"' + idA + ((lista ? i === 0 : i <= coda.pos + 1) ? ' disabled' : '') + ' aria-label="Sposta su: ' + s.nome + '">' + ICON_UP + '</button>' +
          '<button type="button" class="q-ci-btn" data-act="' + pre + 'giu" data-i="' + i + '"' + idA + (i >= L - 1 ? ' disabled' : '') + ' aria-label="Sposta giù: ' + s.nome + '">' + ICON_DOWN + '</button>'
        : '') +
      '<button type="button" class="q-ci-btn" data-act="' + pre + 'togli" data-i="' + i + '"' + idA + ' aria-label="Togli ' + (lista ? 'dalla lista' : 'dalla coda') + ': ' + s.nome + '">' + ICON_X + '</button>' +
    '</li>';
  }
  function renderCodaSheet(focusSel) {
    var sheet = document.getElementById('q-coda'), card = document.getElementById('q-coda-card');
    if (!sheet || !card || sheet.hidden) return;
    // dopo il ridisegno: stesso focus e stesso testo nei campi (si ridisegna anche mentre suona)
    var a = document.activeElement, valori = {};
    if (!focusSel && a && card.contains(a) && a !== card) {
      if (a.id) focusSel = '#' + a.id;
      else if (a.getAttribute('data-act')) focusSel = '[data-act="' + a.getAttribute('data-act') + '"]' + (a.getAttribute('data-i') ? '[data-i="' + a.getAttribute('data-i') + '"]' : '') + (a.getAttribute('data-id') ? '[data-id="' + a.getAttribute('data-id') + '"]' : '');
    }
    card.querySelectorAll('input[type="text"]').forEach(function (x) { if (x.id) valori[x.id] = x.value; });
    var stato = document.getElementById('q-coda-stato');
    var statoTxt = stato ? stato.textContent : '';

    var h = '<h2 id="q-coda-title">Coda</h2>' +
      '<p class="sub">Le Sure in coda partono una dopo l’altra, ognuna con la sua voce, prima di «Alla fine». Si aggiungono con il tasto ⋯ accanto a ogni Sura.</p>';
    if (coda.items.length) {
      h += '<ol class="q-coda-list" id="q-coda-list">' + coda.items.map(function (it, i) { return itemHtml(it, i, null); }).join('') + '</ol>';
    } else {
      h += '<p class="hint">La coda è vuota.</p>';
    }
    h += '<label class="check"><input type="checkbox" id="q-coda-ripeti"' + (coda.ripeti ? ' checked' : '') + '><span>Ripeti la coda<small class="tenue" style="display:block">Finita l’ultima Sura, ricomincia dalla prima.</small></span></label>';
    if (coda.items.length) {
      h += '<div class="sheet-actions">' +
        (coda.pos >= 0 ? '<button type="button" class="btn secondary piccolo" data-act="togli-fatte">Togli le già ascoltate</button>' : '') +
        '<button type="button" class="btn secondary piccolo" data-act="svuota">Svuota la coda</button></div>' +
        '<form class="name-form q-save-form" data-form="salva">' +
          '<label class="visually-hidden" for="q-coda-nome">Nome della lista</label>' +
          '<input type="text" id="q-coda-nome" maxlength="40" placeholder="Nome della lista">' +
          '<button class="btn secondary" type="submit">Salva come lista</button>' +
        '</form>';
    }
    h += '<h2 class="q-liste-title">Le tue liste</h2>';
    if (!liste.length) h += '<p class="hint">Ancora nessuna lista. Salva la coda come lista, oppure usa ⋯ → «Aggiungi a una lista».</p>';
    liste.forEach(function (l) {
      var nOk = l.items.filter(okItem).length;
      h += '<details class="q-lista" data-lista="' + l.id + '"' + (listeAperte[l.id] ? ' open' : '') + '>' +
        '<summary><span>' + esc(l.nome) + '</span> <small class="tenue">' + l.items.length + (l.items.length === 1 ? ' Sura' : ' Sure') + '</small></summary>' +
        '<div class="sheet-actions">' +
          '<button type="button" class="btn piccolo" data-act="l-ascolta" data-id="' + l.id + '"' + (nOk ? '' : ' disabled') + '>Ascolta</button>' +
          '<button type="button" class="btn secondary piccolo" data-act="l-coda" data-id="' + l.id + '"' + (nOk ? '' : ' disabled') + '>Metti in coda</button>' +
        '</div>' +
        (l.items.length ? '<ol class="q-coda-list">' + l.items.map(function (it, i) { return itemHtml(it, i, l); }).join('') + '</ol>' : '<p class="hint">La lista è vuota.</p>') +
        '<form class="name-form" data-form="rinomina" data-id="' + l.id + '">' +
          '<label class="visually-hidden" for="q-rin-' + l.id + '">Nuovo nome per ' + esc(l.nome) + '</label>' +
          '<input type="text" id="q-rin-' + l.id + '" maxlength="40" placeholder="Nuovo nome">' +
          '<button class="btn secondary piccolo" type="submit">Rinomina</button>' +
        '</form>' +
        '<button type="button" class="btn secondary piccolo q-danger" data-act="l-elimina" data-id="' + l.id + '">Elimina la lista</button>' +
      '</details>';
    });
    h += '<p class="hint" id="q-coda-stato" role="status" aria-live="polite"></p>' +
      '<div class="sheet-actions"><button type="button" class="btn" data-act="chiudi">Chiudi</button></div>';

    card.innerHTML = h;
    for (var k in valori) { var x = document.getElementById(k); if (x) x.value = valori[k]; }
    var st = document.getElementById('q-coda-stato'); if (st) st.textContent = statoTxt;
    if (focusSel) { var f = card.querySelector(focusSel); if (f && !f.disabled) f.focus(); else card.focus(); }
  }
  function codaStato(msg) { var st = document.getElementById('q-coda-stato'); if (st) st.textContent = msg; }

  function codaAction(act, i, id) {
    var l = id ? trovaLista(id) : null, t, s;
    switch (act) {
      case 'chiudi': B.closeDialog(); return;
      case 'suona': playCodaAt(i); return;
      case 'su': if (codaMove(i, -1)) renderCodaSheet('[data-act="su"][data-i="' + (i - 1) + '"]'); return;
      case 'giu': if (codaMove(i, 1)) renderCodaSheet('[data-act="giu"][data-i="' + (i + 1) + '"]'); return;
      case 'togli':
        s = getSurah(coda.items[i].n).nome;
        codaRemove(i);
        codaStato(s + ' tolta dalla coda.');
        renderCodaSheet('[data-act="togli"][data-i="' + Math.min(i, coda.items.length - 1) + '"]');
        return;
      case 'togli-fatte': codaTogliAscoltate(); codaStato('Tolte le Sure già ascoltate.'); renderCodaSheet('#q-coda-ripeti'); return;
      case 'svuota': codaSvuota(); codaStato('Coda svuotata.'); renderCodaSheet('#q-coda-ripeti'); return;
      case 'l-ascolta': listaPlay(id, 0); return;
      case 'l-suona': listaPlay(id, i); return;
      case 'l-coda':
        if (!l) return;
        t = 0;
        l.items.forEach(function (x) { if (coda.items.length < MAX_ITEMS) { coda.items.push({ n: x.n, voice: x.voice }); t++; } });
        codaChanged();
        codaStato('«' + l.nome + '» in coda: ' + t + (t === 1 ? ' Sura aggiunta.' : ' Sure aggiunte.'));
        return;
      case 'l-su': case 'l-giu':
        if (!l) return;
        var j = i + (act === 'l-su' ? -1 : 1);
        if (j < 0 || j >= l.items.length) return;
        t = l.items[i]; l.items[i] = l.items[j]; l.items[j] = t;
        saveListe();
        renderCodaSheet('[data-act="' + act + '"][data-i="' + j + '"][data-id="' + id + '"]');
        return;
      case 'l-togli':
        if (!l) return;
        s = getSurah(l.items[i].n).nome;
        l.items.splice(i, 1);
        saveListe();
        codaStato(s + ' tolta da «' + l.nome + '».');
        renderCodaSheet(l.items.length ? '[data-act="l-togli"][data-i="' + Math.min(i, l.items.length - 1) + '"][data-id="' + id + '"]' : '[data-act="l-ascolta"][data-id="' + id + '"]');
        return;
      case 'l-elimina':
        if (!l || !confirm('Eliminare la lista «' + l.nome + '»? Le Sure restano nell’elenco.')) return;
        liste = liste.filter(function (x) { return x.id !== id; });
        delete listeAperte[id];
        saveListe();
        codaStato('Lista «' + l.nome + '» eliminata.');
        renderCodaSheet('#q-coda-ripeti');
        return;
    }
  }

  function setupSheets() {
    var menu = document.getElementById('q-menu'), mcard = document.getElementById('q-menu-card');
    var cs = document.getElementById('q-coda'), ccard = document.getElementById('q-coda-card');
    if (menu && mcard && !menu._pronto) {
      menu._pronto = true;
      menu.addEventListener('click', function (e) { if (e.target === menu && B.closeDialog) B.closeDialog(); });
      mcard.addEventListener('click', function (e) {
        var b = e.target.closest('[data-mact]');
        if (b && mcard.contains(b)) menuAction(b.getAttribute('data-mact'), b.getAttribute('data-id'));
      });
      mcard.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!menuIt) return;
        var nome = cleanNome(document.getElementById('q-menu-nuova').value);
        var l = listaNuova(nome, [menuIt]);
        if (!l) return;
        renderCodaSheet();
        toast(getSurah(menuIt.n).nome + ': nella nuova lista «' + l.nome + '».');
        B.closeDialog();
      });
    }
    if (cs && ccard && !cs._pronto) {
      cs._pronto = true;
      cs.addEventListener('click', function (e) { if (e.target === cs && B.closeDialog) B.closeDialog(); });
      ccard.addEventListener('click', function (e) {
        var b = e.target.closest('[data-act]');
        if (!b || !ccard.contains(b) || b.disabled) return;
        codaAction(b.getAttribute('data-act'), parseInt(b.getAttribute('data-i'), 10), b.getAttribute('data-id'));
      });
      ccard.addEventListener('change', function (e) {
        if (e.target.id !== 'q-coda-ripeti') return;
        coda.ripeti = e.target.checked;
        codaChanged();
      });
      ccard.addEventListener('toggle', function (e) {
        var d = e.target;
        if (d.tagName === 'DETAILS' && d.getAttribute('data-lista')) listeAperte[d.getAttribute('data-lista')] = d.open;
      }, true);
      ccard.addEventListener('submit', function (e) {
        e.preventDefault();
        var f = e.target, tipo = f.getAttribute('data-form'), inp = f.querySelector('input'), nome = cleanNome(inp && inp.value);
        if (tipo === 'salva') {
          var l = listaNuova(nome, coda.items);
          if (!l) return;
          if (inp) inp.value = '';
          listeAperte[l.id] = true;
          codaStato('Coda salvata come «' + l.nome + '».');
          renderCodaSheet('[data-act="l-ascolta"][data-id="' + l.id + '"]');
        } else if (tipo === 'rinomina') {
          var x = trovaLista(f.getAttribute('data-id'));
          if (!x || !nome) return;
          x.nome = nome;
          saveListe();
          if (inp) inp.value = '';
          codaStato('Lista rinominata: «' + nome + '».');
          renderCodaSheet('[data-act="l-ascolta"][data-id="' + x.id + '"]');
        }
      });
    }
  }

  /* ---------- Sure escluse («Su Sakina») ---------- */
  var esclVoce = 'tutte', esclFiltro = '';
  function renderEscl() {
    var box = document.getElementById('q-escl');
    if (!box) return;
    box.innerHTML =
      '<p>Le Sure che non vuoi sentire con una certa voce. Con quella voce spariscono dall’elenco, dalla coda e dall’ascolto automatico; nelle proposte del giorno compaiono con un’altra voce. Puoi rimetterle quando vuoi.</p>' +
      '<label class="q-escl-voce">Voce<select id="q-escl-voce">' +
        '<option value="tutte"' + (esclVoce === 'tutte' ? ' selected' : '') + '>Tutte le voci</option>' +
        RECITERS.map(function (rid) { return '<option value="' + rid + '"' + (esclVoce === rid ? ' selected' : '') + '>' + D.reciters[rid].nome + '</option>'; }).join('') +
      '</select></label>' +
      '<p class="hint" id="q-escl-stato" role="status" aria-live="polite"></p>' +
      '<div class="q-escl-tools">' +
        '<input type="search" id="q-escl-cerca" placeholder="Cerca una Sura" aria-label="Cerca tra le Sure" autocomplete="off">' +
        '<button type="button" class="btn secondary piccolo" id="q-escl-reset">Rimetti tutte</button>' +
      '</div>' +
      '<div class="q-escl-list" id="q-escl-list" role="group" aria-label="Sure da escludere"></div>';
    var sel = document.getElementById('q-escl-voce');
    sel.addEventListener('change', function () { esclVoce = sel.value; renderEsclList(); });
    var cerca = document.getElementById('q-escl-cerca');
    cerca.value = esclFiltro;
    cerca.addEventListener('input', function () { esclFiltro = cerca.value.toLowerCase().trim(); renderEsclList(); });
    document.getElementById('q-escl-reset').addEventListener('click', function () {
      delete escluse[esclVoce];
      esclMsg = esclVoce === 'tutte' ? 'Rimesse le Sure escluse per tutte le voci.' : 'Rimesse tutte le Sure di ' + D.reciters[esclVoce].nome + '.';
      applyExclChange();
    });
    document.getElementById('q-escl-list').addEventListener('change', function (e) {
      var cb = e.target, n = parseInt(cb.getAttribute('data-n'), 10);
      if (!n) return;
      var cand = JSON.parse(JSON.stringify(escluse));
      var l = cand[esclVoce] || [];
      if (cb.checked) { if (l.indexOf(n) < 0) l.push(n); } else l = l.filter(function (x) { return x !== n; });
      l = cleanNums(l);
      if (l.length) cand[esclVoce] = l; else delete cand[esclVoce];
      var vuota = voceSenzaSure(cand);
      if (vuota) { cb.checked = !cb.checked; var st0 = document.getElementById('q-escl-stato'); if (st0) st0.textContent = 'Non si può: ' + D.reciters[vuota].nome + ' resterebbe senza Sure.'; return; }
      escluse = cand;
      esclMsg = getSurah(n).nome + (cb.checked ? ' esclusa' : ' rimessa') + (esclVoce === 'tutte' ? ' per tutte le voci.' : ' con ' + D.reciters[esclVoce].nome + '.');
      applyExclChange();
    });
    renderEsclList();
  }
  var esclMsg = '';   // ultima azione, detta prima del riepilogo
  function renderEsclList() {
    var list = document.getElementById('q-escl-list');
    if (!list) return;
    var rid = esclVoce, tutte = {}, mie = {};
    (escluse.tutte || []).forEach(function (n) { tutte[n] = true; });
    (escluse[rid] || []).forEach(function (n) { mie[n] = true; });
    var base = rid === 'tutte' ? D.surahs : baseSurahs(rid), f = esclFiltro;
    var vis = base.filter(function (s) { return !f || String(s.n) === f || s.nome.toLowerCase().indexOf(f) >= 0 || s.trad.toLowerCase().indexOf(f) >= 0; });
    var focusN = document.activeElement && list.contains(document.activeElement) ? document.activeElement.getAttribute('data-n') : null;
    list.innerHTML = vis.length ? vis.map(function (s) {
      var perTutte = rid !== 'tutte' && tutte[s.n];
      return '<label class="check q-escl-item"><input type="checkbox" data-n="' + s.n + '"' + ((mie[s.n] || perTutte) ? ' checked' : '') + (perTutte ? ' disabled' : '') + '>' +
        '<span>' + s.n + '. ' + s.nome + '<small class="tenue">' + s.trad + (perTutte ? ' · esclusa per tutte le voci' : '') + '</small></span></label>';
    }).join('') : '<p class="hint">Nessuna Sura trovata.</p>';
    if (focusN) { var fe = list.querySelector('[data-n="' + focusN + '"]'); if (fe) fe.focus(); }
    var n = (escluse[rid] || []).length, nt = (escluse.tutte || []).length;
    var reset = document.getElementById('q-escl-reset');
    if (reset) reset.disabled = !n;
    var riepilogo = rid === 'tutte'
      ? (n ? (n === 1 ? 'Una Sura esclusa' : n + ' Sure escluse') + ' per tutte le voci.' : 'Nessuna Sura esclusa per tutte le voci.')
      : (n ? (n === 1 ? 'Una Sura esclusa' : n + ' Sure escluse') + ' con ' + D.reciters[rid].nome : 'Nessuna Sura esclusa solo con ' + D.reciters[rid].nome) +
        (nt ? ' (più ' + nt + ' per tutte le voci).' : '.');
    var st = document.getElementById('q-escl-stato');
    if (st) st.textContent = esclMsg ? esclMsg + ' ' + riepilogo : riepilogo;
    esclMsg = '';
  }
  function applyExclChange() {
    try {
      if (Object.keys(escluse).length) localStorage.setItem(ESCL_KEY, JSON.stringify(escluse));
      else localStorage.removeItem(ESCL_KEY);
    } catch (e) {}
    rebuildExcl();
    if (!isAllowed(state.reciter, state.surah)) {
      if (state.playing || state.loading) resetMedia();     // non si continua ad ascoltare una Sura appena esclusa
      state.surah = neighbour(state.surah, 1) || neighbour(state.surah, -1) || reciterSurahs(state.reciter)[0].n;
      saveSettings();
    }
    renderPlayerCard();
    renderMoment(true);
    renderRecommended();
    renderAllSurahs();
    renderEsclList();
  }

  // Esporta interfaccia pubblica
  B.QuranPlayer = {
    _coda: function () { return JSON.parse(JSON.stringify(coda)); },
    _liste: function () { return JSON.parse(JSON.stringify(liste)); },
    _escluse: function () { return JSON.parse(JSON.stringify(escluse)); },
    _debugSeekEnd: function (sec) { if (audioEl.duration) audioEl.currentTime = Math.max(0, audioEl.duration - sec); },
    refreshEscl: renderEscl,
    _debugSleep: function (sec) { sleepClear(); state.sleepMin = 1; state.sleepEnd = Date.now() + sec * 1000; sleepIv = setInterval(sleepTick, 1000); sleepLabel(); },
    _debugState: function () { return { surah: state.surah, playing: state.playing, loading: state.loading, scrub: state.scrub, endMode: state.endMode, fading: fading, sleepMin: state.sleepMin, paused: audioEl.paused, src: (audioEl.getAttribute('src') || '').slice(-7), reciter: state.reciter, time: audioEl.currentTime }; },
    _debug: function () { return { audioEl: audioEl === elRouted ? 'routed' : 'plain', routedFailed: routedFailed, master: bgMaster(), gain: levelDb(state.reciter, state.surah) }; },
    refreshMoment: function () { renderMoment(false); },
    init: function () {
      renderView();
      setupSheets();
      renderEscl();
      migrateOldCache().then(updateCacheIndex);
    },
    playSurah: playSurah,
    togglePlay: togglePlay,
    stop: function () {
      audioEl.pause();
      state.playing = false;
      syncBackgroundSound(false);
      renderPlayerCard();
    }
  };

})();
