// Sure escluse dall'utente («Su Sakina»): per una voce o per tutte, reversibili. Con quella voce spariscono da elenco,
// ricerca, precedente/successiva, fine Sura e coda; nelle proposte del giorno compaiono con un'altra voce; una voce non resta mai vuota.
import { avvia, sleep, J } from './harness.mjs';
const b = await avvia(9412, { w: 390, h: 844 });
const { ev, vai, ricarica, prova, T, shot } = b;
const st = () => ev(`Sakina.QuranPlayer._debugState()`);
const attendi = async (cond, ms = 15000) => { for (let t = 0; t < ms; t += 250) { if (await ev(cond) === true) return true; await sleep(250); } return false; };
const suona = (n, r) => attendi(`(() => { const s = Sakina.QuranPlayer._debugState(); return s.playing && !s.loading && s.surah === ${n} && s.reciter === '${r}' && s.time > 0.3; })()`, 20000);
const nums = () => ev(`[...document.querySelectorAll('#q-all-surahs-list [data-surah]')].map(e => +e.dataset.surah)`);
const voce = async v => { await ev(`(() => { const s = document.getElementById('q-escl-voce'); s.value = '${v}'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`); await sleep(150); };
const spunta = async n => { await ev(`document.querySelector('#q-escl-list [data-n="${n}"]').click()`); await sleep(150); };
const stato = () => ev(`document.getElementById('q-escl-stato').textContent`);

await vai('');
await ev(`localStorage.clear(); localStorage.setItem('sakina.nome_chiesto','1')`);   // voce Al-Minshawi, Sura 55
await ricarica('');

// 1. la sezione nelle impostazioni
await ev(`document.getElementById('btn-info').click()`); await sleep(300);
const sez = await ev(`({ n: document.querySelectorAll('#q-escl-list input[type=checkbox]').length, voce: document.getElementById('q-escl-voce').value, opz: document.getElementById('q-escl-voce').options.length, stato: document.getElementById('q-escl-stato').textContent })`);
prova('«Su Sakina» → Sure escluse: «Tutte le voci» + 5 voci, 114 caselle', sez.n === 114 && sez.voce === 'tutte' && sez.opz === 6 && /Nessuna/.test(sez.stato), J(sez));

