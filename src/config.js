import fs from 'node:fs';
import path from 'node:path';

const PLACEHOLDER_TOKEN = 'inserisci_qui_il_tuo_bot_token';

function loadDotEnvIfNeeded() {
  if (process.env.BOT_TOKEN) return;

  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;

  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(envPath);
  }
}

function parseIdSet(rawValue) {
  if (!rawValue) return new Set();

  return new Set(
    rawValue
      .split(',')
      .map((item) => item.trim())
      .filter((item) => /^-?\d+$/.test(item))
      .map((item) => Number(item))
  );
}

function parsePositiveInt(rawValue, fallback) {
  if (!rawValue) return fallback;
  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBoolean(rawValue, fallback) {
  if (rawValue === undefined || rawValue === '') return fallback;
  const normalized = rawValue.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  return fallback;
}

/**
 * Carica e valida la configurazione dell'applicazione dalle variabili d'ambiente.
 */
export function loadConfig() {
  loadDotEnvIfNeeded();

  const botToken = process.env.BOT_TOKEN?.trim() || '';
  if (!botToken || botToken === PLACEHOLDER_TOKEN) {
    throw new Error('BOT_TOKEN mancante o non configurato. Impostalo nel file .env.');
  }

  const maxFileSizeMb = parsePositiveInt(process.env.MAX_FILE_SIZE_MB, 48);

  return Object.freeze({
    botToken,
    allowedChatIds: parseIdSet(process.env.ALLOWED_CHAT_IDS),
    adminIds: parseIdSet(process.env.ADMIN_IDS),
    notifyOnError: parseBoolean(process.env.NOTIFY_ON_ERROR, true),
    dropPendingUpdates: parseBoolean(process.env.DROP_PENDING_UPDATES, false),
    maxFileSizeMb,
    maxFileSizeBytes: maxFileSizeMb * 1024 * 1024,
    downloadTimeoutMs: parsePositiveInt(process.env.DOWNLOAD_TIMEOUT_MS, 60_000),
    maxUrlsPerMessage: parsePositiveInt(process.env.MAX_URLS_PER_MESSAGE, 3),
    maxQueueSize: parsePositiveInt(process.env.MAX_QUEUE_SIZE, 20),
    ytdlpPath: process.env.YTDLP_PATH?.trim() || 'yt-dlp',
    dataDir: path.resolve(process.cwd(), process.env.DATA_DIR?.trim() || 'data'),
  });
}
