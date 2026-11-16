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

# 2. Directory dati persistente (cookies opzionali, seen-chats.json, log update)
mkdir -p "$SCRIPT_DIR/data"

trim() {
  local val="$1"
  val="${val#"${val%%[![:space:]]*}"}"
  val="${val%"${val##*[![:space:]]}"}"
  printf '%s' "$val"
}

ask_yes_no() {
  local prompt="$1"
  local default_answer="$2"
  local answer=""
  read -r -p "$prompt" answer
  answer="$(trim "$answer")"
  if [ -z "$answer" ]; then
    answer="$default_answer"
  fi
  case "${answer,,}" in
    s|si|sì|y|yes) return 0 ;;
    *) return 1 ;;
  esac
}

configure_env_interactively() {
  local bot_token=""
  local admin_ids=""
  local allowed_chats=""
  local notify_on_error="true"
  local drop_pending="false"

  echo ""
  echo "--- Configurazione iniziale (.env) ---"

  while true; do
    read -r -s -p "1) Inserisci BOT_TOKEN (da @BotFather, input nascosto): " bot_token
    echo ""
    bot_token="$(trim "$bot_token")"
    if [ -z "$bot_token" ]; then
      echo "   BOT_TOKEN obbligatorio: non può essere vuoto."
      continue
    fi
    if [[ ! "$bot_token" =~ ^[0-9]+:[A-Za-z0-9_-]{20,}$ ]]; then
      echo "   Attenzione: il formato non sembra quello standard di Telegram (<id>:<chiave>)."
      if ! ask_yes_no "   Usare comunque questo token? [s/N]: " "n"; then
        continue
      fi
    fi
    echo "   Token acquisito (${#bot_token} caratteri)."
    break
  done

  while true; do
    read -r -p "2) Inserisci ADMIN_IDS (il tuo User ID Telegram, separati da virgola se più di uno; Invio per saltare): " admin_ids
    admin_ids="$(printf '%s' "$admin_ids" | tr -d '[:space:]')"
    if [ -z "$admin_ids" ] || [[ "$admin_ids" =~ ^-?[0-9]+(,-?[0-9]+)*$ ]]; then
      break
    fi
    echo "   Formato non valido: inserisci solo numeri separati da virgola (es. 123456789)."
  done

  while true; do
    read -r -p "3) Inserisci ALLOWED_CHAT_IDS (Invio per permettere tutti i gruppi e chat private): " allowed_chats
    allowed_chats="$(printf '%s' "$allowed_chats" | tr -d '[:space:]')"
    if [ -z "$allowed_chats" ] || [[ "$allowed_chats" =~ ^-?[0-9]+(,-?[0-9]+)*$ ]]; then
      break
    fi
    echo "   Formato non valido: inserisci solo ID numerici separati da virgola (es. -1001234567890)."
  done

  if ! ask_yes_no "4) Avvisare in chat se il download di un video fallisce? [S/n]: " "s"; then
    notify_on_error="false"
  fi

  if ask_yes_no "5) Scartare i messaggi accumulati mentre il bot è spento al riavvio? [s/N]: " "n"; then
    drop_pending="true"
  fi

  cat > "$SCRIPT_DIR/.env" <<EOF
# Token del bot Telegram (ottenuto da @BotFather)
BOT_TOKEN=${bot_token}

# Lista separata da virgole di Chat ID autorizzati (vuoto = ovunque)
ALLOWED_CHAT_IDS=${allowed_chats}

# Lista separata da virgole di User ID admin (per /ping e notifiche nuovi utenti/gruppi)
ADMIN_IDS=${admin_ids}

# Invia un messaggio di errore se un link video fallisce (true/false)
NOTIFY_ON_ERROR=${notify_on_error}

# Scarta i messaggi accumulati mentre il bot era spento (true/false)
DROP_PENDING_UPDATES=${drop_pending}

# Limiti operativi (ottimizzati per VM e2-micro con 445 MiB RAM liberi)
MAX_FILE_SIZE_MB=48
DOWNLOAD_TIMEOUT_MS=60000
MAX_URLS_PER_MESSAGE=3
MAX_QUEUE_SIZE=20
EOF

  chmod 600 "$SCRIPT_DIR/.env"
  echo "File $SCRIPT_DIR/.env salvato (permessi 600)."
}

# 3. Prepara o riconfigura il file .env
if [ ! -f "$SCRIPT_DIR/.env" ]; then
  if [ -t 0 ]; then
    configure_env_interactively
  else
    cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
    chmod 600 "$SCRIPT_DIR/.env"
    echo "Creato $SCRIPT_DIR/.env da .env.example (terminale non interattivo)."
  fi
else
  echo "File $SCRIPT_DIR/.env già presente."
  if [ -t 0 ] && ask_yes_no "Vuoi riconfigurare .env adesso? [s/N]: " "n"; then
    configure_env_interactively
  fi
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