// 2. escludere la Sura in corso con la sua voce
await voce('minshawi');
await spunta(55);
let s = await st();
prova('esclusa Ar-Raḥmān con Al-Minshawi: la Sura scelta passa alla 56', s.surah === 56, J(s));
prova('lo stato lo dice', /Raḥm.*esclusa con Mohamed Siddiq El-Minshawi/.test(await stato()) && /Una Sura esclusa/.test(await stato()), await stato());
let n = await nums();
prova('con Al-Minshawi la 55 sparisce dall\'elenco (113 Sure)', n.length === 113 && !n.includes(55), String(n.length));
const tit = await ev(`({ t: document.getElementById('q-all-title').textContent, s: document.getElementById('q-all-sub').textContent })`);
prova('titolo e avviso dell\'elenco', /\(113\)/.test(tit.t) && /Una Sura è esclusa/.test(tit.s) && /Su Sakina/.test(tit.s), J(tit));
await ev(`(() => { const e = document.getElementById('q-search-input'); e.value = 'rahm'; e.dispatchEvent(new Event('input', { bubbles: true })); })()`);
prova('la ricerca non la trova', (await nums()).length === 0);
await ev(`(() => { const e = document.getElementById('q-search-input'); e.value = ''; e.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await ev(`Sakina.QuranPlayer.playSurah(55)`); await sleep(1200);
s = await st();
prova('playSurah(55) con Al-Minshawi rifiutato', !s.playing && !s.loading && s.surah === 56, J(s));
await ev(`document.getElementById('sheet-close').click()`); await sleep(200);
await ev(`document.querySelector('[data-reciter=hussary]').click()`); await sleep(400);
prova('con Al-Hussary la 55 c\'è', (await nums()).includes(55));
await ev(`document.querySelector('[data-reciter=minshawi]').click()`); await sleep(400);

// 3. successiva e fine Sura la saltano
await ev(`Sakina.QuranPlayer.playSurah(54)`);
prova('parte la 54', await suona(54, 'minshawi'));
await ev(`document.getElementById('q-next').click()`);
prova('«successiva» dalla 54 salta alla 56', await suona(56, 'minshawi'), J(await st()));
await ev(`document.getElementById('q-prev').click()`);
prova('«precedente» dalla 56 salta alla 54', await suona(54, 'minshawi'), J(await st()));
await ev(`(() => { const e = document.getElementById('q-end-select'); e.value = 'next'; e.dispatchEvent(new Event('change', { bubbles: true })); })()`);
await ev(`Sakina.QuranPlayer._debugSeekEnd(1.2)`);
prova('«Alla fine: Prossima Sura» salta la 55', await suona(56, 'minshawi'), J(await st()));
await ev(`document.getElementById('q-play-toggle').click()`); await sleep(400);

// 4. proposte del giorno: con un'altra voce
const prima = await ev(`(() => { const m = Sakina.Momenti[Sakina.dayPart()]; return m && m.sure.find(x => x !== 55 && x !== 54 && x !== 56); })()`);
await ev(`document.getElementById('btn-info').click()`); await sleep(300);
await voce('minshawi'); await spunta(prima);
await ev(`document.getElementById('sheet-close').click()`); await sleep(300);
const pr = await ev(`(() => { const r = document.querySelector('#q-moment [data-surah="${prima}"]'); return r && { voce: r.dataset.voice, testo: r.querySelector('.q-voice-tag') && r.querySelector('.q-voice-tag').textContent }; })()`);
prova(`proposta del momento esclusa (${prima}): compare con un'altra voce`, pr && pr.voce && pr.voce !== 'minshawi' && /^con /.test(pr.testo), J(pr));
await ev(`document.querySelector('#q-moment [data-surah="${prima}"] .q-play-item-btn').click()`);
prova('«Ascolta» la avvia con quella voce', await suona(prima, pr && pr.voce), J(await st()));
await ev(`document.getElementById('q-play-toggle').click()`); await sleep(400);
await ev(`document.querySelector('[data-reciter=minshawi]').click()`); await sleep(400);

// 5. «Tutte le voci»
await ev(`document.getElementById('btn-info').click()`); await sleep(300);
await voce('tutte'); await spunta(2);
await voce('basit');
const t2 = await ev(`(() => { const c = document.querySelector('#q-escl-list [data-n="2"]'); return { chk: c.checked, dis: c.disabled, txt: c.parentNode.textContent }; })()`);
prova('esclusa per tutte le voci: nella vista di una voce è spuntata e bloccata', t2.chk && t2.dis && /per tutte le voci/.test(t2.txt), J(t2));
prova('il riepilogo conta anche quelle di tutte le voci', /più 1 per tutte le voci/.test(await stato()), await stato());
await ev(`document.getElementById('sheet-close').click()`); await sleep(200);
let assente = true;
for (const r of ['basit', 'hussary', 'salimi', 'afasy', 'minshawi']) {
  await ev(`document.querySelector('[data-reciter=${r}]').click()`); await sleep(300);
  if ((await nums()).includes(2)) assente = false;
}
prova('Al-Baqarah sparisce con tutte le voci', assente);

// 6. una voce non resta mai senza Sure
await ev(`document.getElementById('btn-info').click()`); await sleep(300);
await voce('afasy');
await ev(`(() => { for (let i = 0; i < 130; i++) { const c = document.querySelector('#q-escl-list input:not(:checked):not(:disabled)'); if (!c) break; const k = c.dataset.n; c.click(); if (!document.querySelector('#q-escl-list [data-n="' + k + '"]').checked) break; } })()`); await sleep(300);
const vuota = await ev(`({ libere: document.querySelectorAll('#q-escl-list input:not(:checked)').length, stato: document.getElementById('q-escl-stato').textContent })`);
prova('escluse tutte meno una: l\'ultima non si può togliere', vuota.libere === 1 && /resterebbe senza Sure/.test(vuota.stato), J(vuota));
await ev(`document.getElementById('sheet-close').click()`); await sleep(200);
await ev(`document.querySelector('[data-reciter=afasy]').click()`); await sleep(400);
const na = await nums();
prova('Afasy con una sola Sura: la pagina funziona', na.length === 1 && (await st()).surah === na[0], J({ na, s: await st() }));
await ev(`document.getElementById('btn-info').click()`); await sleep(300);
await voce('afasy');
await ev(`document.getElementById('q-escl-reset').click()`); await sleep(300);
prova('«Rimetti tutte» (Afasy): di nuovo 113 (manca solo Al-Baqarah, esclusa per tutte)', /Rimesse tutte le Sure di/.test(await stato()) && (await nums()).length === 113, await stato());

// 7. coda: una Sura esclusa con la sua voce si salta
await ev(`document.getElementById('sheet-close').click()`); await sleep(200);
await ev(`document.querySelector('[data-reciter=hussary]').click()`); await sleep(400);
for (const x of [112, 113]) {
  await ev(`document.querySelector('#q-all-surahs-list [data-menu-surah="${x}"]').click()`); await sleep(200);
  await ev(`document.querySelector('#q-menu-card [data-mact="fondo"]').click()`); await sleep(200);
}
await ev(`document.getElementById('btn-info').click()`); await sleep(300);
await voce('hussary'); await spunta(112);
await ev(`document.getElementById('sheet-close').click()`); await sleep(200);
const dopo = await ev(`(document.getElementById('q-queue-next') || {}).textContent`);
prova('«Dopo:» salta la Sura esclusa', /Al-Falaq/.test(dopo || ''), dopo);
await ev(`document.getElementById('q-queue-btn').click()`); await sleep(300);
const ce = await ev(`({ escl: document.querySelectorAll('#q-coda-list .q-ci.esclusa').length, dis: document.querySelector('#q-coda-list .q-ci.esclusa .q-ci-main').disabled, txt: document.querySelector('#q-coda-list .q-ci.esclusa').textContent })`);
prova('nella coda resta, segnata «esclusa» e non si avvia', ce.escl === 1 && ce.dis && /esclusa/.test(ce.txt), J(ce));
await shot('escluse_coda.png');
await ev(`document.querySelector('#q-coda-card [data-act="chiudi"]').click()`); await sleep(200);
await ev(`Sakina.QuranPlayer.playSurah(108)`);
await suona(108, 'hussary');
await ev(`Sakina.QuranPlayer._debugSeekEnd(1.2)`);
prova('a fine Sura la coda salta la 112 e passa alla 113', await suona(113, 'hussary'), J(await st()));

// 8. escludere la Sura che sta suonando la ferma
await ev(`document.getElementById('btn-info').click()`); await sleep(300);
await voce('hussary'); await spunta(113);
s = await st();
prova('esclusa mentre suona: si ferma e passa alla Sura dopo', !s.playing && !s.loading && s.surah === 114, J(s));
await shot('escluse.png');
await ev(`document.getElementById('sheet-close').click()`); await sleep(200);

// 9. memoria e dati rovinati
await ricarica('');
const mem = await ev(`Sakina.QuranPlayer._escluse()`);
prova('dopo il ricaricamento le esclusioni restano', J(mem) === J({ tutte: [2], minshawi: [55, prima].sort((x, y) => x - y).filter((v, i, a) => a.indexOf(v) === i), hussary: [112, 113] }), J(mem));
await ev(`localStorage.setItem('sakina.escluse', '{"tutte":"x","minshawi":[1,"2",999,-1,2.5,2],"constructor":[3],"__proto__":[4],"afasy":[${Array.from({ length: 114 }, (_, i) => i + 1)}]}')`);
T.errs.length = 0;
await ricarica('');
const rov = await ev(`Sakina.QuranPlayer._escluse()`);
prova('dati rovinati: tenuti solo i numeri validi delle voci vere', J(rov.minshawi) === J([1, 2]) && Object.keys(rov).sort().join() === 'afasy,minshawi', J(rov));
await ev(`document.querySelector('[data-reciter=afasy]').click()`); await sleep(400);
prova('Afasy con tutte le 114 escluse (dato rovinato): le esclusioni si ignorano, non resta vuota', (await nums()).length === 114);
await ev(`localStorage.removeItem('sakina.escluse')`);
await ricarica('');
prova('tolte le esclusioni: tutte le 114 Sure', (await nums()).length === 114);
prova('nessun errore JS', T.errs.length === 0, J(T.errs));
b.chiudi(); process.exit(0);
