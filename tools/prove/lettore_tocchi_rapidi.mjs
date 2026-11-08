import { avvia, sleep, J } from './harness.mjs';
const b = await avvia(9368);
const { ev, vai, prova, T } = b;
await vai('#recitazioni', { attesa: "window.Sakina && Sakina.QuranPlayer && document.getElementById('q-prog')" });
const st = () => ev('Sakina.QuranPlayer._debugState()');
const click = sel => ev(`document.querySelector(${J(sel)}).click()`);
const coerente = s => !s.loading && (s.playing === !s.paused);
const fermo = async () => { for (let i = 0; i < 12; i++) { const s = await st(); if (!s.loading) return s; await sleep(500); } return st(); };
const cambia = (id, v) => ev(`(() => { const e = document.getElementById(${J(id)}); e.value = ${J(v)}; e.dispatchEvent(new Event('change', { bubbles: true })); })()`);

// 1. cinque righe in 60 ms
for (const n of [12, 19, 31, 36, 67]) { await click(`#q-all-surahs-list [data-play-surah="${n}"]`); await sleep(60); }
await sleep(5000);
let s = await fermo();
prova('5 Sure toccate di fila: vince l\'ultima (67), in riproduzione e coerente', s.surah === 67 && s.playing && !s.paused && /067\.mp3/.test(s.src) && coerente(s), J(s));
// 2. successiva x6, precedente x2
for (let i = 0; i < 6; i++) { await click('#q-next'); await sleep(50); }
for (let i = 0; i < 2; i++) { await click('#q-prev'); await sleep(50); }
await sleep(5000); s = await fermo();
prova('successiva ×6 poi precedente ×2 (a raffica): Sura 71', s.surah === 71 && s.playing && coerente(s), J(s));
// 3. play/pausa a raffica
for (let i = 0; i < 5; i++) { await click('#q-play-toggle'); await sleep(40); }
await sleep(2500); s = await fermo();
prova('play/pausa ×5 a raffica: lo stato corrisponde all\'audio', coerente(s), J(s));
console.log('     finisce', s.playing ? 'in riproduzione' : 'in pausa');
// 4. durante il caricamento: casella livelli, cambio voce, timer
await click('#q-all-surahs-list [data-play-surah="55"]'); await sleep(80);
await ev(`(() => { const c = document.getElementById('q-level'); if (c) { c.checked = !c.checked; c.dispatchEvent(new Event('change', { bubbles: true })); } })()`);
await sleep(80);
await ev(`document.querySelector('[data-reciter=hussary]').click()`); await sleep(80);
await cambia('q-sleep-select', '30');
await sleep(6000); s = await fermo();
prova('livelli + cambio voce + timer durante il caricamento: stato coerente', coerente(s) && s.reciter === 'hussary' && s.surah === 55, J(s));
await cambia('q-sleep-select', '0');
// 5. casella livelli mentre suona: stessa posizione
await sleep(1000);
const t0 = (await st()).time;
await ev(`(() => { const c = document.getElementById('q-level'); c.checked = !c.checked; c.dispatchEvent(new Event('change', { bubbles: true })); })()`);
await sleep(5000); s = await fermo();
prova('casella livelli mentre suona: continua dalla stessa posizione (±6 s)', s.playing && Math.abs(s.time - (t0 + 5)) < 6, 't0=' + t0.toFixed(1) + ' ora=' + s.time.toFixed(1));
await ev(`(() => { const c = document.getElementById('q-level'); if (!c.checked) { c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); } })()`);
await sleep(2500);
await click('#q-play-toggle'); await sleep(1500);

// 6. sottofondo: la pioggia parte con la recitazione e si spegne con la pausa
await ev(`document.getElementById('q-more').open = true`);
await cambia('q-bg-select', 'pioggia');
await click('#q-all-surahs-list [data-play-surah="55"]'); await sleep(5000);
const dur = await ev(`({ bg: !!Sakina._quranBgActive, eng: Sakina.Engine.playing, rain: Sakina.Engine.layerState.rain.on, waves: Sakina.Engine.layerState.waves.on })`);
prova('durante la recitazione il sottofondo è la pioggia', dur.bg && dur.eng && dur.rain && !dur.waves, J(dur));
await cambia('q-bg-select', 'onde'); await sleep(800);
const cb = await ev(`({ bg: !!Sakina._quranBgActive, eng: Sakina.Engine.playing, rain: Sakina.Engine.layerState.rain.on, waves: Sakina.Engine.layerState.waves.on })`);
prova('cambiando sottofondo a recitazione in corso passa alle onde', cb.bg && cb.eng && !cb.rain && cb.waves, J(cb));
await click('#q-play-toggle'); await sleep(4500);
const dopo = await ev(`({ eng: Sakina.Engine.playing, bg: !!Sakina._quranBgActive })`);
prova('dopo la pausa il sottofondo si ferma', !dopo.eng && !dopo.bg, J(dopo));
await cambia('q-bg-select', 'nessuno');

// 8. Ripeti: stessa Sura (Afasy 108)
await ev(`document.querySelector('[data-reciter=afasy]').click()`); await sleep(400);
await cambia('q-end-select', 'repeat');
await click('#q-all-surahs-list [data-play-surah="108"]'); await sleep(4000);
await ev(`(() => { const e = document.getElementById('q-prog'); e.value = 97; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); })()`);
await sleep(7000); s = await fermo();
prova('«Ripeti»: a fine Sura riparte la stessa (108), in riproduzione', s.surah === 108 && s.playing && s.time < 15, J(s));
await click('#q-play-toggle'); await sleep(500);
console.log('dialoghi:', J(T.dialoghi), ' errori JS:', J(T.errs));
prova('nessun errore JS e nessun avviso', T.errs.length === 0 && T.dialoghi.length === 0);
b.chiudi(); process.exit(0);
