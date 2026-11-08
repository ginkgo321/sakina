import { avvia, sleep, J } from './harness.mjs';
const b = await avvia(9397);
const { ev, send, vai, ricarica, prova, T } = b;
const AFASY = [1, 12, 19, 31, 93, 94, 95, 108, 112, 113, 114];
let scriptId = null;
async function oraFinta(h) {
  if (scriptId) await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: scriptId });
  const r = await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { const R = Date; const t0 = new R(2026, 10, 8, ${h}, 30).getTime(), s0 = R.now(); class D extends R { constructor(...a) { if (a.length) super(...a); else super(t0 + (R.now() - s0)); } static now() { return t0 + (R.now() - s0); } } window.Date = D; })();` });
  scriptId = r.result.identifier;
}
const leggi = () => ev(`({ titolo: (document.querySelector('#q-moment h2') || {}).textContent || '', sure: [...document.querySelectorAll('#q-moment-list [data-surah]')].map(e => +e.dataset.surah), saluto: document.getElementById('greet').textContent })`);
await vai('');
const casi = [[3, 'Per la notte', 'Buonanotte'], [8, 'Per il mattino', 'Buongiorno'], [14, 'Per il pomeriggio', 'Buon pomeriggio'], [20, 'Per la sera', 'Buonasera'], [23, 'Per la notte', 'Buonanotte']];
for (const [h, titolo, saluto] of casi) {
  await ev(`localStorage.clear(); localStorage.setItem('sakina.nome_chiesto','1')`);
  await oraFinta(h); await ricarica('');
  const r = await leggi();
  prova(`ore ${h}: «${titolo}» con 1-4 Sure e saluto coerente`, r.titolo === titolo && r.sure.length >= 1 && r.sure.length <= 4 && r.saluto.startsWith(saluto), J(r));
}
// con Afasy compaiono solo le sue 11 Sure, a tutte le ore
for (const h of [8, 14, 20, 3]) {
  await ev(`localStorage.setItem('sakina.settings', JSON.stringify({ reciter: 'afasy', surah: 108 }))`);
  await oraFinta(h); await ricarica('');
  const r = await leggi();
  prova(`Afasy, ore ${h}: proposte solo tra le Sure approvate (${r.sure.join(',') || 'nessuna'})`, r.sure.every(n => AFASY.includes(n)) && r.sure.length >= 1, J(r));
}
// cambio voce: l'elenco si aggiorna
await ev(`localStorage.setItem('sakina.settings', JSON.stringify({ reciter: 'minshawi', surah: 55 }))`);
await oraFinta(20); await ricarica('');
const prima = await leggi();
await ev(`document.querySelector('[data-reciter=afasy]').click()`); await sleep(500);
const dopo = await leggi();
prova('cambiando voce in Afasy le proposte della sera si riducono alle Sure approvate', prima.sure.length > dopo.sure.length && dopo.sure.every(n => AFASY.includes(n)), J({ prima: prima.sure, dopo: dopo.sure }));
// un tocco su «Ascolta» avvia la Sura
await ev(`document.querySelector('#q-moment-list [data-play-surah]').click()`); await sleep(4000);
const st = await ev(`Sakina.QuranPlayer._debugState()`);
prova('«Ascolta» nelle proposte avvia la Sura', st.playing && AFASY.includes(st.surah), J(st));
prova('nessun errore JS', T.errs.length === 0, J(T.errs));
b.chiudi(); process.exit(0);
