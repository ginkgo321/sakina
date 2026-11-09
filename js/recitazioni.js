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

  /* Sure disponibili con un recitatore: se ha «surahs», solo quelle (selezione protetta, vedi recitazioni_data.js) */
  function reciterSurahs(rid) {
    var r = D.reciters[rid];
    if (!r || !r.surahs) return D.surahs;
    return D.surahs.filter(function (s) { return r.surahs.indexOf(s.n) >= 0; });
  }
  function isAllowed(rid, n) {
    var r = D.reciters[rid];
    if (!r || typeof n !== 'number' || n % 1 !== 0 || n < 1 || n > D.surahs.length) return false;
    return !r.surahs || r.surahs.indexOf(n) >= 0;
  }
  function neighbour(n, dir) {
    var list = reciterSurahs(state.reciter);
    for (var i = 0; i < list.length; i++) {
      if (list[i].n === n) return list[i + dir] ? list[i + dir].n : null;
    }
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
  function goNext() { var n = neighbour(state.surah, 1); if (n) playSurah(n); }
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
      // a fine Sura: ferma, passa alla successiva o ripeti
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
        '<button type="button" class="q-nav" id="q-next" aria-label="Sura successiva"' + (neighbour(state.surah, 1) ? '' : ' disabled') + '>' + ICON_NEXT + '</button>' +
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
  }

  /* Proposte per il momento della giornata: solo Sure che esistono con la voce scelta (selezione protetta rispettata). */
  var lastBand = '';
  /* Una proposta (ora del giorno, venerdì, feste…) che non esiste con la voce scelta (voce con selezione protetta; oggi nessuna)
     si propone con la voce di riserva e la scritta «con Al-Minshawi»: la voce protetta resta con le sue sole Sure. */
  var VOCE_RISERVA = 'minshawi';
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
      '</div>';
  }
  function proposalItems(list, max, gia) {
    var out = [];
    list.forEach(function (n) {
      if (out.length >= max || (gia && gia[n])) return;
      if (isAllowed(state.reciter, n)) out.push({ n: n, voice: null });
      else if (VOCE_RISERVA !== state.reciter && isAllowed(VOCE_RISERVA, n)) out.push({ n: n, voice: VOCE_RISERVA });
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
    if (as) as.textContent = limited
      ? 'Con questa voce trovi queste Sure. Selezionane una per avviare l\'ascolto immediato.'
      : 'Puoi ascoltare in streaming qualsiasi Sura del Corano. Seleziona una Sura per avviare l\'ascolto immediato o salvarla per l\'uso senza rete.';
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

  // Esporta interfaccia pubblica
  B.QuranPlayer = {
    _debugSleep: function (sec) { sleepClear(); state.sleepMin = 1; state.sleepEnd = Date.now() + sec * 1000; sleepIv = setInterval(sleepTick, 1000); sleepLabel(); },
    _debugState: function () { return { surah: state.surah, playing: state.playing, loading: state.loading, scrub: state.scrub, endMode: state.endMode, fading: fading, sleepMin: state.sleepMin, paused: audioEl.paused, src: (audioEl.getAttribute('src') || '').slice(-7), reciter: state.reciter, time: audioEl.currentTime }; },
    _debug: function () { return { audioEl: audioEl === elRouted ? 'routed' : 'plain', routedFailed: routedFailed, master: bgMaster(), gain: levelDb(state.reciter, state.surah) }; },
    refreshMoment: function () { renderMoment(false); },
    init: function () {
      renderView();
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
