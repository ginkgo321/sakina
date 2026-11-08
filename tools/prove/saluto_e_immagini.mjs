import { avvia, sleep, J } from './harness.mjs';
const b = await avvia(9395);
const { ev, vai, ricarica, prova, T } = b;
const vis = id => ev(`!document.getElementById('${id}').hidden`);
await vai('');
await ev(`localStorage.clear()`);
await ricarica('');

// 1. prima apertura: finestra «Come ti chiami?»
prova('prima apertura: compare la finestra del nome', (await vis('hello')) === true);
prova('il saluto senza nome è solo una parola', /^(Buongiorno|Buon pomeriggio|Buonasera|Buonanotte)$/.test(await ev(`document.getElementById('greet').textContent`)));
// un nome con codice dentro non viene interpretato
const brutto = '<img src=x onerror=alert(1)>Mario';
await ev(`document.getElementById('hello-name').value = ${J(brutto)}; document.getElementById('hello-form').requestSubmit()`);
await sleep(300);
const g = await ev(`({ txt: document.getElementById('greet').textContent, img: document.querySelectorAll('#greet img').length, aperta: !document.getElementById('hello').hidden })`);
prova('nome salvato e mostrato come testo (nessun HTML)', g.txt.endsWith(', ' + brutto.slice(0, 30)) && g.img === 0 && !g.aperta, J(g));
prova('nessun avviso (alert) per il nome con codice', T.dialoghi.length === 0, J(T.dialoghi));
// 2. riapertura: il nome resta, la finestra non ricompare
await ricarica('');
const r = await ev(`({ txt: document.getElementById('greet').textContent, aperta: !document.getElementById('hello').hidden })`);
prova('dopo il ricaricamento il nome resta e la finestra non ricompare', r.txt.includes('<img') && !r.aperta, J(r));
// 3. cambio del nome da «Su Sakina»
await ev(`document.getElementById('btn-info').click()`); await sleep(200);
prova('«Su Sakina» mostra il nome attuale nel campo', (await ev(`document.getElementById('name-input').value`)) === brutto.slice(0, 30));
await ev(`document.getElementById('name-input').value = '  Anna   Maria  '; document.getElementById('name-form').requestSubmit()`); await sleep(200);
prova('nome cambiato, spazi sistemati', (await ev(`document.getElementById('greet').textContent`)).endsWith(', Anna Maria'));
await ev(`document.getElementById('name-input').value = ''; document.getElementById('name-form').requestSubmit()`); await sleep(200);
prova('nome tolto: resta il saluto senza nome', /^(Buongiorno|Buon pomeriggio|Buonasera|Buonanotte)$/.test(await ev(`document.getElementById('greet').textContent`)));
prova('Esc chiude la finestra «Su Sakina»', (await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); document.getElementById('sheet').hidden`)) === true);
// 4. «Non adesso»: non si chiede più
await ev(`localStorage.clear()`); await ricarica('');
prova('senza dati la finestra ricompare', (await vis('hello')) === true);
await ev(`document.getElementById('hello-skip').click()`); await sleep(200);
await ricarica('');
prova('dopo «Non adesso» non viene richiesto di nuovo', (await vis('hello')) === false);
prova('nella schermata principale non ci sono tasti per cambiare il nome', (await ev(`document.getElementById('greet-edit')`)) === null);
prova('la frase «Tradizione Hafs…» è sparita', !(await ev(`document.body.innerText`)).includes('adatta al riposo'));
// 5. saluto secondo l'ora
const ore = await ev(`[3, 4, 5, 8, 11, 12, 15, 17, 18, 21, 22, 23].map(h => Sakina.greetingWord(new Date(2026, 10, 8, h, 30)))`);
prova('le fasce orarie del saluto (5, 12, 18 e 22)', J(ore) === J(['Buonanotte', 'Buonanotte', 'Buongiorno', 'Buongiorno', 'Buongiorno', 'Buon pomeriggio', 'Buon pomeriggio', 'Buon pomeriggio', 'Buonasera', 'Buonasera', 'Buonanotte', 'Buonanotte']), J(ore));
// 6. immagini: se manca il file la scheda non resta con un buco
await b.send('Network.setBlockedURLs', { urls: ['*img/sure/004.webp'] });   // come se il file non esistesse
await ev(`localStorage.setItem('sakina.settings', JSON.stringify({ reciter: 'minshawi', surah: 4 }))`); await ricarica('');
await sleep(800);
const im = await ev(`({ cover: document.querySelector('.q-cover') && document.querySelector('.q-cover').hidden, desc: (document.querySelector('.q-desc') || {}).textContent || '' })`);
prova('Sura con immagine non raggiungibile: la copertina sparisce, la descrizione resta', im.cover === true && im.desc.length > 40, J(im));
await b.send('Network.setBlockedURLs', { urls: [] });
await ev(`localStorage.setItem('sakina.settings', JSON.stringify({ reciter: 'minshawi', surah: 2 }))`); await ricarica('');
await sleep(800);
const im2 = await ev(`(() => { const i = document.querySelector('.q-cover-img'); return { vis: !document.querySelector('.q-cover').hidden, ok: i.complete && i.naturalWidth === 480 }; })()`);
prova('Sura con immagine: copertina 480 px visibile', im2.vis && im2.ok, J(im2));
prova('nessun errore JS', T.errs.length === 0, J(T.errs));
b.chiudi(); process.exit(0);
