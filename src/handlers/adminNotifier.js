import { escapeHtml } from '../utils/captionFormatter.js';
import { logger } from '../utils/logger.js';

function formatUserLabel(user) {
  if (!user) return 'Sconosciuto';
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || 'Utente';
  const usernamePart = user.username ? ` (@${user.username})` : '';
  return `${escapeHtml(fullName + usernamePart)} [<code>${user.id}</code>]`;
}

function formatGroupLabel(chat) {
  const title = escapeHtml(chat.title || 'Gruppo senza nome');
  const usernamePart = chat.username ? ` (@${escapeHtml(chat.username)})` : '';
  return `<b>${title}</b>${usernamePart}\n🆔 Chat ID: <code>${chat.id}</code>`;
}

function notifyAdmins(api, adminIds, htmlText) {
  for (const adminId of adminIds) {
    api
      .sendMessage(adminId, htmlText, { parse_mode: 'HTML' })
      .catch((err) => {
        logger.warn('Impossibile inviare notifica admin (hai già avviato il bot con /start?)', {
          adminId,
          error: err?.message,
        });
      });
  }
}

/**
 * Registra il middleware per notificare gli admin al primo utilizzo da parte di
 * un nuovo gruppo (aggiunta o primo messaggio) o di un nuovo utente in chat privata.
 */
export function registerAdminNotifier(bot, { config, seenTracker }) {
  if (!seenTracker) return;

  bot.use(async (ctx, next) => {
    if (config.adminIds.size > 0 && ctx.chat) {
      const chatType = ctx.chat.type;
      const isGroup = chatType === 'group' || chatType === 'supergroup';
      const isPrivate = chatType === 'private';

      if (ctx.myChatMember && isGroup) {
        const oldStatus = ctx.myChatMember.old_chat_member?.status;
        const newStatus = ctx.myChatMember.new_chat_member?.status;
        const justAdded = (oldStatus === 'left' || oldStatus === 'kicked')
          && (newStatus === 'member' || newStatus === 'administrator');

        if (justAdded && seenTracker.markIfNew(ctx.chat.id)) {
          const text = [
            '➕ <b>Bot aggiunto a un nuovo gruppo</b>',
            formatGroupLabel(ctx.chat),
            `👤 Aggiunto da: ${formatUserLabel(ctx.from)}`,
          ].join('\n');
          notifyAdmins(ctx.api, config.adminIds, text);
        }
      } else if (ctx.message && !ctx.from?.is_bot) {
        if (isPrivate) {
          const userId = ctx.from?.id;
          const isSelfAdmin = userId !== undefined && config.adminIds.has(userId);
          if (seenTracker.markIfNew(ctx.chat.id) && !isSelfAdmin) {
            const text = [
              '👤 <b>Nuovo utente ha avviato/usato il bot in privato</b>',
              `Utente: ${formatUserLabel(ctx.from)}`,
            ].join('\n');
            notifyAdmins(ctx.api, config.adminIds, text);
          }
        } else if (isGroup) {
          if (seenTracker.markIfNew(ctx.chat.id)) {
            const text = [
              '👥 <b>Primo utilizzo in un nuovo gruppo</b>',
              formatGroupLabel(ctx.chat),
              `👤 Primo messaggio da: ${formatUserLabel(ctx.from)}`,
            ].join('\n');
            notifyAdmins(ctx.api, config.adminIds, text);
          }
        }
      }
    }

    await next();
  });
}
