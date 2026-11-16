# Telegram Reels Bot (TikTok & Instagram)

Bot Telegram leggero in Node.js 22 (`grammY` + `yt-dlp`) progettato per girare 24/7 in Docker su una VM `e2-micro` con risorse ridotte (`--max-old-space-size=160`, coda sequenziale con concorrenza 1).

## Funzionalità

- Rileva automaticamente link **TikTok** (`tiktok.com/@.../video/...`, `vm.tiktok.com`, `vt.tiktok.com`, `tiktok.com/t/...`) e **Instagram** (`/reel/`, `/reels/`, `/p/`, `/tv/`, `/share/...`) in gruppi, supergruppi (inclusi Topic) e chat private.
- Scarica il video in MP4 (H.264/AAC), lo invia in risposta al messaggio originale includendo **autore**, **descrizione originale** e **link alla fonte**, e rimuove immediatamente i file temporanei.
- Comandi: `/start`, `/help`, `/id` (mostra il tuo User ID / Chat ID), `/ping` (diagnostica riservata agli `ADMIN_IDS`).
- Se imposti `ADMIN_IDS` nel `.env` e avvii il bot una prima volta in privato con `/start`, riceverai una notifica quando un nuovo gruppo o un nuovo utente privato usa il bot per la prima volta.

## Configurazione BotFather per i Gruppi

Su `@BotFather`:
1. Invia `/setprivacy` → seleziona il bot → **`Disable`** (necessario affinché il bot possa leggere i messaggi non-comando nei gruppi, oppure rendi il bot amministratore del gruppo).

## Cookie opzionali per Instagram (consigliato su IP cloud)

Instagram spesso blocca le richieste anonime da IP di datacenter (es. Google Cloud). Se i link Instagram restituiscono errore di autenticazione/rate-limit, esporta i cookie di un account Instagram secondario in formato Netscape e salvali nella cartella `data/` sulla VM:

- `data/cookies/instagram.txt` (oppure `data/instagram-cookies.txt`)
- opzionale per TikTok: `data/cookies/tiktok.txt`

## Deploy sulla VM (`~/telegram-bot`)

```bash
git clone <URL_REPO_PRIVATA> ~/telegram-bot
cd ~/telegram-bot
chmod +x setup-server.sh update-server.sh
./setup-server.sh
```

Lo script `./setup-server.sh` chiede interattivamente i parametri principali (`BOT_TOKEN`, `ADMIN_IDS`, ecc.), salva `.env` con permessi `600`, configura il cron notturno alle `05:00` e avvia automaticamente la prima build e il container Docker.
