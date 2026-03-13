# Digiuno Tracker

Applicazione web semplice per tenere traccia delle ore di digiuno e mostrare una **classifica stile F1** tra tutti gli utenti.

## Come avviare il progetto

1. Assicurati di avere installato **Node.js** (versione LTS consigliata).
2. Nel terminale, posizionati nella cartella del progetto:

   ```bash
   cd Digiuno
   ```

3. Installa le dipendenze (se non lo hai già fatto):

   ```bash
   npm install
   ```

4. Avvia il server:

   ```bash
   npm start
   ```

5. Apri il browser su `http://localhost:3000`.

## Funzionalità

- **Iscrizione veloce** solo con username (senza password).
- **Avvio/termine del digiuno** con un click.
- **Calcolo automatico delle ore totali di digiuno** (somma di tutte le sessioni).
- **Classifica globale** ordinata per ore totali, aggiornata periodicamente.

## Note tecniche

- Backend in **Node.js + Express**.
- Dati salvati in un file **SQLite** (`data.db`) nella root del progetto.
- Frontend statico in `public/` con HTML, CSS e JavaScript moderno.

