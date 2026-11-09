import { avvia, sleep, J } from './harness.mjs';
const b = await avvia(9400);
const { ev, send, vai, ricarica, prova, T } = b;
let scriptId = null;
async function quando(y, mo, d, h, mi = 0) {
  if (scriptId) await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: scriptId });
  const r = await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { const R = Date; const t0 = new R(${y}, ${mo - 1}, ${d}, ${h}, ${mi}).getTime(), s0 = R.now(); class D extends R { constructor(...a) { if (a.length) super(...a); else super(t0 + (R.now() - s0)); } static now() { return t0 + (R.now() - s0); } } window.Date = D; })();` });
  scriptId = r.result.identifier;
  await ricarica('');
}
const leggi = () => ev(`({ eventi: [...document.querySelectorAll('#q-special .q-special')].map(s => ({ id: s.dataset.evento, titolo: s.querySelector('h2').textContent, sure: [...s.querySelectorAll('[data-surah]')].map(e => +e.dataset.surah), nota: !!s.querySelector('.q-special-note') })), ora: (document.querySelector('#q-moment h2') || {}).textContent || '', saluto: document.getElementById('greet').textContent })`);
await vai('');
await ev(`localStorage.clear(); localStorage.setItem('sakina.nome_chiesto','1'); localStorage.setItem('sakina.nome','Anna')`);
const ids = r => r.eventi.map(e => e.id).join(',');
const casi = [
  ['venerdì 13 novembre 2026, ore 10', [2026, 11, 13, 10], r => ids(r) === 'venerdi' && r.eventi[0].titolo === 'Oggi è venerdì' && J(r.eventi[0].sure) === '[18,62]' && r.ora === 'Per il mattino' && r.saluto === 'Buongiorno, Anna'],
  ['giovedì 12 novembre, ore 18 (dopo il tramonto)', [2026, 11, 12, 18], r => ids(r) === 'venerdi' && r.eventi[0].titolo === 'Questa sera comincia il venerdì'],
  ['giovedì 12 novembre, ore 15', [2026, 11, 12, 15], r => ids(r) === ''],
  ['venerdì 13 novembre, ore 18 (dopo il tramonto)', [2026, 11, 13, 18], r => ids(r) === ''],
  ['Ramadan, mercoledì 10 febbraio 2027, ore 10', [2027, 2, 10, 10], r => ids(r) === 'ramadan' && J(r.eventi[0].sure) === '[97,2,96]' && r.eventi[0].nota],
  ['Ramadan, sabato 27 febbraio 2027, ore 21: notte del 21', [2027, 2, 27, 21], r => ids(r) === 'notte_destino,ramadan' && J(r.eventi[0].sure) === '[97,44]' && J(r.eventi[1].sure) === '[2,96]'],
  ['Ramadan, domenica 28 febbraio 2027, ore 3: ancora la notte del 21', [2027, 2, 28, 3], r => ids(r) === 'notte_destino,ramadan'],
  ['Ramadan, domenica 28 febbraio 2027, ore 10: giorno, niente notte', [2027, 2, 28, 10], r => ids(r) === 'ramadan'],
  ['Ramadan, venerdì 5 marzo 2027, ore 21: notte del 27 (venerdì finito)', [2027, 3, 5, 21], r => ids(r) === 'notte_destino,ramadan'],
  ['ʿĪd al-Fiṭr, martedì 9 marzo 2027, ore 10', [2027, 3, 9, 10], r => ids(r) === 'fitr' && J(r.eventi[0].sure) === '[87,88]' && r.saluto === 'ʿĪd mubārak, Anna'],
  ['ʿĪd al-Aḍḥā, domenica 16 maggio 2027, ore 10', [2027, 5, 16, 10], r => ids(r) === 'adha' && J(r.eventi[0].sure) === '[87,88,22]' && r.saluto === 'ʿĪd mubārak, Anna'],
  ['giorno qualunque, lunedì 9 novembre 2026, ore 10', [2026, 11, 9, 10], r => ids(r) === '' && r.saluto === 'Buongiorno, Anna'],
];
for (const [nome, d, ok] of casi) {
  await quando(...d);
  const r = await leggi();
  prova(nome, ok(r), J(r));
}
// voce con selezione protetta (simulata su Afasy): le Sure del venerdì compaiono «con Al-Minshawi»
await ev(`localStorage.setItem('sakina.settings', JSON.stringify({ reciter: 'afasy', surah: 108 }))`);
await quando(2026, 11, 13, 10);
const AFASY = [1, 12, 19, 31, 93, 94, 95, 108, 112, 113, 114];
await ev(`Sakina.QuranData.reciters.afasy.surahs = ${J(AFASY)}; Sakina.QuranPlayer.init();`); await sleep(500);   // selezione protetta simulata (oggi nessuna voce la usa)
let r = await ev(`({ voci: [...document.querySelectorAll('#q-special [data-surah]')].map(e => e.dataset.surah + ':' + (e.dataset.voice || '')), tag: (document.querySelector('#q-special .q-voice-tag') || {}).textContent, aria: (document.querySelector('#q-special [data-play-surah]') || { getAttribute: () => '' }).getAttribute('aria-label'), afasy: document.querySelector('[data-reciter].on').dataset.reciter })`);
prova('selezione simulata il venerdì: Al-Kahf e Al-Jumu’ah compaiono «con Al-Minshawi»', J(r.voci) === J(['18:minshawi', '62:minshawi']) && r.tag === 'con Al-Minshawi' && /Ascolta Al-Kahf con Al-Minshawi/.test(r.aria) && r.afasy === 'afasy', J(r));
await ev(`document.querySelector('#q-special [data-play-surah="18"]').click()`); await sleep(4000);
const st = await ev(`Sakina.QuranPlayer._debugState()`);
prova('«Ascolta» su Al-Kahf passa ad Al-Minshawi e la avvia', st.playing && st.surah === 18 && st.reciter === 'minshawi', J(st));
r = await leggi();
prova('dopo il passaggio la proposta non ha più la scritta «con …» (è la voce scelta)', ids(r) === 'venerdi' && (await ev(`document.querySelectorAll('#q-special [data-voice]').length`)) === 0, J(r));
// la selezione protetta resta: con Afasy una Sura fuori elenco non parte mai
await ev(`document.getElementById('q-play-toggle').click()`); await sleep(500);
await ev(`document.querySelector('[data-reciter=afasy]').click()`); await sleep(500);
await ev(`Sakina.QuranPlayer.playSurah(18)`); await sleep(1500);
const st2 = await ev(`Sakina.QuranPlayer._debugState()`);
prova('selezione simulata: Al-Kahf forzata dal codice non parte con quella voce', !st2.playing && st2.reciter === 'afasy' && st2.surah !== 18, J(st2));
prova('nessun errore JS', T.errs.length === 0, J(T.errs));
b.chiudi(); process.exit(0);
