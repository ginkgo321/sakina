import { avvia, sleep, J } from './harness.mjs';
const b = await avvia(9361);
const { ev, vai, ricarica, prova, T } = b;
const casi = {
  'impostazioni: tipi sbagliati': { 'sakina.settings': '{"reciter":"zzz","surah":999,"bgPreset":"x","bgRel":"abc","endMode":"boom","leveling":"yes"}' },
  'Sura come testo e voce con selezione': { 'sakina.settings': '{"reciter":"afasy","surah":"36","bgRel":-500}' },
  'voce con nome di proprietà JS': { 'sakina.settings': '{"reciter":"constructor","surah":55}' },
  'JSON rotto': { 'sakina.settings': '{{{non json' },
  'Sura negativa': { 'sakina.settings': '{"reciter":"salimi","surah":-3,"bgRel":99}' },
  'impostazioni di Bonaccia (vecchia chiave): Afasy con Sura protetta': { 'bonaccia.quran_settings': '{"reciter":"afasy","surah":56,"bgPreset":"onde"}' },
  'impostazioni di Bonaccia (vecchia chiave): valori buoni': { 'bonaccia.quran_settings': '{"reciter":"hussary","surah":67,"bgPreset":"pioggia","bgRel":-10,"endMode":"next"}' },
  'tema salvato assurdo': { 'sakina.theme': 'viola', 'sakina.settings': '{}' },
};
await vai('');
for (const [nome, chiavi] of Object.entries(casi)) {
  await ev(`localStorage.clear(); const k = ${J(chiavi)}; for (const x in k) localStorage.setItem(x, k[x]);`);
  T.errs.length = 0; T.dialoghi.length = 0;
  await ricarica('');
  const problemi = [];
  const q = await ev(`(() => { const s = Sakina.QuranPlayer._debugState(); const d = Sakina.QuranPlayer._debug(); return { surah: s.surah, endMode: s.endMode, titolo: document.querySelector('.q-now-title') && document.querySelector('.q-now-title').textContent.trim(), voce: document.querySelector('[data-reciter].on') && document.querySelector('[data-reciter].on').dataset.reciter, bg: document.getElementById('q-bg-select') && document.getElementById('q-bg-select').value, master: d.master, gain: d.gain, relMin: document.getElementById('q-bg-rel') && document.getElementById('q-bg-rel').value, tema: document.documentElement.dataset.theme, vuota: document.getElementById('v-recitazioni').innerText.trim().length < 20 }; })()`);
  const ammesse = q.voce === 'afasy' ? [1, 12, 19, 31, 93, 94, 95, 108, 112, 113, 114] : null;
  if (!(q.surah >= 1 && q.surah <= 114 && Number.isInteger(q.surah))) problemi.push('Sura non valida ' + q.surah);
  if (ammesse && !ammesse.includes(q.surah)) problemi.push('Sura protetta selezionata: ' + q.surah);
  if (!q.voce) problemi.push('nessuna voce evidenziata');
  if (q.vuota) problemi.push('pagina vuota');
  if (!['stop', 'next', 'repeat'].includes(q.endMode)) problemi.push('endMode ' + q.endMode);
  if (!(q.master > 0 && q.master <= 1)) problemi.push('master ' + q.master);
  if (!['day', 'night'].includes(q.tema)) problemi.push('tema ' + q.tema);
  if (nome.includes('valori buoni') && !(q.voce === 'hussary' && q.surah === 67 && q.bg === 'pioggia' && q.endMode === 'next')) problemi.push('impostazioni di Bonaccia non riprese');
  if (T.errs.length) problemi.push('errori JS: ' + T.errs.slice(0, 3).join(' | '));
  prova(nome, problemi.length === 0, problemi.join(' ; ') + ' ' + J(q));
}
b.chiudi(); process.exit(0);
