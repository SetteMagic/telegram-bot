import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { logger } from './logger.js';

const TEMP_DIR_PREFIX = 'tg-dl-';
const IGNORED_EXTENSIONS = ['.json', '.part', '.ytdl', '.tmp', '.txt'];

export class DownloadError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'DownloadError';
    this.code = code;
  }
}

/**
 * Rimuove eventuali directory temporanee rimaste da crash o riavvii improvvisi.
 */
export async function cleanupStaleTempDirs() {
  const tmpRoot = os.tmpdir();
  let entries;
  try {
    entries = await fs.readdir(tmpRoot, { withFileTypes: true });
  } catch (err) {
    logger.warn('Impossibile leggere tmpdir per pulizia iniziale', { error: err.message });
    return;
  }

  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith(TEMP_DIR_PREFIX)) {
      await fs.rm(path.join(tmpRoot, entry.name), { recursive: true, force: true }).catch(() => {});
    }
  }
}

function resolveCookieFile(dataDir, platform) {
  const candidates = [
    path.join(dataDir, 'cookies', `${platform}.txt`),
    path.join(dataDir, `${platform}-cookies.txt`),
    path.join(dataDir, 'cookies.txt'),
  ];

  for (const candidate of candidates) {
    try {
      const stat = fsSync.statSync(candidate);
      if (stat.isFile() && stat.size > 0) {
        return candidate;
      }
    } catch {
      // File non presente, continua col candidato successivo
    }
  }

  return null;
}

function runYtDlp(ytdlpPath, args, timeoutMs) {
  return new Promise((resolve) => {
    let timedOut = false;
    let hardTimer;

    const child = execFile(
      ytdlpPath,
      args,
      { maxBuffer: 4 * 1024 * 1024 },
      (error, stdout, stderr) => {
        clearTimeout(softTimer);
        clearTimeout(hardTimer);
        resolve({ error, stdout: stdout || '', stderr: stderr || '', timedOut });
      }
    );

    const softTimer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      hardTimer = setTimeout(() => {
        child.kill('SIGKILL');
      }, 2000);
    }, timeoutMs);
  });
}

function classifyFailure(output, timedOut) {
  if (timedOut) {
    return new DownloadError('TIMEOUT', 'Download interrotto per timeout.');
  }

  const lower = output.toLowerCase();

  if (lower.includes('larger than max-filesize') || lower.includes('max-filesize')) {
    return new DownloadError('TOO_LARGE', 'Video superiore al limite massimo consentito.');
  }

  if (
    lower.includes('there is no video in this post')
    || lower.includes('no video formats found')
    || (lower.includes('unsupported url') && lower.includes('/photo/'))
  ) {
    return new DownloadError('NO_VIDEO', 'Il link non contiene un video scaricabile.');
  }

  if (
    lower.includes('login required')
    || lower.includes('empty media response')
    || lower.includes('sign in')
    || lower.includes('rate-limit')
    || lower.includes('401')
    || lower.includes('403')
    || lower.includes('cookies')
  ) {
    return new DownloadError('AUTH_REQUIRED', 'La piattaforma richiede autenticazione o cookie aggiornati.');
  }

  if (
    lower.includes('private')
    || lower.includes('unavailable')
    || lower.includes('not found')
    || lower.includes('404')
    || lower.includes('removed')
  ) {
    return new DownloadError('UNAVAILABLE', 'Contenuto privato, rimosso o non disponibile.');
  }

  return new DownloadError('UNKNOWN', 'Errore imprevisto durante il download del video.');
}

