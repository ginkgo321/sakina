/* Sakina – motore audio.
   Fa due cose: (1) porta la voce delle recitazioni attraverso un guadagno e un limitatore, per pareggiare il livello
   delle registrazioni (attachMedia, setMediaGainDb, fadeMedia); (2) produce un sottofondo di natura sotto la voce:
   registrazioni vere (audio/natura) e, mentre si caricano, versioni sintetiche generate nel browser (Web Audio).
   Le variazioni lente (onde, vento, ruscello) usano oscillatori e non timer JavaScript, così continuano a schermo bloccato.
   Nato dal motore di Bonaccia, tenuto con la stessa struttura di guadagni: i livelli di BG_REF in js/recitazioni.js valgono per entrambi. */
(function () {
  'use strict';

  var AC = window.AudioContext || window.webkitAudioContext;
  var TWO_PI = Math.PI * 2;

  function dbToGain(db) { return Math.pow(10, db / 20); }
  /* Volume generale del sottofondo: la barra va da -54 dB a -3 dB (curva in decibel, fine sui livelli bassi). */
  function masterCurve(v) { return v <= 0 ? 0 : dbToGain(-54 + 51 * v); }
  function layerCurve(v) { return v * v; }

  /* ---------- generatori di buffer ---------- */

  function normalize(buf, targetRms) {
    var d = buf.getChannelData(0), sum = 0, i;
    for (i = 0; i < d.length; i++) sum += d[i] * d[i];
    var rms = Math.sqrt(sum / d.length) || 1;
    var k = targetRms / rms;
    for (var c = 0; c < buf.numberOfChannels; c++) {
      var ch = buf.getChannelData(c);
      for (i = 0; i < ch.length; i++) {
        var x = ch[i] * k;
        ch[i] = x > 0.98 ? 0.98 : (x < -0.98 ? -0.98 : x);
      }
    }
  }

  /* Rumore rosa o marrone, con le due estremità fuse (anello senza stacchi). */
  function genNoise(ctx, type, seconds) {
    var sr = ctx.sampleRate, n = Math.floor(sr * seconds), cf = Math.floor(sr * 0.3);
    var buf = ctx.createBuffer(2, n, sr);
    for (var c = 0; c < 2; c++) {
      var g = new Float32Array(n + cf), i, w;
      var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
      for (i = 0; i < n + cf; i++) {
        w = Math.random() * 2 - 1;
        if (type === 'pink') {
          b0 = 0.99886 * b0 + w * 0.0555179;
          b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856;
          b4 = 0.55 * b4 + w * 0.5329522;
          b5 = -0.7616 * b5 - w * 0.016898;
          g[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
          b6 = w * 0.115926;
        } else {
          last = (last + 0.02 * w) / 1.02;
          g[i] = last * 3.5;
        }
      }
      var out = buf.getChannelData(c);
      for (i = 0; i < n; i++) {
        if (i < cf) {
          var a = (i / cf) * Math.PI / 2;
          out[i] = g[i] * Math.sin(a) + g[n + i] * Math.cos(a);
        } else {
          out[i] = g[i];
        }
      }
    }
    normalize(buf, 0.25);
    return buf;
  }

  /* Pioggia: fruscio acuto più gocce casuali. L'anello è continuo perché le gocce "girano" intorno. */
  function genRain(ctx, seconds) {
    var sr = ctx.sampleRate, n = Math.floor(sr * seconds);
    var buf = ctx.createBuffer(2, n, sr);
    for (var c = 0; c < 2; c++) {
      var d = buf.getChannelData(c), i, lp = 0, w;
      for (i = 0; i < n; i++) {
        w = Math.random() * 2 - 1;
        lp += 0.12 * (w - lp);
        d[i] = (w - lp) * 0.12;
      }
      var drops = Math.floor(seconds * 70);
      for (var k = 0; k < drops; k++) {
        var p = Math.floor(Math.random() * n);
        var a = Math.pow(Math.random(), 2) * 0.9 + 0.05;
        var tau = 0.002 + Math.random() * 0.006;
        var fr = 1800 + Math.random() * 4500;
        var len = Math.floor(sr * tau * 6);
        for (var j = 0; j < len; j++) {
          var t = j / sr;
          d[(p + j) % n] += a * Math.sin(TWO_PI * fr * t) * Math.exp(-t / tau) * 0.5;
        }
      }
    }
    normalize(buf, 0.25);
    return buf;
  }

  /* Un secondo di silenzio come file audio: tiene viva la sessione audio di iOS a schermo bloccato. */
  function silentWavUrl() {
    var sr = 8000, n = sr, bytes = new Uint8Array(44 + n);
    var dv = new DataView(bytes.buffer);
    function str(o, s) { for (var i = 0; i < s.length; i++) bytes[o + i] = s.charCodeAt(i); }
    str(0, 'RIFF'); dv.setUint32(4, 36 + n, true); str(8, 'WAVE'); str(12, 'fmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, sr, true); dv.setUint32(28, sr, true); dv.setUint16(32, 1, true);
    dv.setUint16(34, 8, true); str(36, 'data'); dv.setUint32(40, n, true);
    for (var i = 0; i < n; i++) bytes[44 + i] = 128;
    return URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
  }

  /* ---------- strati ---------- */

  function osc(ctx, freq, dest, depth) {
    var o = ctx.createOscillator(); o.frequency.value = freq;
    var g = ctx.createGain(); g.gain.value = depth;
    o.connect(g); g.connect(dest); o.start();
    return o;
  }

  function loopSrc(ctx, buffer) {
    var s = ctx.createBufferSource();
    s.buffer = buffer; s.loop = true;
    s.start(0, Math.random() * buffer.duration);
    return s;
  }

  function buildWaves(ctx, B) {
    var out = ctx.createGain(); out.gain.value = 0;
    var env = ctx.createGain(); env.gain.value = 0.5;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600; lp.Q.value = 0.5;
    loopSrc(ctx, B.brown).connect(lp); lp.connect(env); env.connect(out);
    osc(ctx, 0.083, env.gain, 0.3); osc(ctx, 0.0517, env.gain, 0.2);
    osc(ctx, 0.083, lp.frequency, 400); osc(ctx, 0.0517, lp.frequency, 250);
    var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1500;
    var foam = ctx.createGain(); foam.gain.value = 0.07;
    loopSrc(ctx, B.pink).connect(hp); hp.connect(foam); foam.connect(out);
    osc(ctx, 0.083, foam.gain, 0.06); osc(ctx, 0.0517, foam.gain, 0.04);
    return { out: out, trim: 0.95, set: function () {} };
  }

  function buildStream(ctx, B) {
    var out = ctx.createGain(); out.gain.value = 0;
    var src = loopSrc(ctx, B.pink);
    var bands = [[520, 150, 2.3, 1.7], [940, 260, 3.1, 2.9], [1650, 420, 4.3, 3.7]];
    bands.forEach(function (b) {
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = b[0]; bp.Q.value = 4;
      var g = ctx.createGain(); g.gain.value = 0.55;
      src.connect(bp); bp.connect(g); g.connect(out);
      osc(ctx, b[2], bp.frequency, b[1]);
      osc(ctx, b[3], g.gain, 0.4);
    });
    var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 700;
    var body = ctx.createGain(); body.gain.value = 0.08;
    src.connect(hp); hp.connect(body); body.connect(out);
    return { out: out, trim: 3.4, set: function () {} };
  }

  function buildWind(ctx, B) {
    var out = ctx.createGain(); out.gain.value = 0;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 450; lp.Q.value = 0.7;
    var env = ctx.createGain(); env.gain.value = 0.5;
    loopSrc(ctx, B.brown).connect(lp); lp.connect(env); env.connect(out);
    osc(ctx, 0.037, lp.frequency, 300); osc(ctx, 0.021, lp.frequency, 180);
    osc(ctx, 0.029, env.gain, 0.3); osc(ctx, 0.047, env.gain, 0.18);
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.9;
    var whistle = ctx.createGain(); whistle.gain.value = 0.05;
    loopSrc(ctx, B.pink).connect(bp); bp.connect(whistle); whistle.connect(out);
    osc(ctx, 0.029, whistle.gain, 0.04);
    return { out: out, trim: 1.05, set: function () {} };
  }

  /* Ciclo senza stacchi su un buffer decodificato: la coda sfuma dentro l'inizio (equipotenza). */
  function crossfadeLoop(ctx, buf, cfSec) {
    var sr = buf.sampleRate, n = buf.length;
    var cf = Math.min(Math.floor(sr * cfSec), Math.floor(n * 0.25));
    var out = ctx.createBuffer(buf.numberOfChannels, n - cf, sr);
    for (var c = 0; c < buf.numberOfChannels; c++) {
      var a = buf.getChannelData(c), o = out.getChannelData(c), i;
      for (i = 0; i < n - cf; i++) o[i] = a[i];
      for (i = 0; i < cf; i++) {
        var w = (i / cf) * Math.PI / 2;
        o[i] = a[i] * Math.sin(w) + a[n - cf + i] * Math.cos(w);
      }
    }
    return out;
  }

  /* Strato con due sorgenti: quella sintetica (sempre pronta) e quella registrata (si carica da file).
     Finché la registrazione non c'è, o in modalità «sintetico», suona la sintetica. */
  function makeSourced(ctx, synth, synthTrim, realTrim) {
    var out = ctx.createGain(); out.gain.value = 0;
    var realGate = ctx.createGain(); realGate.gain.value = 0; realGate.connect(out);
    var synthGate = null, src = null, mode = 'real';
    if (synth) {
      synth.out.gain.value = 1;
      synthGate = ctx.createGain(); synthGate.gain.value = synthTrim;
      synth.out.connect(synthGate); synthGate.connect(out);
    }
    function route(t) {
      var useReal = mode === 'real' && !!src;
      if (synthGate) synthGate.gain.setTargetAtTime(useReal ? 0 : synthTrim, t, 0.5);
      realGate.gain.setTargetAtTime(useReal ? realTrim : 0, t, 0.5);
    }
    return {
      out: out, trim: 1,
      set: function (s, t) { if (synth && synth.set) synth.set(s, t); route(t); },
      setMode: function (m, t) { mode = m; route(t); },
      setReal: function (buf, t) {
        if (src) { try { src.stop(); } catch (e) {} }
        src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(realGate);
        src.start(0, Math.random() * buf.duration);
        route(t);
      }
    };
  }

  var REAL_TRIM = 2.6;
  /* Correzione per registrazione (dB), per portarle tutte allo stesso livello (circa -19,5 LUFS misurati
     sui file in audio/natura, vedi docs/analisi_suoni.md): il fiume era 3 dB sopra. */
  var REAL_ADJ_DB = { stream: -2.9 };
  function realTrim(n) { return REAL_TRIM * dbToGain(REAL_ADJ_DB[n] || 0); }
  function buildAll(ctx) {
    var B = { pink: genNoise(ctx, 'pink', 8), brown: genNoise(ctx, 'brown', 8), rain: genRain(ctx, 10) };
    var rainSynth = (function () {
      var out = ctx.createGain(); out.gain.value = 0;
      loopSrc(ctx, B.rain).connect(out);
      return { out: out, trim: 0.9, set: function () {} };
    })();
    var waves = buildWaves(ctx, B), stream = buildStream(ctx, B);
    return {
      waves: makeSourced(ctx, waves, waves.trim, REAL_TRIM),
      rain: makeSourced(ctx, rainSynth, rainSynth.trim, REAL_TRIM),
      stream: makeSourced(ctx, stream, stream.trim, realTrim('stream')),
      wind: buildWind(ctx, B)
    };
  }

  /* ---------- motore ---------- */

  var DEFAULT_LAYERS = {
    waves:  { on: false, vol: 0.7 },
    rain:   { on: false, vol: 0.7 },
    stream: { on: false, vol: 0.7 },
    wind:   { on: false, vol: 0.7 }
  };
  var LAYER_NAMES = ['waves', 'rain', 'stream', 'wind'];
  var REAL_FILES = { rain: 'pioggia', waves: 'mare', stream: 'fiume' };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  var E = {
    ctx: null, layers: null, playing: false, masterV: 0.5, title: 'Sakina',
    layerState: clone(DEFAULT_LAYERS), listeners: [], keep: null,
    source: 'real', realState: {}, bufCache: {},

    onChange: function (fn) { this.listeners.push(fn); },
    emit: function () { var self = this; this.listeners.forEach(function (f) { f(self); }); },

    supported: !!AC,

    ensure: function () {
      if (!AC) return false;
      if (!this.ctx) {
        try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
        var ctx = this.ctx = new AC({ latencyHint: 'playback' });
        this.master = ctx.createGain(); this.master.gain.value = 0;
        this.limiter = ctx.createDynamicsCompressor();
        this.limiter.threshold.value = -10; this.limiter.knee.value = 8; this.limiter.ratio.value = 12;
        this.limiter.attack.value = 0.003; this.limiter.release.value = 0.25;
        this.master.connect(this.limiter); this.limiter.connect(ctx.destination);
        this.layers = buildAll(ctx);
        for (var i = 0; i < LAYER_NAMES.length; i++) this.layers[LAYER_NAMES[i]].out.connect(this.master);
        this._applyLayers();
        var self = this;
        ctx.onstatechange = function () { self.emit(); };
      }
      if (this.ctx.state !== 'running') { try { this.ctx.resume(); } catch (e) {} }
      return true;
    },

    /* Un file audio silenzioso in ciclo: iOS tiene attiva la sessione audio anche a schermo bloccato. */
    _keepAlive: function (on) {
      if (!this.keep) {
        var a = document.createElement('audio');
        a.loop = true; a.setAttribute('playsinline', ''); a.src = silentWavUrl(); a.volume = 1;
        this.keep = a;
      }
      if (on) { var p = this.keep.play(); if (p && p.catch) p.catch(function () {}); } else { this.keep.pause(); }
    },

    start: function (fade) {
      if (!this.ensure()) return false;
      this.playing = true;
      this._keepAlive(true);
      this._applyMaster(fade == null ? 2 : fade);
      this.emit();
      return true;
    },

    stop: function (fade) {
      if (!this.ctx) return;
      fade = fade == null ? 2 : fade;
      this.playing = false;
      this._applyMaster(fade);
      var self = this;
      setTimeout(function () {
        if (!self.playing && !self.extActive) {
          try { self.ctx.suspend(); } catch (e) {}
          self._keepAlive(false);
        }
      }, fade * 1000 + 150);
      this.emit();
    },

    /* ---- audio esterno (le recitazioni): passa dal motore per poterne regolare il livello ----
       Il percorso ha un guadagno proprio (setMediaGainDb) e un limitatore a -3 dB, separato dal sottofondo. */
    extActive: false,
    attachMedia: function (el) {
      if (!this.ensure()) return false;
      var ctx = this.ctx;
      if (!this.vgain) {
        this.vgain = ctx.createGain(); this.vgain.gain.value = 1;
        this.vlimit = ctx.createDynamicsCompressor();
        this.vlimit.threshold.value = -3; this.vlimit.knee.value = 0; this.vlimit.ratio.value = 20;
        this.vlimit.attack.value = 0.002; this.vlimit.release.value = 0.2;
        this.vgain.connect(this.vlimit); this.vlimit.connect(ctx.destination);
      }
      if (!el._sakSrc) {
        try { el._sakSrc = ctx.createMediaElementSource(el); el._sakSrc.connect(this.vgain); } catch (e) { return false; }
      }
      return true;
    },
    setMediaGainDb: function (db, immediate) {
      if (!this.vgain) return;
      var g = this.vgain.gain, t = this.ctx.currentTime;
      g.cancelScheduledValues(t);
      if (immediate) g.setValueAtTime(dbToGain(db), t); else g.setTargetAtTime(dbToGain(db), t, 0.05);
    },
    /* dissolvenza dell'audio esterno fino al silenzio in 'sec' secondi (timer di spegnimento) */
    fadeMedia: function (sec) {
      if (!this.vgain) return;
      var g = this.vgain.gain, t = this.ctx.currentTime;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(0.0001, t + Math.max(0.1, sec));
    },
    mediaActive: function (on) {
      this.extActive = !!on;
      if (on) { this.ensure(); return; }
      var self = this;
      setTimeout(function () {
        if (self.ctx && !self.extActive && !self.playing) { try { self.ctx.suspend(); } catch (e) {} }
      }, 300);
    },

    setMaster: function (v) {
      this.masterV = Math.max(0, Math.min(1, v));
      this._applyMaster(0.15);
      this.emit();
    },

    _applyMaster: function (rampSec) {
      if (!this.ctx) return;
      var g = this.master.gain, t = this.ctx.currentTime;
      var target = this.playing ? masterCurve(this.masterV) : 0;
      var cur = g.value;
      g.cancelScheduledValues(t);
      g.setValueAtTime(cur, t);
      g.setTargetAtTime(target, t, rampSec / 3);
    },

    setLayers: function (map) {
      for (var i = 0; i < LAYER_NAMES.length; i++) {
        var n = LAYER_NAMES[i], base = clone(DEFAULT_LAYERS[n]);
        base.on = false;
        this.layerState[n] = Object.assign(base, map[n] || {});
      }
      this._applyLayers(); this.emit();
    },

    _applyLayers: function () {
      if (!this.ctx) return;
      var t = this.ctx.currentTime;
      for (var i = 0; i < LAYER_NAMES.length; i++) {
        var n = LAYER_NAMES[i], L = this.layers[n], s = this.layerState[n];
        if (L.setMode) L.setMode(this.source, t);
        L.set(s, t);
        L.out.gain.setTargetAtTime(s.on ? layerCurve(s.vol) * L.trim : 0, t, 0.1);
        if (s.on && this.source === 'real' && L.setReal) this._ensureReal(n);
      }
    },

    /* ---- registrazioni vere (file in audio/natura) ---- */
    loadBuffer: function (url) {
      var self = this;
      if (this.bufCache[url]) return this.bufCache[url];
      var p = fetch(url).then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then(function (ab) {
          return new Promise(function (res, rej) {
            var r = self.ctx.decodeAudioData(ab, res, rej);
            if (r && r.then) r.then(res, rej);
          });
        });
      p.catch(function () { delete self.bufCache[url]; });
      this.bufCache[url] = p;
      return p;
    },
    _ensureReal: function (n) {
      var st = this.realState[n];
      if (!REAL_FILES[n] || st === 'loading' || st === 'ready' || st === 'error') return;
      var self = this;
      this.realState[n] = 'loading';
      this.loadBuffer('audio/natura/natura_' + REAL_FILES[n] + '.mp3').then(function (buf) {
        self.layers[n].setReal(crossfadeLoop(self.ctx, buf, 3), self.ctx.currentTime);
        self.realState[n] = 'ready'; self.emit();
      }, function () { self.realState[n] = 'error'; self.emit(); });
    },
    realStatus: function (n) { return this.realState[n] || 'idle'; }
  };

  window.Sakina = window.Sakina || {};
  window.Sakina.Engine = E;
})();
