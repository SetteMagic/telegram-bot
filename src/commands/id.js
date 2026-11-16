/**
 * Registra il comando /id per mostrare l'ID dell'utente e della chat corrente.
 */
export function registerIdCommand(bot) {
  bot.command('id', async (ctx) => {
    const userId = ctx.from?.id;
    const chatId = ctx.chat?.id;
    const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';

    const lines = [];
    if (userId !== undefined) {
      lines.push(`🆔 <b>Il tuo User ID:</b> <code>${userId}</code>`);
    }
    if (isGroup && chatId !== undefined) {
      lines.push(`💬 <b>Chat ID gruppo:</b> <code>${chatId}</code>`);
    }

    if (lines.length === 0) return;

    await ctx.reply(lines.join('\n'), {
      parse_mode: 'HTML',
      reply_parameters: ctx.message
        ? { message_id: ctx.message.message_id, allow_sending_without_reply: true }
        : undefined,
    });
  });
}
