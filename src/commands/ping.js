function formatUptime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hrs}h ${mins}m ${secs}s`;
}

/**
 * Registra il comando diagnostico /ping riservato esclusivamente agli ADMIN_IDS.
 */
export function registerPingCommand(bot, { queue, config }) {
  bot.command('ping', async (ctx) => {
    const userId = ctx.from?.id;
    if (userId === undefined || !config.adminIds.has(userId)) {
      return;
    }

    const rssMb = (process.memoryUsage().rss / (1024 * 1024)).toFixed(1);
    const lines = [
      '🏓 <b>Pong!</b> Bot attivo.',
      `⏱ Uptime: <code>${formatUptime(process.uptime())}</code>`,
      `🧠 RAM RSS: <code>${rssMb} MiB</code>`,
      `📥 Coda: <code>${queue.activeCount} attivi / ${queue.size} in attesa</code>`,
    ];

    await ctx.reply(lines.join('\n'), {
      parse_mode: 'HTML',
      reply_parameters: ctx.message
        ? { message_id: ctx.message.message_id, allow_sending_without_reply: true }
        : undefined,
    });
  });
}
