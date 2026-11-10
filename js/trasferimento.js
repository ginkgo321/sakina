/* Sakina – trasferimento dei dati da un indirizzo all'altro.
   Sakina è nata su ginkgo321.github.io/sakina (sito «vecchio») e ora ha un indirizzo tutto suo (sito «nuovo»).
   La memoria del browser non passa da un indirizzo all'altro: l'utente porta i dati con un file o con un link.
   - Sito vecchio (RUOLO = 'vecchio'): solo LEGGE le chiavi di localStorage. Non scrive e non cancella niente:
     i dati restano lì e il sito continua a funzionare come prima.
   - Sito nuovo (RUOLO = 'nuovo'): riceve il file o il link, mostra cosa ha trovato e importa solo dopo il «sì» dell'utente.
   Questo file è identico nei due repository: cambia solo la riga RUOLO. */
(function () {
  'use strict';

  var S = window.Sakina = window.Sakina || {};
  var RUOLO = 'vecchio';                                   // 'vecchio' | 'nuovo'
  var INDIRIZZO_NUOVO = 'https://sakina.150796.xyz/';
  var INDIRIZZO_VECCHIO = 'ginkgo321.github.io/sakina';
  var FORMATO = 1;
  var PREFISSO = '#trasferisci=';
  /* Si trasferiscono solo queste chiavi: le nostre e la vecchia impostazione nata in Bonaccia. Nient'altro. */
  var CHIAVE_OK = /^(sakina\.[a-z_]{1,40}|bonaccia\.quran_settings)$/;
  var MAX_VALORE = 200000, MAX_TOTALE = 500000, MAX_CHIAVI = 20, MAX_LINK = 90000, MAX_FILE = 1000000;

  function $(sel) { return document.querySelector(sel); }
  function el(tag, classe, testo) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (testo != null) e.textContent = testo;       // sempre textContent: nome e liste dell'utente non sono mai HTML
    return e;
  }

  /* ---------- lettura e controllo dei dati ---------- */
  function raccogli() {
    var dati = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && CHIAVE_OK.test(k)) {
          var v = localStorage.getItem(k);
          if (typeof v === 'string') dati[k] = v;
        }
      }
    } catch (e) {}
    return dati;
  }
  function pacchetto() { return { app: 'sakina', formato: FORMATO, creato: new Date().toISOString(), dati: raccogli() }; }

  function valida(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj) || obj.app !== 'sakina') return { errore: 'Questo non è un salvataggio di Sakina.' };
    if (obj.formato !== FORMATO) return { errore: 'Il salvataggio viene da una versione che non conosco.' };
    var d = obj.dati;
    if (!d || typeof d !== 'object' || Array.isArray(d)) return { errore: 'Il salvataggio è rovinato.' };
    var chiavi = Object.keys(d), tot = 0;
    if (!chiavi.length) return { errore: 'Nel salvataggio non c’è niente da importare.' };
    if (chiavi.length > MAX_CHIAVI) return { errore: 'Il salvataggio è rovinato.' };
    for (var i = 0; i < chiavi.length; i++) {
      var k = chiavi[i], v = d[k];
      if (!CHIAVE_OK.test(k) || typeof v !== 'string' || v.length > MAX_VALORE) return { errore: 'Il salvataggio è rovinato.' };
      tot += v.length;
    }
    if (tot > MAX_TOTALE) return { errore: 'Il salvataggio è rovinato.' };
    return { dati: d };
  }

  /* ---------- link: i dati viaggiano nel «frammento» (#...), che il browser non invia a nessun server ---------- */
  function aBase64Url(testo) {
    var bytes = new TextEncoder().encode(testo), bin = '';
    for (var i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function daBase64Url(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }
  function creaLink() {
    var p = pacchetto();
    if (!Object.keys(p.dati).length) return null;
    var s = aBase64Url(JSON.stringify(p));
    return s.length > MAX_LINK ? null : INDIRIZZO_NUOVO + PREFISSO + s;
  }

  /* ---------- sito vecchio: «Esporta» (sola lettura) ---------- */
  function oggi() { var d = new Date(), z = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); }
  function salvaFile() {
    var p = pacchetto();
    if (!Object.keys(p.dati).length) return false;
    var url = URL.createObjectURL(new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' }));
    var a = el('a'); a.href = url; a.download = 'sakina-dati-' + oggi() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
    return true;
  }
  function disegnaVecchio(box) {
    box.appendChild(el('h3', null, 'Trasferisci i tuoi dati'));
    box.appendChild(el('p', null, 'Sakina ha ora un indirizzo tutto suo: ' + INDIRIZZO_NUOVO.replace(/^https:\/\//, '').replace(/\/$/, '') + '. Questa versione continua a funzionare e i tuoi dati qui restano dove sono. Se vuoi passare al nuovo indirizzo, porta con te il nome, le impostazioni, la coda e le liste.'));
    var az = el('div', 'sheet-actions');
    var bLink = el('button', 'btn', 'Apri il nuovo indirizzo con i miei dati'); bLink.type = 'button';
    var bFile = el('button', 'btn secondary', 'Salva i dati in un file'); bFile.type = 'button';
    az.appendChild(bLink); az.appendChild(bFile); box.appendChild(az);
    var hint = el('p', 'hint', 'Non cambia e non cancella niente qui. Le Sure salvate per ascoltare senza rete vanno scaricate di nuovo al nuovo indirizzo.');
    hint.setAttribute('role', 'status'); hint.setAttribute('aria-live', 'polite'); box.appendChild(hint);
    bLink.addEventListener('click', function () {
      var link = creaLink();
      if (link) { window.location.assign(link); return; }
      if (!Object.keys(raccogli()).length) { window.location.assign(INDIRIZZO_NUOVO); return; }   // niente da portare: si apre solo il nuovo indirizzo
      hint.textContent = 'I dati sono troppi per un link: salvali in un file e importalo al nuovo indirizzo.';
    });
    bFile.addEventListener('click', function () {
      hint.textContent = salvaFile() ? 'File salvato. Al nuovo indirizzo, in «Su Sakina», scegli «Importa da un file».' : 'Qui non ci sono ancora dati da salvare.';
    });
  }

  /* ---------- sito nuovo: «Importa» ---------- */
  var dialogo = null, schedaDialogo = null, aperto = false;
  function creaDialogo() {
    if (dialogo) return;
    dialogo = el('div', 'sheet'); dialogo.id = 'trasf'; dialogo.hidden = true;
    dialogo.setAttribute('role', 'dialog'); dialogo.setAttribute('aria-modal', 'true'); dialogo.setAttribute('aria-labelledby', 'trasf-titolo');
    schedaDialogo = el('div', 'sheet-card'); schedaDialogo.id = 'trasf-card'; schedaDialogo.tabIndex = -1;
    dialogo.appendChild(schedaDialogo); document.body.appendChild(dialogo);
    dialogo.addEventListener('click', function (e) { if (e.target === dialogo) chiudiESvuota(); });
    /* Non si guarda dialogo.hidden: il gestore di Esc di app.js (registrato prima) chiude già la finestra. */
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && aperto) chiudiESvuota(); });
  }
  /* Si chiude ricaricando la pagina senza frammento: riparte il normale primo avvio (o l'app con i dati appena importati). */
  function chiudiESvuota() { window.location.replace(window.location.pathname + window.location.search); }

  function contaJson(testo, quale) {
    try {
      var x = JSON.parse(testo);
      if (quale === 'lista') return Array.isArray(x) ? x.length : 0;
      if (quale === 'coda') return x && Array.isArray(x.items) ? x.items.length : 0;
      if (quale === 'escluse') return x && typeof x === 'object' ? Object.keys(x).length : 0;
    } catch (e) {}
    return 0;
  }
  function riepilogo(d) {
    var r = [], n;
    if (d['sakina.nome']) r.push('Il tuo nome: ' + d['sakina.nome'].slice(0, 30));
    if (d['sakina.settings'] || d['bonaccia.quran_settings']) r.push('Voce, sottofondo e altre impostazioni');
    if ((n = contaJson(d['sakina.liste'], 'lista'))) r.push(n + (n === 1 ? ' lista salvata' : ' liste salvate'));
    if ((n = contaJson(d['sakina.coda'], 'coda'))) r.push(n + (n === 1 ? ' Sura in coda' : ' Sure in coda'));
    if (contaJson(d['sakina.escluse'], 'escluse')) r.push('Le Sure escluse');
    if (d['sakina.theme']) r.push('Il tema ' + (d['sakina.theme'] === 'night' ? 'notte' : 'giorno'));
    if (!r.length) r.push('Le impostazioni dell’app');
    return r;
  }
  function haDatiQui(dati) {
    var qui = raccogli(), differenti = false;
    Object.keys(dati).forEach(function (k) { if (k !== 'sakina.nome_chiesto' && qui[k] != null && qui[k] !== dati[k]) differenti = true; });
    return differenti;
  }
  function scrivi(dati) {
    try { Object.keys(dati).forEach(function (k) { localStorage.setItem(k, dati[k]); }); return true; } catch (e) { return false; }
  }

  function mostraErrore(msg) {
    creaDialogo();
    schedaDialogo.textContent = '';
    var t = el('h2', null, 'Non riesco a importare'); t.id = 'trasf-titolo';
    schedaDialogo.appendChild(t);
    schedaDialogo.appendChild(el('p', null, msg + ' Non è stato cambiato niente.'));
    var az = el('div', 'sheet-actions'), b = el('button', 'btn', 'Chiudi'); b.type = 'button'; b.addEventListener('click', chiudiESvuota);
    az.appendChild(b); schedaDialogo.appendChild(az);
    if (S.closeDialog) S.closeDialog();      // chiude il «Benvenuto» o «Su Sakina» se sono aperti
    aperto = true;
    if (S.openDialog) S.openDialog(dialogo, schedaDialogo, b); else dialogo.hidden = false;
  }
  function mostraConferma(dati) {
    creaDialogo();
    schedaDialogo.textContent = '';
    var t = el('h2', null, 'Ho trovato i tuoi dati'); t.id = 'trasf-titolo';
    schedaDialogo.appendChild(t);
    schedaDialogo.appendChild(el('p', null, 'Vengono dall’altro indirizzo di Sakina. Restano nel tuo telefono e non vengono inviati a nessuno.'));
    var ul = el('ul'); riepilogo(dati).forEach(function (r) { ul.appendChild(el('li', null, r)); }); schedaDialogo.appendChild(ul);
    if (haDatiQui(dati)) schedaDialogo.appendChild(el('p', 'hint', 'Attenzione: qui hai già delle impostazioni diverse. Se importi, prendono il posto di quelle di qui.'));
    schedaDialogo.appendChild(el('p', 'hint', 'Le Sure salvate per ascoltare senza rete vanno scaricate di nuovo.'));
    var az = el('div', 'sheet-actions');
    var si = el('button', 'btn', 'Importa'); si.type = 'button';
    var no = el('button', 'btn secondary', 'Non adesso'); no.type = 'button';
    az.appendChild(si); az.appendChild(no); schedaDialogo.appendChild(az);
    no.addEventListener('click', chiudiESvuota);
    si.addEventListener('click', function () {
      if (!scrivi(dati)) { mostraErrore('Il telefono non mi lascia salvare i dati.'); return; }
      try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {}); } catch (e) {}
      schedaDialogo.textContent = '';
      var t2 = el('h2', null, 'Fatto'); t2.id = 'trasf-titolo';
      schedaDialogo.appendChild(t2);
      schedaDialogo.appendChild(el('p', null, 'I tuoi dati sono stati importati. Puoi continuare da qui.'));
      var az2 = el('div', 'sheet-actions'), ok = el('button', 'btn', 'Continua'); ok.type = 'button'; ok.addEventListener('click', chiudiESvuota);
      az2.appendChild(ok); schedaDialogo.appendChild(az2); ok.focus();
    });
    if (S.closeDialog) S.closeDialog();      // chiude il «Benvenuto» se l'app l'ha aperto
    aperto = true;
    if (S.openDialog) S.openDialog(dialogo, schedaDialogo, si); else dialogo.hidden = false;
  }

  function importaTesto(testo) {
    var obj;
    try { obj = JSON.parse(testo); } catch (e) { mostraErrore('Il file non si legge.'); return; }
    var v = valida(obj);
    if (v.errore) mostraErrore(v.errore); else mostraConferma(v.dati);
  }
  function daFrammento() {
    var h = window.location.hash || '';
    if (h.indexOf(PREFISSO) !== 0) return false;
    var payload = h.slice(PREFISSO.length);
    try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch (e) {}   // l'indirizzo con i dati non resta nella cronologia
    if (!payload || payload.length > MAX_LINK + 100) { mostraErrore('Il link è incompleto.'); return true; }
    var testo;
    try { testo = daBase64Url(payload); } catch (e) { mostraErrore('Il link è incompleto.'); return true; }
    importaTesto(testo);
    return true;
  }

  function disegnaNuovo(box) {
    box.appendChild(el('h3', null, 'Importa i tuoi dati'));
    box.appendChild(el('p', null, 'Hai già usato Sakina all’indirizzo ' + INDIRIZZO_VECCHIO + '? Lì, in «Su Sakina», scegli «Apri il nuovo indirizzo con i miei dati». Oppure importa qui il file che hai salvato.'));
    var az = el('div', 'sheet-actions');
    var b = el('button', 'btn secondary', 'Importa da un file'); b.type = 'button';
    var inp = el('input'); inp.type = 'file'; inp.accept = '.json,application/json'; inp.hidden = true; inp.id = 'trasf-file';
    az.appendChild(b); az.appendChild(inp); box.appendChild(az);
    b.addEventListener('click', function () { inp.value = ''; inp.click(); });
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0];
      if (!f) return;
      if (f.size > MAX_FILE) { mostraErrore('Il file è troppo grande.'); return; }
      var r = new FileReader();
      r.onload = function () { importaTesto(String(r.result)); };
      r.onerror = function () { mostraErrore('Il file non si legge.'); };
      r.readAsText(f);
    });
    /* Nel «Benvenuto» della prima apertura: per chi arriva da un altro indirizzo. */
    var card = $('#hello-card');
    if (card) {
      var p = el('p', 'hint'), bh = el('button', 'btn secondary piccolo', 'Ho già dei dati: importa da un file'); bh.type = 'button';
      p.appendChild(bh); card.appendChild(p);
      bh.addEventListener('click', function () { if (S.closeDialog) S.closeDialog(); inp.value = ''; inp.click(); });
    }
  }

  /* ---------- avvio ---------- */
  var box = $('#trasferimento');
  if (box) { if (RUOLO === 'nuovo') disegnaNuovo(box); else disegnaVecchio(box); }
  if (RUOLO === 'nuovo') daFrammento();

  S.Trasferimento = { ruolo: RUOLO, pacchetto: pacchetto, creaLink: creaLink, valida: valida, _importaTesto: importaTesto };   // esposta per le prove
})();
