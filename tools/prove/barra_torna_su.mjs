import { avvia, sleep, J } from './harness.mjs';
const b = await avvia(9399, { w: 390, h: 844 });
const { ev, vai, ricarica, prova, T } = b;
await vai('');
await ev(`localStorage.clear(); localStorage.setItem('sakina.nome_chiesto','1')`);
await ricarica('');
await ev(`window.scrollTo(0, 2500)`); await sleep(700);
const giu = await ev(`({ y: Math.round(scrollY), dock: document.getElementById('q-dock').classList.contains('show'), tipo: document.getElementById('q-dock-top').tagName, nome: document.getElementById('q-dock-top').getAttribute('aria-label') })`);
prova('in basso: compare la barra fissa e il nome è un pulsante', giu.y > 1000 && giu.dock && giu.tipo === 'BUTTON' && /Torna su/.test(giu.nome), J(giu));
await ev(`document.getElementById('q-dock-top').click()`);
let y = 9999;
for (let i = 0; i < 30 && y > 0; i++) { await sleep(100); y = await ev(`Math.round(scrollY)`); }
await sleep(500);
const su = await ev(`({ y: Math.round(scrollY), dock: document.getElementById('q-dock').classList.contains('show'), focus: document.activeElement && document.activeElement.id, card: Math.round(document.getElementById('q-player-box').getBoundingClientRect().top) })`);
prova('toccando il nome si torna in cima', su.y === 0, J(su));
prova('in cima la barra fissa sparisce (si vede il lettore grande)', su.dock === false, J(su));
prova('il focus va sul tasto play del lettore grande', su.focus === 'q-play-toggle', J(su));
// mentre suona non si ferma niente
await ev(`Sakina.QuranPlayer.playSurah(55)`); await sleep(3000);
await ev(`window.scrollTo(0, 2500)`); await sleep(600);
await ev(`document.getElementById('q-dock-top').click()`); await sleep(1500);
const st = await ev(`Sakina.QuranPlayer._debugState()`);
prova('tornare su non interrompe l\'ascolto', st.playing && st.surah === 55, J(st));
prova('nessun errore JS', T.errs.length === 0, J(T.errs));
b.chiudi(); process.exit(0);
