import { avvia, sleep, J } from './harness.mjs';
const b = await avvia(9399, { w: 390, h: 844 });
const { ev, vai, ricarica, prova, T } = b;
await vai('');
await ev(`localStorage.clear(); localStorage.setItem('sakina.nome_chiesto','1')`);   // Sura di partenza: 55
await ricarica('');
await ev(`window.scrollTo(0, 2500)`); await sleep(700);
const giu = await ev(`({ y: Math.round(scrollY), dock: document.getElementById('q-dock').classList.contains('show'), tipo: document.getElementById('q-dock-top').tagName, nome: document.getElementById('q-dock-top').getAttribute('aria-label') })`);
prova('in basso: compare la barra fissa e il nome è un pulsante', giu.y > 1000 && giu.dock && giu.tipo === 'BUTTON' && /Torna su/.test(giu.nome), J(giu));
const th = await ev(`(() => { const i = document.getElementById('q-dock-img'); const r = i.getBoundingClientRect(); return { src: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0, w: Math.round(r.width), h: Math.round(r.height), dentro: !!i.closest('#q-dock-top'), alt: i.getAttribute('alt') }; })()`);
prova('nella barra fissa c\'è la miniatura della Sura (44 px, dentro il pulsante, decorativa)', /t\/055\.webp$/.test(th.src) && th.ok && th.w === 44 && th.h === 44 && th.dentro && th.alt === '', J(th));
const tit = await ev(`Math.round(document.getElementById('q-dock-title').getBoundingClientRect().width)`);
prova('il nome resta leggibile accanto alla miniatura (almeno 60 px)', tit >= 60, String(tit));

// la miniatura fa parte del pulsante: toccandola si torna in cima
await ev(`document.getElementById('q-dock-img').click()`);
let y = 9999;
for (let i = 0; i < 30 && y > 0; i++) { await sleep(100); y = await ev(`Math.round(scrollY)`); }
await sleep(500);
const su = await ev(`({ y: Math.round(scrollY), dock: document.getElementById('q-dock').classList.contains('show'), focus: document.activeElement && document.activeElement.id })`);
prova('toccando la miniatura si torna in cima', su.y === 0, J(su));
prova('in cima la barra fissa sparisce (si vede il lettore grande)', su.dock === false, J(su));
prova('il focus va sul tasto play del lettore grande', su.focus === 'q-play-toggle', J(su));

// toccando il nome, mentre suona: l'ascolto continua
await ev(`Sakina.QuranPlayer.playSurah(55)`); await sleep(3000);
await ev(`window.scrollTo(0, 2500)`); await sleep(600);
await ev(`document.getElementById('q-dock-title').click()`); await sleep(1500);
const st = await ev(`Sakina.QuranPlayer._debugState()`);
prova('toccando il nome si torna in cima e l\'ascolto continua', (await ev(`Math.round(scrollY)`)) === 0 && st.playing && st.surah === 55, J(st));

// con la Sura successiva cambia la miniatura; se un file manca, sparisce senza buco
await ev(`document.getElementById('q-next').click()`); await sleep(800);
prova('con la Sura successiva cambia anche la miniatura (056)', /t\/056\.webp$/.test(await ev(`document.getElementById('q-dock-img').getAttribute('src')`)));
await b.send('Network.setBlockedURLs', { urls: ['*img/sure/t/057.webp'] });
await ev(`document.getElementById('q-next').click()`); await sleep(1200);
prova('miniatura non raggiungibile: si nasconde', (await ev(`getComputedStyle(document.getElementById('q-dock-img')).display`)) === 'none');
await b.send('Network.setBlockedURLs', { urls: [] });
await ev(`document.getElementById('q-next').click()`); await sleep(1200);
prova('alla Sura dopo la miniatura ricompare (058)', (await ev(`(() => { const i = document.getElementById('q-dock-img'); return getComputedStyle(i).display !== 'none' && /058/.test(i.src); })()`)) === true);
prova('nessun errore JS', T.errs.length === 0, J(T.errs));
b.chiudi(); process.exit(0);
