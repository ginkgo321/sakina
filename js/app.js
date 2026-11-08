/* Sakina – guscio dell'app: tema giorno e notte, finestra «Su Sakina», versione, avvio del lettore e service worker.
   Il lettore e l'elenco delle Sure stanno in js/recitazioni.js. */
(function () {
  'use strict';

  var S = window.Sakina = window.Sakina || {};
  function $(sel) { return document.querySelector(sel); }

  /* ---------- tema ---------- */
  var theme = null;     // 'day' | 'night' | null (segue il telefono)
  try { var t = localStorage.getItem('sakina.theme'); if (t === 'day' || t === 'night') theme = t; } catch (e) {}

  function applyTheme() {
    var t = theme || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day');
    document.documentElement.setAttribute('data-theme', t);
    var m = $('#meta-theme'); if (m) m.setAttribute('content', t === 'night' ? '#16140F' : '#F1EDE2');
    var b = $('#btn-theme');
    if (b) {
      b.setAttribute('aria-pressed', t === 'night' ? 'true' : 'false');
      b.setAttribute('aria-label', t === 'night' ? 'Passa al tema giorno' : 'Passa al tema notte');
    }
  }
  $('#btn-theme').addEventListener('click', function () {
    theme = document.documentElement.getAttribute('data-theme') === 'night' ? 'day' : 'night';
    try { localStorage.setItem('sakina.theme', theme); } catch (e) {}
    applyTheme();
  });
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { if (!theme) applyTheme(); }); } catch (e) {}
  applyTheme();

  /* ---------- versione (js/version.js, scritto da tools/aggiorna.py) ---------- */
  function renderVersion() {
    var el = $('#app-version'), V = S.Version;
    if (!el || !V) return;
    var m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(V.date || '');
    var mesi = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
    var quando = m ? parseInt(m[3], 10) + ' ' + mesi[parseInt(m[2], 10) - 1] + ' ' + m[1] + ', ore ' + m[4] + ':' + m[5] : '';
    el.innerHTML = 'Versione ' + V.v + (quando ? '<br>Ultimo aggiornamento: ' + quando : '') +
      '<span class="love">Made with love <span class="heart" aria-hidden="true">♥</span></span>';
  }

  /* ---------- finestre sovrapposte: «Su Sakina» e benvenuto ---------- */
  var openedSheet = null, opener = null;
  function openDialog(sheetEl, cardEl, focusEl) {
    opener = document.activeElement;
    openedSheet = sheetEl;
    sheetEl.hidden = false;
    cardEl.scrollTop = 0;
    (focusEl || cardEl).focus();
  }
  function closeDialog() {
    if (!openedSheet) return;
    openedSheet.hidden = true;
    openedSheet = null;
    if (opener && opener.focus && document.contains(opener)) opener.focus();
  }
  var sheet = $('#sheet'), hello = $('#hello');
  $('#btn-info').addEventListener('click', function () {
    $('#name-input').value = getName();
    openDialog(sheet, $('#sheet-card'));
  });
  $('#sheet-close').addEventListener('click', closeDialog);
  sheet.addEventListener('click', function (e) { if (e.target === sheet) closeDialog(); });
  hello.addEventListener('click', function (e) { if (e.target === hello) skipHello(); });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !openedSheet) return;
    if (openedSheet === hello) skipHello(); else closeDialog();
  });

  /* ---------- nome e saluto (il nome resta solo nel telefono, in localStorage) ---------- */
  function cleanName(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, 30); }
  function getName() { try { return cleanName(localStorage.getItem('sakina.nome')); } catch (e) { return ''; } }
  function setName(v) {
    v = cleanName(v);
    try {
      if (v) localStorage.setItem('sakina.nome', v); else localStorage.removeItem('sakina.nome');
      localStorage.setItem('sakina.nome_chiesto', '1');
    } catch (e) {}
    renderGreeting();
    return v;
  }
  function wasAsked() { try { return localStorage.getItem('sakina.nome_chiesto') === '1'; } catch (e) { return true; } }

  /* Saluto secondo l'ora: mattina, pomeriggio, sera, notte. */
  function greetingWord(d) {
    var h = (d || new Date()).getHours();
    if (h >= 5 && h < 12) return 'Buongiorno';
    if (h >= 12 && h < 18) return 'Buon pomeriggio';
    if (h >= 18 && h < 22) return 'Buonasera';
    return 'Buonanotte';
  }
  S.greetingWord = greetingWord;   // esposta per le prove
  function renderGreeting() {
    var name = getName(), g = $('#greet'), b = $('#greet-edit');
    g.textContent = greetingWord() + (name ? ', ' + name : '');   // textContent: il nome non è mai interpretato come HTML
    b.textContent = name ? 'Cambia il nome' : 'Aggiungi il tuo nome';
    b.hidden = false;
  }
  $('#greet-edit').addEventListener('click', function () { $('#hello-name').value = getName(); openDialog(hello, $('#hello-card'), $('#hello-name')); });
  function skipHello() {
    try { localStorage.setItem('sakina.nome_chiesto', '1'); } catch (e) {}
    closeDialog();
  }
  $('#hello-skip').addEventListener('click', skipHello);
  $('#hello-form').addEventListener('submit', function (e) { e.preventDefault(); setName($('#hello-name').value); closeDialog(); });
  $('#name-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = setName($('#name-input').value);
    $('#name-input').value = v;
    $('#name-hint').textContent = v ? 'Fatto: ti saluterò con «' + v + '».' : 'Nome tolto.';
  });
  renderGreeting();
  setInterval(renderGreeting, 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) renderGreeting(); });
  if (!wasAsked() && !getName()) openDialog(hello, $('#hello-card'), $('#hello-name'));

  /* ---------- avvio ---------- */
  renderVersion();
  if (S.QuranPlayer) S.QuranPlayer.init();

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
