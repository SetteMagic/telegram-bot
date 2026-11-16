import { createBot } from './bot.js';
import { loadConfig } from './config.js';
import { cleanupStaleTempDirs } from './utils/downloader.js';
import { logger } from './utils/logger.js';
import { AsyncQueue } from './utils/queue.js';

async function main() {
  const config = loadConfig();
  await cleanupStaleTempDirs();

  const queue = new AsyncQueue({
    concurrency: 1,
    maxSize: config.maxQueueSize,
  });

  const bot = createBot({ config, queue });
  let isShuttingDown = false;

  async function shutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`Ricevuto segnale ${signal}. Arresto controllato in corso...`);
    queue.clearPending('Arresto del bot in corso');

    try {
      await Promise.race([
        bot.stop(),
        new Promise((resolve) => setTimeout(resolve, 5_000)),
      ]);
      await Promise.race([
        queue.waitForIdle(),
        new Promise((resolve) => setTimeout(resolve, 5_000)),
      ]);
      logger.info('Arresto completato correttamente.');
      process.exit(0);
    } catch (err) {
      logger.error('Errore durante lo shutdown', err);
      process.exit(1);
    }
  }

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    logger.error('unhandledRejection rilevata', reason instanceof Error ? reason : { reason });
  });

  process.on('uncaughtException', (err) => {
    logger.error('uncaughtException fatale', err);
    shutdown('uncaughtException');
  });

  logger.info('Avvio Bot Telegram in modalità Long Polling...');
  await bot.start({
    drop_pending_updates: config.dropPendingUpdates,
    allowed_updates: ['message'],
    onStart: (botInfo) => {
      logger.info(`Bot online come @${botInfo.username} (id: ${botInfo.id})`);
    },
  });
}

main().catch((err) => {
  logger.error('Avvio fallito', err);
  process.exit(1);
});
