/**
 * Registra i comandi /start e /help.
 */
export function registerStartCommand(bot) {
  const helpText = [
    '👋 <b>Ciao!</b>',
    '',
    'Invia (in chat privata o in un gruppo) un link di <b>TikTok</b> o <b>Instagram Reel</b> e lo scaricherò automaticamente allegando autore e descrizione originale.',
    '',
    '📌 <b>Nota per i gruppi:</b> assicurati che il bot possa leggere i messaggi del gruppo (Group Privacy disattivata su @BotFather o bot amministratore).',
  ].join('\n');

  bot.command(['start', 'help'], async (ctx) => {
    await ctx.reply(helpText, {
      parse_mode: 'HTML',
      reply_parameters: ctx.message
        ? { message_id: ctx.message.message_id, allow_sending_without_reply: true }
        : undefined,
    });
  });
}
