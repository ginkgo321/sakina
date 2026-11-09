// Coda e liste di riproduzione: menu ⋯, «Riproduci dopo» e «in fondo», voce di ogni elemento, precedenza sulla fine Sura,
// «Ripeti la coda», tasto successiva, timer che ferma tutto, liste salvate (crea, rinomina, ascolta, elimina), memoria e dati rovinati.
import { avvia, sleep, J } from './harness.mjs';
const b = await avvia(9411, { w: 390, h: 844 });
const { ev, vai, ricarica, prova, T, shot } = b;
const st = () => ev(`Sakina.QuranPlayer._debugState()`);
const coda = () => ev(`Sakina.QuranPlayer._coda()`);
const attendi = async (cond, ms = 15000) => { for (let t = 0; t < ms; t += 250) { if (await ev(cond) === true) return true; await sleep(250); } return false; };
const suona = (n, r) => attendi(`(() => { const s = Sakina.QuranPlayer._debugState(); return s.playing && !s.loading && s.surah === ${n} && s.reciter === '${r}' && s.time > 0.3; })()`, 20000);
const finisci = async () => { await ev(`Sakina.QuranPlayer._debugSeekEnd(1.2)`); };

await vai('');
await ev(`localStorage.clear(); localStorage.setItem('sakina.nome_chiesto','1')`);
await ricarica('');

// 1. tasto ⋯ su ogni riga
const nMenu = await ev(`document.querySelectorAll('#q-all-surahs-list [data-menu-surah]').length`);
prova('tasto ⋯ su tutte le 114 righe dell\'elenco', nMenu === 114, String(nMenu));
prova('tasto ⋯ anche nelle consigliate e nelle proposte', await ev(`document.querySelectorAll('#q-recommended-list [data-menu-surah]').length > 0 && document.querySelectorAll('#q-moment [data-menu-surah]').length > 0`));

// 2. «Aggiungi in fondo alla coda» (Al-Minshawi, Al-Ikhlāṣ)
await ev(`document.querySelector('#q-all-surahs-list [data-menu-surah="112"]').click()`); await sleep(300);
const m1 = await ev(`({ aperto: !document.getElementById('q-menu').hidden, titolo: document.getElementById('q-menu-title').textContent, voce: document.querySelector('#q-menu-card .sub').textContent, focus: document.activeElement && document.activeElement.getAttribute('data-mact') })`);
prova('il menu ⋯ si apre con nome e voce della Sura, focus sulla prima azione', m1.aperto && /Ikh/.test(m1.titolo) && /Minshawi/.test(m1.voce) && m1.focus === 'dopo', J(m1));
await ev(`document.querySelector('#q-menu-card [data-mact="fondo"]').click()`); await sleep(300);
let c = await coda();
prova('«in fondo alla coda»: 112 con Al-Minshawi', J(c.items) === J([{ n: 112, voice: 'minshawi' }]) && c.pos === -1, J(c));
const r1 = await ev(`({ menu: document.getElementById('q-menu').hidden, toast: document.getElementById('q-toast').textContent, conta: (document.querySelector('#q-queue-btn .q-count') || {}).textContent, dopo: (document.getElementById('q-queue-next') || {}).textContent })`);
prova('menu chiuso, avviso, contatore 1 e «Dopo: …» nel lettore', r1.menu && /coda/.test(r1.toast) && /^1/.test(r1.conta || '') && /Dopo: Al-Ikh/.test(r1.dopo || ''), J(r1));

// 3. altra voce, «Riproduci dopo» (va in testa)
await ev(`document.querySelector('[data-reciter=hussary]').click()`); await sleep(400);
await ev(`document.querySelector('#q-all-surahs-list [data-menu-surah="113"]').click()`); await sleep(300);
await ev(`document.querySelector('#q-menu-card [data-mact="dopo"]').click()`); await sleep(300);
c = await coda();
prova('«Riproduci dopo»: 113 con Al-Hussary in testa, ogni Sura con la sua voce', J(c.items) === J([{ n: 113, voice: 'hussary' }, { n: 112, voice: 'minshawi' }]), J(c.items));

// 4. la coda ha la precedenza sulla fine Sura
await ev(`(() => { const e = document.getElementById('q-end-select'); e.value = 'stop'; e.dispatchEvent(new Event('change', { bubbles: true })); })()`);
await ev(`Sakina.QuranPlayer.playSurah(108)`);
prova('parte Al-Kawthar con Al-Hussary', await suona(108, 'hussary'));
await finisci();
prova('a fine Sura parte la prima della coda (113, Al-Hussary), anche con «Fermati»', await suona(113, 'hussary'), J(await st()));
c = await coda(); prova('posizione nella coda: 0', c.pos === 0, J(c));
await finisci();
prova('poi la seconda, con la sua voce (112, Al-Minshawi)', await suona(112, 'minshawi'), J(await st()));
const chip = await ev(`document.querySelector('[data-reciter].on').dataset.reciter`);
prova('la voce scelta in alto segue la coda', chip === 'minshawi', chip);
await finisci();
await sleep(2500);
let s = await st();
prova('coda finita: vale «Alla fine» (Fermati)', !s.playing && s.surah === 112, J(s));

