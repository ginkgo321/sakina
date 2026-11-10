/* Sakina – avviso «nuovo indirizzo» (solo sito vecchio, ginkgo321.github.io/sakina).
   Una riga discreta in cima alla pagina, chiudibile: dopo «Non adesso» torna solo dopo 14 giorni.
   Non tocca i dati dell'app: scrive una sola chiave, `sakinaAvviso` (la data in cui l'utente l'ha chiuso), che
   NON è tra quelle che js/trasferimento.js esporta, quindi non viene mai portata al sito nuovo. */
(function () {
  'use strict';

  var CHIAVE = 'sakinaAvviso', GIORNI = 14;
  var main = document.getElementById('main'), saluto = document.querySelector('.greet-wrap');
  if (!main || !saluto) return;

  function chiuso() {
    try {
      var t = parseInt(localStorage.getItem(CHIAVE), 10), ora = Date.now();
      return t > 0 && t <= ora && ora - t < GIORNI * 86400000;      // data nel futuro (orologio spostato): si mostra
    } catch (e) { return false; }
  }
  if (chiuso()) return;

  function el(tag, classe, testo) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (testo != null) e.textContent = testo;
    return e;
  }

  var box = el('section', 'avviso-nuovo');
  box.setAttribute('aria-label', 'Nuovo indirizzo di Sakina');
  box.appendChild(el('p', 'avviso-titolo', 'Sakina ha un nuovo indirizzo'));
  box.appendChild(el('p', 'avviso-testo', 'Puoi portare con te nome, liste e impostazioni quando vuoi. Qui i tuoi dati restano al sicuro.'));
  var az = el('div', 'avviso-azioni');
  var vai = el('button', 'btn piccolo', 'Trasferisci i miei dati'); vai.type = 'button';
  var dopo = el('button', 'btn secondary piccolo', 'Non adesso'); dopo.type = 'button';
  az.appendChild(vai); az.appendChild(dopo); box.appendChild(az);
  main.insertBefore(box, saluto);

  vai.addEventListener('click', function () {
    var info = document.getElementById('btn-info');
    if (info) info.click();                                          // apre «Su Sakina»…
    setTimeout(function () {                                         // …e porta alla sezione «Trasferisci i tuoi dati»
      var sez = document.getElementById('trasferimento');
      if (sez && sez.scrollIntoView) sez.scrollIntoView({ block: 'start' });
    }, 60);
  });
  dopo.addEventListener('click', function () {
    try { localStorage.setItem(CHIAVE, String(Date.now())); } catch (e) {}
    box.remove();
    main.focus();
  });
})();
