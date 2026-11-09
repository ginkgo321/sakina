import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import os from 'node:os';
import { mkdirSync } from 'node:fs';
const SP = os.tmpdir().split(String.fromCharCode(92)).join('/') + '/sakina-prove/';
mkdirSync(SP, { recursive: true });
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',
  ['--headless=new', '--disable-gpu', '--autoplay-policy=no-user-gesture-required', '--remote-debugging-port=9391', '--user-data-dir=' + SP + 'prof_voci_e_protezione', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let targets;
for (let i = 0; i < 40; i++) {
  try { targets = await (await fetch('http://127.0.0.1:9391/json')).json(); if (targets.find(t => t.type === 'page')) break; } catch (e) {}
  await sleep(250);
}
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let id = 0; const pend = {}; const errs = [];
ws.addEventListener('message', m => {
  const d = JSON.parse(m.data);
  if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; }
  if (d.method === 'Runtime.exceptionThrown') errs.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
  if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errs.push('console.error: ' + d.params.args.map(a => a.value || a.description).join(' '));
  if (d.method === 'Page.javascriptDialogOpening') { errs.push('DIALOG: ' + d.params.message); send('Page.handleJavaScriptDialog', { accept: true }); }
});
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async expr => { const r = (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result; return r.result ? r.result.value : r; };
const shot = async name => writeFileSync(SP + name, Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'));
const J = x => JSON.stringify(x);
const ok = (nome, cond, extra = '') => console.log((cond ? 'OK   ' : 'FALLITO ') + nome + (extra ? '  ' + extra : ''));
const nums = () => ev(`[...document.querySelectorAll('#q-all-surahs-list [data-surah]')].map(e => +e.getAttribute('data-surah'))`);
const recs = () => ev(`[...document.querySelectorAll('#q-recommended-list [data-surah]')].map(e => +e.getAttribute('data-surah'))`);
const st = () => ev('Sakina.QuranPlayer._debugState()');
const WL = [1, 12, 19, 31, 93, 94, 95, 108, 112, 113, 114];

try {
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  // dal 9 novembre 2026 Afasy ha tutte le 114 Sure: una preferenza salvata con Ya-Sin + Afasy resta valida
  await send('Page.navigate', { url: 'http://127.0.0.1:8093/index.html' });
  await sleep(1500);
  await ev(`localStorage.setItem('sakina.nome_chiesto','1'); localStorage.setItem('sakina.settings', JSON.stringify({ reciter: 'afasy', surah: 36 }))`);
  await send('Page.reload', { ignoreCache: true });
  await sleep(2000);
  for (let i = 0; i < 40; i++) { if (await ev("document.readyState === 'complete' && !!window.Sakina && !!Sakina.QuranPlayer && !!document.getElementById('q-prog')")) break; await sleep(250); }
  await sleep(800);

  ok('5 voci tra i chip', (await ev(`document.querySelectorAll('[data-reciter]').length`)) === 5);
  let s0 = await st();
  ok('preferenza salvata con Ya-Sin + Afasy: resta Ya-Sin', s0.surah === 36 && s0.reciter === 'afasy', J({ surah: s0.surah }));
  let n0 = await nums();
  ok('Afasy: nell\'elenco tutte le 114 Sure', n0.length === 114, String(n0.length));
  console.log('     titolo elenco:', await ev(`document.getElementById('q-all-title').textContent`));
  await ev(`(() => { const e = document.getElementById('q-search-input'); e.value = 'ya'; e.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  let rs = await nums();
  ok('ricerca "ya" con Afasy: trova Ya-Sin', rs.includes(36), J(rs));
  await ev(`(() => { const e = document.getElementById('q-search-input'); e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await ev(`document.querySelector('#q-all-surahs-list [data-play-surah="36"]').click()`);
  await sleep(5000);
  let s1 = await st();
  ok('Afasy: parte Ya-Sin (036)', s1.playing && s1.surah === 36 && s1.src === '036.mp3', J(s1));
  const g36 = await ev(`Sakina.QuranLevels && Sakina.QuranLevels.gain && Sakina.QuranLevels.gain.afasy ? Sakina.QuranLevels.gain.afasy[36] : null`);
  ok('Afasy: livello misurato anche per Ya-Sin (pareggio del volume)', typeof g36 === 'number', String(g36));
  const mancanti = await ev(`(() => { const g = (Sakina.QuranLevels.gain || {}).afasy || {}; const m = []; for (let n = 1; n <= 114; n++) if (typeof g[n] !== 'number') m.push(n); return m; })()`);
  ok('Afasy: livelli misurati per tutte le 114 Sure', mancanti.length === 0, J(mancanti));
  await ev(`document.querySelector('#q-all-surahs-list [data-play-surah="35"]').click()`);
  await sleep(4000);
  await ev(`document.getElementById('q-next').click()`);
  await sleep(4000);
  let s3 = await st();
  ok('Afasy: dalla 35 la successiva è la 36', s3.surah === 36 && s3.reciter === 'afasy', J(s3));
  await ev(`document.getElementById('q-play-toggle').click()`); await sleep(500);

  // il meccanismo della selezione protetta resta nel codice: lo si prova con una selezione simulata
  await ev(`Sakina.QuranData.reciters.afasy.surahs = ${J(WL)}; Sakina.QuranPlayer.init();`);
  await sleep(800);
  await ev(`document.querySelector('[data-reciter=minshawi]').click()`); await sleep(400);
  await ev(`document.querySelector('[data-reciter=afasy]').click()`); await sleep(800);
  n0 = await nums();
  ok('selezione simulata: nell\'elenco solo le Sure ammesse', J(n0) === J(WL), J(n0));
  await ev(`(() => { const e = document.getElementById('q-search-input'); e.value = '36'; e.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  rs = await nums();
  ok('selezione simulata: la ricerca non trova una Sura esclusa', rs.length === 0, J(rs));
  await ev(`(() => { const e = document.getElementById('q-search-input'); e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await ev(`Sakina.QuranPlayer.playSurah(36)`);
  await sleep(1500);
  let s2 = await st();
  ok('selezione simulata: playSurah(36) rifiutato', !s2.playing && !s2.loading && s2.surah !== 36, J(s2));
  await ev(`(() => { const e = document.getElementById('q-end-select'); e.value = 'next'; e.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await ev(`document.querySelector('#q-all-surahs-list [data-play-surah="114"]').click()`);
  await sleep(4500);
  ok('selezione simulata: sull\'ultima ammessa il tasto successiva è disattivato', await ev(`document.getElementById('q-next').disabled`));
  await ev(`document.getElementById('q-play-toggle').click()`); await sleep(500);
  await ev(`delete Sakina.QuranData.reciters.afasy.surahs; Sakina.QuranPlayer.init();`);
  await sleep(800);
  ok('tolta la selezione simulata, Afasy torna a 114 Sure', (await nums()).length === 114);
  await shot('n1.png');

  // Salimi
  await ev(`document.querySelector('[data-reciter=salimi]').click()`);
  await sleep(600);
  ok('Salimi: tutte le 114 Sure', (await nums()).length === 114);
  const r2 = await recs();
  ok('Salimi: Al-Baqarah tra le consigliate', r2.includes(2), J(r2));
  console.log('     livello Al-Baqarah (dB):', await ev(`Sakina.QuranLevels && Sakina.QuranLevels.gain && Sakina.QuranLevels.gain.salimi ? Sakina.QuranLevels.gain.salimi[2] : 'tabella non ancora pronta'`));
  await ev(`document.querySelector('#q-recommended-list [data-play-surah="2"]').click()`);
  await sleep(7000);
  let s7 = await st();
  ok('Salimi: Al-Baqarah parte in streaming', s7.playing && s7.surah === 2, J(s7));
  console.log('     durata:', await ev(`document.getElementById('q-time-dur').textContent`));
  await shot('n2.png');
  // salvataggio offline: deve rifiutare (269 MB)
  await ev(`document.getElementById('q-more').open = true`);
  await ev(`document.getElementById('q-offline-btn').click()`);
  await sleep(3000);
  ok('Al-Baqarah: salvataggio offline rifiutato (troppo grande)', errs.some(e => /troppo grande/.test(e)), J(errs.filter(e => /DIALOG/.test(e))));
  await ev(`document.getElementById('q-play-toggle').click()`);
  console.log('ERRORI (esclusi i dialoghi attesi):', J(errs.filter(e => !/DIALOG/.test(e))));
} finally { ws.close(); chrome.kill(); }
process.exit(0);
