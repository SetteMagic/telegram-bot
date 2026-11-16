#!/usr/bin/env bash
set -euo pipefail

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

LOCK_FILE="/tmp/telegram-bot-update.lock"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Un altro aggiornamento è già in corso. Uscita."
  exit 0
fi

# Limita dimensione update.log a ~512 KB per preservare il disco
LOG_FILE="$SCRIPT_DIR/data/update.log"
if [ -f "$LOG_FILE" ] && [ "$(wc -c < "$LOG_FILE")" -gt 524288 ]; then
  tail -n 200 "$LOG_FILE" > "${LOG_FILE}.tmp" && mv "${LOG_FILE}.tmp" "$LOG_FILE"
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Controllo aggiornamenti su origin/main..."

git fetch origin main

LOCAL_HASH="$(git rev-parse HEAD)"
REMOTE_HASH="$(git rev-parse origin/main)"

if [ "$LOCAL_HASH" = "$REMOTE_HASH" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Nessun aggiornamento disponibile ($LOCAL_HASH)."
  exit 0
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Nuovi commit trovati ($LOCAL_HASH -> $REMOTE_HASH). Aggiornamento in corso..."

git pull --ff-only origin main

if docker info >/dev/null 2>&1; then
  DOCKER_CMD="docker"
else
  DOCKER_CMD="sudo docker"
fi

$DOCKER_CMD compose up -d --build
sudo docker image prune -f

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Aggiornamento completato con successo."
