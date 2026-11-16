#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Setup Bot Telegram ($SCRIPT_DIR) ==="

# 1. Verifica prerequisiti già presenti sulla VM (non reinstalla Docker né ricrea lo Swap)
if ! command -v git >/dev/null 2>&1; then
  echo "Errore: git non è installato." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Errore: Docker non trovato. Questa VM dovrebbe già avere Docker installato." >&2
  exit 1
fi

if docker info >/dev/null 2>&1; then
  DOCKER_CMD="docker"
else
  DOCKER_CMD="sudo docker"
fi

# 2. Directory dati persistente (cookies opzionali, log update)
mkdir -p "$SCRIPT_DIR/data"

# 3. Prepara file .env se mancante
if [ ! -f "$SCRIPT_DIR/.env" ]; then
  cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
  echo "Creato $SCRIPT_DIR/.env da .env.example."
  echo "IMPORTANTE: modifica $SCRIPT_DIR/.env e inserisci il tuo BOT_TOKEN prima di avviare il bot."
fi

# 4. Rende eseguibile lo script di aggiornamento
chmod +x "$SCRIPT_DIR/update-server.sh"

# 5. Aggiunge il cron job notturno alle 05:00 senza toccare i cron esistenti (es. discord-bot alle 04:30)
CRON_CMD="0 5 * * * $SCRIPT_DIR/update-server.sh >> $SCRIPT_DIR/data/update.log 2>&1"
(crontab -l 2>/dev/null | grep -v "telegram-bot/update-server.sh"; echo "$CRON_CMD") | crontab -
echo "Cron job configurato alle 05:00 (crontab precedente preservato)."

# 6. Avvia il container solo se BOT_TOKEN è già stato configurato
if grep -q '^BOT_TOKEN=inserisci_qui_il_tuo_bot_token$' "$SCRIPT_DIR/.env" || ! grep -q '^BOT_TOKEN=.\+' "$SCRIPT_DIR/.env"; then
  echo "Setup completato. Configura BOT_TOKEN in $SCRIPT_DIR/.env e poi esegui:"
  echo "  $DOCKER_CMD compose up -d --build"
else
  echo "Build e avvio del container telegram-bot..."
  $DOCKER_CMD compose up -d --build
  echo "Container avviato. Log in tempo reale con: $DOCKER_CMD logs -f telegram-bot"
fi
