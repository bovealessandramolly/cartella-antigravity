#!/bin/bash

# Controlla se è stato fornito un messaggio di commit, altrimenti usa uno di default
COMMIT_MSG=${1:-"Aggiornamento automatico"}

echo "🚀 Inizio procedura di commit e push..."

# Aggiunge tutti i file modificati
git add .

# Esegue il commit
git commit -m "$COMMIT_MSG"

# Esegue il push su main
echo "📤 Caricamento su GitHub..."
git push origin main

if [ $? -eq 0 ]; then
    echo "✅ Successo! Le modifiche sono online."
else
    echo "❌ Errore durante il push. Controlla la connessione o le credenziali."
fi