// 5. finestra Coda e liste, «Ripeti la coda»
await ev(`document.getElementById('q-queue-btn').click()`); await sleep(300);
const w = await ev(`({ aperta: !document.getElementById('q-coda').hidden, righe: document.querySelectorAll('#q-coda-list .q-ci').length, fatte: document.querySelectorAll('#q-coda-list .q-ci.fatta').length, titolo: document.getElementById('q-coda-title').textContent })`);
prova('finestra «Coda»: 2 righe, già ascoltate', w.aperta && w.righe === 2 && w.fatte === 2, J(w));
await ev(`document.getElementById('q-coda-ripeti').click()`); await sleep(200);
prova('«Ripeti la coda» salvato', (await coda()).ripeti === true);
await ev(`document.querySelector('#q-coda-list [data-act="suona"][data-i="0"]').click()`);
prova('toccando una riga della coda parte quella Sura', await suona(113, 'hussary'));
const ora = await ev(`!!document.querySelector('#q-coda-list .q-ci.ora') && /in ascolto/.test(document.querySelector('#q-coda-list .q-ci.ora').textContent)`);
prova('la riga in ascolto è evidenziata', ora);
await finisci();
prova('ripeti: 112 dopo 113', await suona(112, 'minshawi'));
await finisci();
prova('ripeti: finita l\'ultima ricomincia dalla prima (113)', await suona(113, 'hussary'), J(await st()));

// 6. tasto «successiva» e riordino
await ev(`document.querySelector('#q-coda-card [data-act="chiudi"]').click()`); await sleep(200);
await ev(`document.getElementById('q-next').click()`);
prova('«Sura successiva» segue la coda (112, Al-Minshawi)', await suona(112, 'minshawi'));
await ev(`Sakina.QuranPlayer._debugState()`);
for (const n of [1, 93, 94]) {
  await ev(`document.querySelector('#q-all-surahs-list [data-menu-surah="${n}"]').click()`); await sleep(200);
  await ev(`document.querySelector('#q-menu-card [data-mact="fondo"]').click()`); await sleep(200);
}
await ev(`document.getElementById('q-queue-btn').click()`); await sleep(300);
c = await coda();
prova('aggiunte tre Sure in fondo', J(c.items.map(x => x.n)) === J([113, 112, 1, 93, 94]) && c.pos === 1, J(c));
const suDis = await ev(`document.querySelector('#q-coda-list [data-act="su"][data-i="2"]').disabled`);
prova('la prima in arrivo non sale sopra quella in ascolto', suDis === true);
await ev(`document.querySelector('#q-coda-list [data-act="giu"][data-i="2"]').click()`); await sleep(200);
c = await coda();
const fz = await ev(`document.activeElement && document.activeElement.getAttribute('data-act') + document.activeElement.getAttribute('data-i')`);
prova('sposta giù: 1 dopo 93, il focus segue la Sura', J(c.items.map(x => x.n)) === J([113, 112, 93, 1, 94]) && fz === 'giu3', J({ c: c.items.map(x => x.n), fz }));
await ev(`document.querySelector('#q-coda-list [data-act="togli"][data-i="4"]').click()`); await sleep(200);
c = await coda();
prova('togli dalla coda', J(c.items.map(x => x.n)) === J([113, 112, 93, 1]), J(c.items));
await ev(`document.querySelector('#q-coda-card [data-act="togli-fatte"]').click()`); await sleep(200);
c = await coda();
prova('«Togli le già ascoltate» lascia quella in ascolto', J(c.items.map(x => x.n)) === J([112, 93, 1]) && c.pos === 0, J(c));

// 7. salva come lista, nome con HTML (mai interpretato), rinomina
await ev(`(() => { const i = document.getElementById('q-coda-nome'); i.value = '<img src=x onerror=alert(1)>Sera'; i.form.requestSubmit(); })()`); await sleep(300);
let L = await ev(`Sakina.QuranPlayer._liste()`);
prova('coda salvata come lista', L.length === 1 && L[0].items.length === 3, J(L));
const sum = await ev(`document.querySelector('.q-lista summary span').textContent`);
prova('il nome della lista è solo testo (niente HTML eseguito)', sum === '<img src=x onerror=alert(1)>Sera', sum);
prova('nessun dialogo aperto da un nome con HTML', T.dialoghi.length === 0, J(T.dialoghi));
await ev(`(() => { const f = document.querySelector('[data-form="rinomina"]'); f.querySelector('input').value = '  Sera   tranquilla '; f.requestSubmit(); })()`); await sleep(300);
L = await ev(`Sakina.QuranPlayer._liste()`);
prova('rinomina (spazi ripuliti)', L[0].nome === 'Sera tranquilla', L[0].nome);