async function readJobArtifacts(jobDir) {
  const files = await fs.readdir(jobDir);
  let infoJson = null;
  let videoFile = null;

  for (const name of files) {
    const fullPath = path.join(jobDir, name);
    if (name.endsWith('.info.json')) {
      try {
        const raw = await fs.readFile(fullPath, 'utf8');
        infoJson = JSON.parse(raw);
      } catch {
        infoJson = null;
      }
      continue;
    }

    const lower = name.toLowerCase();
    if (IGNORED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
      continue;
    }

    const stat = await fs.stat(fullPath);
    if (stat.isFile() && stat.size > 0) {
      if (!videoFile || stat.size > videoFile.size) {
        videoFile = { path: fullPath, size: stat.size };
      }
    }
  }

  return { infoJson, videoFile };
}

/**
 * Costruisce la lista di argomenti CLI sicuri per yt-dlp.
 */
export function buildYtDlpArgs({ url, maxFileSizeMb, outputTemplate, cookiePath = null }) {
  return [
    '--ignore-config',
    '--no-playlist',
    '--no-warnings',
    '--socket-timeout', '15',
    '--retries', '2',
    '--max-filesize', `${maxFileSizeMb}M`,
    '-S', 'vcodec:h264,acodec:aac,res:1080',
    '-f', 'bv*+ba/b',
    '--merge-output-format', 'mp4',
    '--write-info-json',
    '--clean-info-json',
    '--restrict-filenames',
    '-o', outputTemplate,
    ...(cookiePath ? ['--cookies', cookiePath] : []),
    '--',
    url,
  ];
}

/**
 * Scarica un video TikTok o Instagram Reel in una directory temporanea isolata.
 * Il chiamante deve sempre invocare `result.cleanup()` in un blocco finally.
 */
export async function downloadMedia({ url, platform, config }) {
  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    throw new DownloadError('UNKNOWN', 'Protocollo URL non supportato.');
  }

  const jobDir = path.join(os.tmpdir(), `${TEMP_DIR_PREFIX}${crypto.randomUUID()}`);
  await fs.mkdir(jobDir, { recursive: true });

  const cleanup = async () => {
    await fs.rm(jobDir, { recursive: true, force: true }).catch((err) => {
      logger.warn('Errore nella pulizia della directory temporanea', { jobDir, error: err.message });
    });
  };

  try {
    let tempCookiePath = null;
    const sourceCookiePath = resolveCookieFile(config.dataDir, platform);
    if (sourceCookiePath) {
      tempCookiePath = path.join(jobDir, 'cookies.txt');
      // Copia isolata per evitare che yt-dlp modifichi o corrompa il file originale in /app/data
      await fs.copyFile(sourceCookiePath, tempCookiePath);
    }

    const args = buildYtDlpArgs({
      url: parsedUrl.toString(),
      maxFileSizeMb: config.maxFileSizeMb,
      outputTemplate: path.join(jobDir, 'video.%(ext)s'),
      cookiePath: tempCookiePath,
    });

    const { error, stdout, stderr, timedOut } = await runYtDlp(
      config.ytdlpPath,
      args,
      config.downloadTimeoutMs
    );

    if (error?.code === 'ENOENT') {
      throw new DownloadError('UNKNOWN', `Eseguibile yt-dlp non trovato (${config.ytdlpPath}).`);
    }

    const combinedOutput = `${stdout}\n${stderr}`;
    const { infoJson, videoFile } = await readJobArtifacts(jobDir);

    if (combinedOutput.toLowerCase().includes('larger than max-filesize')) {
      throw new DownloadError('TOO_LARGE', 'Video superiore al limite massimo consentito.');
    }

    if (error || !videoFile) {
      logger.warn('Download yt-dlp fallito', {
        platform,
        url,
        code: error?.code,
        stderr: stderr.slice(0, 400),
      });
      throw classifyFailure(combinedOutput, timedOut);
    }

    if (videoFile.size > config.maxFileSizeBytes) {
      throw new DownloadError('TOO_LARGE', 'Video superiore al limite massimo consentito da Telegram.');
    }

    return {
      filePath: videoFile.path,
      fileSize: videoFile.size,
      metadata: infoJson || {},
      cleanup,
    };
  } catch (err) {
    await cleanup();
    throw err;
  }
}
