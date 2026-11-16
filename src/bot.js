import { Bot } from 'grammy';
import { registerPingCommand } from './commands/ping.js';
import { registerStartCommand } from './commands/start.js';
import { registerMediaLinkHandler } from './handlers/mediaLinkHandler.js';
import { logger } from './utils/logger.js';

/**
 * Crea e configura l'istanza grammY registrando comandi, handler e gestione errori.
 */
export function createBot({ config, queue }) {
  const bot = new Bot(config.botToken);

  bot.catch((err) => {
    const updateId = err.ctx?.update?.update_id;
    logger.error('Errore middleware grammY', {
      updateId,
      error: err.error?.message || String(err.error),
    });
  });

  registerStartCommand(bot);
  registerPingCommand(bot, { queue, config });
  registerMediaLinkHandler(bot, { queue, config });

  return bot;
}
