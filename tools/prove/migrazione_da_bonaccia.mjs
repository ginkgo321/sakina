import { avvia, sleep, J } from './harness.mjs';
const b = await avvia(9396);
const { ev, vai, ricarica, prova, T } = b;
await vai('');
// come se un utente avesse salvato una Sura quando le recitazioni stavano in Bonaccia (stesso indirizzo, stessa memoria)
const url = 'https://cdn.mp3quran.net/audio/mishary-alafasy/r1/108.mp3';
await ev(`(async () => { await caches.delete('sakina-recitazioni-v1'); const c = await caches.open('bonaccia-recitazioni-v1'); await c.put(${J(url)}, new Response(new Uint8Array(2000), { headers: { 'content-type': 'audio/mpeg' } })); })()`);
await ricarica('');
let nuovo = [], vecchia = true;
for (let i = 0; i < 20; i++) {
  nuovo = await ev(`caches.open('sakina-recitazioni-v1').then(c => c.keys()).then(k => k.map(r => r.url))`);
  vecchia = await ev(`caches.has('bonaccia-recitazioni-v1')`);
  if (nuovo.length && !vecchia) break; await sleep(300);
}
prova('la Sura salvata in Bonaccia passa nella memoria di Sakina', nuovo.length === 1 && nuovo[0] === url, J(nuovo));
prova('la vecchia memoria si svuota dopo lo spostamento', vecchia === false);
prova('nessun errore JS', T.errs.length === 0, J(T.errs));
b.chiudi(); process.exit(0);
