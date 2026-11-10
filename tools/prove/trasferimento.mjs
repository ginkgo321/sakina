// Prova del trasferimento dei dati tra i due indirizzi di Sakina.
// Servono DUE server, uno per cartella (due indirizzi diversi = due memorie diverse, come in rete):
//   cartella del sito vecchio:  python -m http.server 8093 --bind 127.0.0.1
//   cartella del sito nuovo:    python -m http.server 8094 --bind 127.0.0.1
// Altre porte: variabili PORTA_VECCHIO e PORTA_NUOVO. La prova è identica nei due repository.
import { avvia, sleep, J } from './harness.mjs';

const VEC = process.env.PORTA_VECCHIO || '8093', NUO = process.env.PORTA_NUOVO || '8094';
const b = await avvia(9400);
const { ev, send, T } = b;
const prova = (nome, cond, extra) => b.prova(nome, cond === true, extra);   // severa: un'eccezione o un testo non contano come «ok»
const attendi = async (cond, n = 40) => { for (let i = 0; i < n; i++) { if (await ev(cond) === true) return true; await sleep(250); } return false; };
const vai = async (porta, hash = '') => {
  await send('Page.navigate', { url: 'about:blank' }); await sleep(200);
  await send('Page.navigate', { url: `http://127.0.0.1:${porta}/index.html${hash}` });
  await attendi(`document.readyState === 'complete' && !!(window.Sakina && Sakina.Trasferimento && Sakina.QuranPlayer)`);
  await sleep(600);
};
const snapshot = () => ev(`JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)]))`);
const clicca = (sel, testo) => ev(`(() => { const b = [...document.querySelectorAll(${J(sel)})].find(x => x.textContent.trim() === ${J(testo)}); if (!b) return false; b.click(); return true; })()`);
const titolo = () => ev(`(document.querySelector('#trasf-titolo') || {}).textContent || ''`);
const visibile = sel => ev(`(() => { const e = document.querySelector(${J(sel)}); return !!e && !e.hidden; })()`);
const chiaviSakina = () => ev(`Object.keys(localStorage).filter(k => /^(sakina\\.|bonaccia\\.|altro\\.)/.test(k)).sort().join(',')`);
const b64 = obj => Buffer.from(JSON.stringify(obj), 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const PF = '#trasferisci=';

// ---------- dati di prova (come li avrebbe un utente del sito vecchio) ----------
const XSS = 'Sera <img src=x onerror=window.__xss=1>';
const seme = {
  'sakina.nome': 'Amina', 'sakina.nome_chiesto': '1', 'sakina.theme': 'night',
  'sakina.settings': J({ reciter: 'afasy', surah: 36, bgPreset: 'pioggia', bgRel: -12, leveling: true, endMode: 'next' }),
  'sakina.coda': J({ items: [{ n: 1, voice: 'minshawi' }, { n: 36, voice: 'afasy' }], pos: -1, ripeti: false }),
  'sakina.liste': J([{ id: 'l1abc', nome: XSS, items: [{ n: 2, voice: 'basit' }] }]),
  'sakina.escluse': J({ tutte: [5] }),
  'bonaccia.quran_settings': J({ reciter: 'minshawi', surah: 1 }),
};
const estranee = { 'bonaccia.diario': 'segreto di un’altra app', 'altro.x': '1' };

// ================= SITO VECCHIO =================
await vai(VEC);
await ev(`localStorage.clear(); Object.entries(${J({ ...seme, ...estranee })}).forEach(([k, v]) => localStorage.setItem(k, v))`);
await vai(VEC);
const snap0 = await snapshot();
prova('vecchio: ruolo "vecchio"', await ev(`Sakina.Trasferimento.ruolo`) === 'vecchio');
prova('vecchio: la sezione «Trasferisci i tuoi dati» c’è', await ev(`!!document.querySelector('#trasferimento h3') && document.querySelector('#trasferimento h3').textContent === 'Trasferisci i tuoi dati'`));
prova('vecchio: ha i due pulsanti', await ev(`document.querySelectorAll('#trasferimento button').length`) === 2);

const pk = await ev(`Object.keys(Sakina.Trasferimento.pacchetto().dati).sort().join(',')`);
prova('vecchio: esporta solo le chiavi di Sakina (non il diario di Bonaccia né altro)', pk === Object.keys(seme).sort().join(','), pk);

// file: si intercetta il download per leggerne il contenuto
await ev(`window.__dl = null; window.__blob = null; const o = URL.createObjectURL.bind(URL); URL.createObjectURL = b => { window.__blob = b; return o(b); }; HTMLAnchorElement.prototype.click = function () { window.__dl = this.download; };`);
prova('vecchio: «Salva i dati in un file» parte', await clicca('#trasferimento button', 'Salva i dati in un file'));
await sleep(300);
const nomeFile = await ev(`window.__dl`);
const testoFile = await ev(`window.__blob ? window.__blob.text() : ''`);
let file = null; try { file = JSON.parse(testoFile); } catch (e) {}
prova('vecchio: nome del file sakina-dati-AAAA-MM-GG.json', /^sakina-dati-\d{4}-\d{2}-\d{2}\.json$/.test(nomeFile || ''), nomeFile);
prova('vecchio: il file contiene tutti i dati senza modifiche', !!file && file.app === 'sakina' && Object.keys(seme).every(k => file.dati[k] === seme[k]));
prova('vecchio: il file non contiene altro', !!file && Object.keys(file.dati).length === Object.keys(seme).length);

// link
const link = await ev(`Sakina.Trasferimento.creaLink()`);
prova('vecchio: il link punta al nuovo indirizzo con i dati nel frammento', typeof link === 'string' && link.startsWith('https://sakina.150796.xyz/' + PF));
const payload = link.split(PF)[1];
prova('vecchio: il link non contiene il nome in chiaro', !link.includes('Amina'));

// nulla è stato scritto o cancellato dal vecchio sito
const snap1 = await snapshot();
prova('vecchio: la memoria è IDENTICA dopo file e link (sola lettura)', snap0 === snap1);
prova('vecchio: nessun errore JS', T.errs.length === 0, J(T.errs));

// vecchio senza dati: niente file, il link apre solo il nuovo indirizzo
await ev(`localStorage.clear()`);
prova('vecchio vuoto: creaLink dà null (niente da portare)', await ev(`Sakina.Trasferimento.creaLink()`) === null);
await ev(`localStorage.clear(); Object.entries(${J({ ...seme, ...estranee })}).forEach(([k, v]) => localStorage.setItem(k, v))`);

// vecchio con troppi dati: niente link (limite), resta il file
await ev(`localStorage.setItem('sakina.liste', ${J(J([{ id: 'b', nome: 'y'.repeat(150000), items: [] }]))})`);
prova('vecchio: dati troppo grandi per un link → niente link', await ev(`Sakina.Trasferimento.creaLink()`) === null);
await ev(`localStorage.setItem('sakina.liste', ${J(seme['sakina.liste'])})`);

// ================= SITO NUOVO =================
await vai(NUO);
prova('nuovo: ruolo "nuovo"', await ev(`Sakina.Trasferimento.ruolo`) === 'nuovo');
prova('nuovo: primo avvio senza dati → compare il «Benvenuto»', await visibile('#hello'));
prova('nuovo: il Benvenuto ha «Ho già dei dati: importa da un file»', await ev(`[...document.querySelectorAll('#hello-card button')].some(x => x.textContent.includes('Ho già dei dati'))`));
prova('nuovo: la sezione «Importa i tuoi dati» c’è', await ev(`document.querySelector('#trasferimento h3').textContent`) === 'Importa i tuoi dati');
prova('nuovo: memoria vuota', await chiaviSakina() === '');

// --- link: arriva, mostra, NON scrive finché non si conferma ---
await vai(NUO, PF + payload);
prova('nuovo+link: compare la finestra dei dati trovati', await visibile('#trasf'), await titolo());
prova('nuovo+link: il Benvenuto si è chiuso', !(await visibile('#hello')));
prova('nuovo+link: il frammento è stato tolto dall’indirizzo', await ev(`location.hash`) === '');
const dlg = await ev(`document.querySelector('#trasf-card').innerText`);
prova('nuovo+link: mostra il nome, le liste, la coda', dlg.includes('Amina') && dlg.includes('lista') && dlg.includes('in coda'), dlg.replace(/\n/g, ' | '));
prova('nuovo+link: il nome della lista con HTML non diventa un elemento', await ev(`!document.querySelector('#trasf-card img') && window.__xss === undefined`));
prova('nuovo+link: prima del «sì» non è stato scritto niente', await chiaviSakina() === '');

prova('nuovo+link: «Importa»', await clicca('#trasf-card button', 'Importa'));
await sleep(300);
prova('nuovo+link: compare «Fatto»', await titolo() === 'Fatto');
const dopo = JSON.parse(await snapshot());
const mappa = Object.fromEntries(dopo);
prova('nuovo+link: tutti i dati del vecchio sito sono passati identici', Object.keys(seme).every(k => mappa[k] === seme[k]));
prova('nuovo+link: non è passato altro', Object.keys(mappa).filter(k => !(k in seme)).length === 0, Object.keys(mappa).join(','));
prova('nuovo+link: «Continua» ricarica', await clicca('#trasf-card button', 'Continua'));
await attendi(`!document.getElementById('trasf') && document.readyState === 'complete' && !!(window.Sakina && Sakina.QuranPlayer)`);
await sleep(900);
prova('nuovo dopo l’importazione: saluta per nome', (await ev(`document.querySelector('#greet').textContent`)).includes('Amina'));
prova('nuovo dopo l’importazione: tema notte', await ev(`document.documentElement.getAttribute('data-theme')`) === 'night');
prova('nuovo dopo l’importazione: niente Benvenuto', !(await visibile('#hello')));
prova('nuovo dopo l’importazione: la lista c’è e il suo nome è solo testo', await ev(`(() => { const l = Sakina.QuranPlayer._liste(); return l.length === 1 && l[0].nome.includes('<img') && window.__xss === undefined && !document.querySelector('img[src="x"]'); })()`) === true);

// --- «Non adesso»: non scrive niente e riparte il normale primo avvio ---
await ev(`localStorage.clear()`);
await vai(NUO, PF + payload);
prova('rifiuto: finestra aperta', await visibile('#trasf'));
await clicca('#trasf-card button', 'Non adesso');
await attendi(`!document.getElementById('trasf') && document.readyState === 'complete' && !!(window.Sakina && Sakina.QuranPlayer)`);
await sleep(700);
prova('rifiuto: nessun dato scritto', await chiaviSakina() === '');
prova('rifiuto: riparte il Benvenuto', await visibile('#hello'));
prova('rifiuto: nessun frammento nell’indirizzo', await ev(`location.hash`) === '');

// --- Esc fa lo stesso ---
await vai(NUO, PF + payload);
await ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
await attendi(`!document.getElementById('trasf') && document.readyState === 'complete' && !!(window.Sakina && Sakina.QuranPlayer)`);
await sleep(700);
prova('Esc: nessun dato scritto e Benvenuto', await chiaviSakina() === '' && await visibile('#hello'));

// --- link o file rovinati/ostili: rifiutati, memoria intatta ---
const casi = [
  ['link senza senso', PF + '@@@@'],
  ['link vuoto', PF],
  ['altra app', PF + b64({ app: 'altro', formato: 1, dati: { 'sakina.nome': 'x' } })],
  ['formato sconosciuto', PF + b64({ app: 'sakina', formato: 9, dati: { 'sakina.nome': 'x' } })],
  ['chiave estranea', PF + b64({ app: 'sakina', formato: 1, dati: { 'sakina.nome': 'x', 'altro.x': 'y' } })],
  ['chiave che imita il prototipo', PF + b64({ app: 'sakina', formato: 1, dati: { '__proto__': 'x' } })],
  ['valore non testo', PF + b64({ app: 'sakina', formato: 1, dati: { 'sakina.nome': { a: 1 } } })],
  ['valore enorme', PF + b64({ app: 'sakina', formato: 1, dati: { 'sakina.nome': 'z'.repeat(250000) } })],
  ['nessun dato', PF + b64({ app: 'sakina', formato: 1, dati: {} })],
];
for (const [nome, h] of casi) {
  await ev(`localStorage.clear()`);
  await vai(NUO, h);
  const t = await titolo(), chiavi = await chiaviSakina(), conferma = await visibile('#trasf') && t === 'Ho trovato i tuoi dati';
  prova(`ostile (${nome}): rifiutato e memoria intatta`, !conferma && chiavi === '', `${t} / ${chiavi}`);
}
await ev(`localStorage.clear()`);
await vai(NUO, PF + '@@@@');
await clicca('#trasf-card button', 'Chiudi');
await attendi(`!document.getElementById('trasf') && document.readyState === 'complete' && !!(window.Sakina && Sakina.QuranPlayer)`);
await sleep(700);
prova('errore → «Chiudi» riporta al normale primo avvio', await visibile('#hello') && await chiaviSakina() === '');

// --- da file ---
await ev(`localStorage.clear()`);
await vai(NUO);
await ev(`(() => { const i = document.getElementById('trasf-file'); const dt = new DataTransfer(); dt.items.add(new File([${J(testoFile)}], 'sakina-dati.json', { type: 'application/json' })); i.files = dt.files; i.dispatchEvent(new Event('change')); })()`);
await attendi(`!!document.getElementById('trasf') && !document.getElementById('trasf').hidden`);
prova('file: compare la finestra dei dati trovati', await titolo() === 'Ho trovato i tuoi dati');
prova('file: prima del «sì» niente scritto', await chiaviSakina() === '');
await clicca('#trasf-card button', 'Importa'); await sleep(300);
const m2 = Object.fromEntries(JSON.parse(await snapshot()));
prova('file: dopo il «sì» i dati sono identici', Object.keys(seme).every(k => m2[k] === seme[k]));

// --- file rovinato ---
await ev(`localStorage.clear()`);
await vai(NUO);
await ev(`(() => { const i = document.getElementById('trasf-file'); const dt = new DataTransfer(); dt.items.add(new File(['{ non è json'], 'rotto.json')); i.files = dt.files; i.dispatchEvent(new Event('change')); })()`);
await attendi(`!!document.getElementById('trasf') && !document.getElementById('trasf').hidden`);
prova('file rovinato: errore e memoria intatta', await titolo() === 'Non riesco a importare' && await chiaviSakina() === '');

// --- il nuovo sito ha già dati diversi: avviso e poi sostituzione ---
await ev(`localStorage.clear(); localStorage.setItem('sakina.nome', 'Bia'); localStorage.setItem('sakina.nome_chiesto', '1')`);
await vai(NUO, PF + payload);
const dlg2 = await ev(`document.querySelector('#trasf-card').innerText`);
prova('dati già presenti: avvisa che verranno sostituiti', dlg2.includes('Attenzione'), dlg2.replace(/\n/g, ' | '));
await clicca('#trasf-card button', 'Importa'); await sleep(300);
prova('dati già presenti: dopo il «sì» vale il nome importato', await ev(`localStorage.getItem('sakina.nome')`) === 'Amina');

prova('nessun errore JS (tutta la prova)', T.errs.length === 0, J(T.errs));
prova('nessuna risposta di rete con errore', T.rete.length === 0, J(T.rete));
b.chiudi(); process.exit(0);
