import { Bot } from 'grammy';
import { registerIdCommand } from './commands/id.js';
import { registerPingCommand } from './commands/ping.js';
import { registerStartCommand } from './commands/start.js';
import { registerAdminNotifier } from './handlers/adminNotifier.js';
import { registerMediaLinkHandler } from './handlers/mediaLinkHandler.js';
import { logger } from './utils/logger.js';

/**
 * Crea e configura l'istanza grammY registrando middleware, comandi e handler.
 */
export function createBot({ config, queue, seenTracker }) {
  const bot = new Bot(config.botToken);

  bot.catch((err) => {
    const updateId = err.ctx?.update?.update_id;
    logger.error('Errore middleware grammY', {
      updateId,
      error: err.error?.message || String(err.error),
    });
  });

  registerAdminNotifier(bot, { config, seenTracker });
  registerStartCommand(bot);
  registerIdCommand(bot);
  registerPingCommand(bot, { queue, config });
  registerMediaLinkHandler(bot, { queue, config });

  return bot;
}