// 8. svuota, poi ascolta la lista
await ev(`document.querySelector('#q-coda-card [data-act="svuota"]').click()`); await sleep(300);
prova('coda svuotata', (await coda()).items.length === 0);
await ev(`document.querySelector('#q-coda-card [data-act="l-ascolta"]').click()`);
prova('«Ascolta» una lista: la coda diventa la lista e parte la prima (112, Al-Minshawi), dall’inizio', await suona(112, 'minshawi') && (await st()).time < 8, J(await st()));
c = await coda();
prova('coda = lista', J(c.items.map(x => x.n)) === J([112, 93, 1]) && c.pos === 0, J(c));
await ev(`document.querySelector('#q-coda-card [data-act="chiudi"]').click()`); await sleep(200);

// 9. menu ⋯ → nuova lista
await ev(`document.querySelector('#q-all-surahs-list [data-menu-surah="67"]').click()`); await sleep(200);
await ev(`document.querySelector('#q-menu-card [data-mact="liste"]').click()`); await sleep(200);
const ml = await ev(`({ liste: document.querySelectorAll('#q-menu-card [data-mact="in-lista"]').length, focus: document.activeElement && document.activeElement.getAttribute('data-mact') })`);
prova('«Aggiungi a una lista…»: si vedono le liste, focus sulla prima', ml.liste === 1 && ml.focus === 'in-lista', J(ml));
await ev(`(() => { const i = document.getElementById('q-menu-nuova'); i.value = 'Notte'; i.form.requestSubmit(); })()`); await sleep(300);
L = await ev(`Sakina.QuranPlayer._liste()`);
prova('nuova lista «Notte» con Al-Mulk', L.length === 2 && L[1].nome === 'Notte' && J(L[1].items) === J([{ n: 67, voice: 'minshawi' }]), J(L));
await ev(`document.querySelector('#q-all-surahs-list [data-menu-surah="36"]').click()`); await sleep(200);
await ev(`document.querySelector('#q-menu-card [data-mact="liste"]').click()`); await sleep(200);
await ev(`document.querySelectorAll('#q-menu-card [data-mact="in-lista"]')[1].click()`); await sleep(200);
L = await ev(`Sakina.QuranPlayer._liste()`);
prova('aggiunta a una lista esistente', J(L[1].items.map(x => x.n)) === J([67, 36]), J(L[1]));

// 10. il timer ferma tutto, anche la coda
await ev(`Sakina.QuranPlayer._debugSleep(3)`);
await sleep(5000);
s = await st();
await sleep(2500);
const s2 = await st();
prova('il timer ferma l\'ascolto e la coda non riparte', !s.playing && !s2.playing && s2.surah === s.surah, J({ s, s2 }));

// 11. memoria
await ricarica('');
c = await coda(); L = await ev(`Sakina.QuranPlayer._liste()`);
prova('dopo il ricaricamento: coda, «Ripeti» e liste restano', c.items.length === 3 && c.ripeti === true && L.length === 2, J({ c, n: L.length }));

// 12. elimina lista (con conferma)
await ev(`(() => { const q = document.getElementById('q-queue-btn'); q.focus(); q.click(); })()`); await sleep(300);
await ev(`document.querySelectorAll('#q-coda-card [data-act="l-elimina"]')[1].click()`); await sleep(400);
L = await ev(`Sakina.QuranPlayer._liste()`);
prova('elimina lista dopo la conferma', L.length === 1 && T.dialoghi.some(d => /Eliminare la lista/.test(d)), J(T.dialoghi));
await shot('coda.png');
await ev(`document.querySelector('#q-coda-card [data-act="chiudi"]').click()`); await sleep(200);
prova('Esc / Chiudi: finestra chiusa, focus torna al tasto Coda', await ev(`document.getElementById('q-coda').hidden && document.activeElement && document.activeElement.id === 'q-queue-btn'`));

// 13. dati rovinati
await ev(`localStorage.setItem('sakina.coda', '{"items":[{"n":999,"voice":"minshawi"},{"n":2,"voice":"constructor"},{"n":"36","voice":"salimi"},null,{"n":55,"voice":"basit"}],"pos":7,"ripeti":"si"}'); localStorage.setItem('sakina.liste', '[{"id":"<b>","nome":"<i>x</i>","items":"no"},5,{"nome":"","items":[{"n":1,"voice":"afasy"}]}]')`);
T.errs.length = 0;
await ricarica('');
c = await coda(); L = await ev(`Sakina.QuranPlayer._liste()`);
prova('coda rovinata: restano solo gli elementi validi', J(c.items) === J([{ n: 36, voice: 'salimi' }, { n: 55, voice: 'basit' }]) && c.pos === -1 && c.ripeti === false, J(c));
prova('liste rovinate: ripulite', L.length === 2 && L[0].items.length === 0 && /^[a-z0-9]+$/.test(L[0].id) && L[1].nome === 'Lista 3', J(L));
await ev(`localStorage.setItem('sakina.coda', '{{{'); localStorage.setItem('sakina.liste', 'null')`);
await ricarica('');
prova('JSON rotto: coda vuota, nessun errore', (await coda()).items.length === 0 && T.errs.length === 0, J(T.errs));
prova('nessun errore JS', T.errs.length === 0, J(T.errs));
b.chiudi(); process.exit(0);
