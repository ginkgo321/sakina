# CLAUDE.md - Regole per repository PUBBLICO

Questo è un repository **PUBBLICO**. Tutto il codice, i documenti e la cronologia dei commit sono accessibili pubblicamente su GitHub.

## 1. Segreti e dati sensibili (DIVIETO ASSOLUTO)

Sono segreti o dati sensibili: password, token, chiavi API e di cifratura, certificati, stringhe di connessione, file `.env`, credenziali di qualsiasi tipo, e dati personali di persone reali (anagrafiche, contatti, documenti d'identità, dati sanitari, finanziari o riservati).

- **DIVIETO ASSOLUTO DI COMMIT**: Non aggiungere né committare MAI file o stringhe che contengono segreti, credenziali o dati personali.
- **Non leggere** di proposito file locali con dati sensibili (`.env*`, `*.pem`, `*.key`, `credentials.json`, cartelle `secrets/`, `.ssh`, `.aws` e simili).
- Se ne incontri uno, **non riportarne il contenuto** da nessuna parte: né nelle risposte, né nei commit, né nelle PR, né nei log, né nei commenti. Usa segnaposto (es. `<API_KEY>`).
- Non stampare le variabili d'ambiente né eseguire comandi che le mostrano (`env`, `printenv`, `cat .env`).

## 2. Dati e servizi esterni

- Non inviare contenuti del repository a servizi esterni non autorizzati.
- Non aggiungere telemetria, tracker o servizi di terze parti senza richiesta esplicita dell'utente.

## 3. Repository e GitHub

- Il repository è **PUBBLICO**: qualsiasi commit e push è immediatamente visibile al pubblico.
- Hai piena libertà di lavoro: puoi modificare file, creare branch, fare commit e push.
- Prima di ogni commit controlla rigorosamente cosa stai includendo (`git status`, `git diff --cached --name-only`). Se trovi file sensibili o non destinati alla pubblicazione in staging, toglili (`git reset`), aggiungili al `.gitignore` e segnalalo.
- Non rimuovere regole dal `.gitignore`; puoi aggiungerne.
- Messaggi di commit e descrizioni di PR: chiari, professionali, privi di dati sensibili.
