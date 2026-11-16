import fs from 'node:fs';
import { InputFile } from 'grammy';
import { formatVideoCaption } from '../utils/captionFormatter.js';
import { DownloadError, downloadMedia } from '../utils/downloader.js';
import { logger } from '../utils/logger.js';
import { QueueFullError } from '../utils/queue.js';
import { extractSupportedUrls } from '../utils/urlParser.js';

function getUserFriendlyErrorMessage(err, maxFileSizeMb) {
  if (err instanceof QueueFullError) {
    return '⏳ Coda download temporaneamente piena, riprova tra qualche secondo.';
  }

  if (!(err instanceof DownloadError)) {
    return '⚠️ Errore imprevisto durante l’elaborazione del video.';
  }

  switch (err.code) {
    case 'TOO_LARGE':
      return `⚠️ Video troppo pesante (supera il limite di ${maxFileSizeMb} MB).`;
    case 'AUTH_REQUIRED':
      return '⚠️ Non posso scaricare questo contenuto (accesso bloccato o cookie richiesti).';
    case 'UNAVAILABLE':
      return '⚠️ Video privato, rimosso o non disponibile.';
    case 'TIMEOUT':
      return '⚠️ Download interrotto per timeout, riprova più tardi.';
    case 'NO_VIDEO':
      return null;
    default:
      return '⚠️ Impossibile scaricare il video da questo link.';
  }
}

function toOptionalPositiveInt(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? Math.round(num) : undefined;
}

/**
 * Registra l'handler per intercettare i link TikTok e Instagram Reel in gruppi e chat private.
 */
export function registerMediaLinkHandler(bot, { queue, config }) {
  bot.on('message', async (ctx) => {
    const message = ctx.message;
    if (!message || ctx.from?.is_bot) return;

    if (config.allowedChatIds.size > 0 && !config.allowedChatIds.has(ctx.chat.id)) {
      return;
    }

    const links = extractSupportedUrls(message, config.maxUrlsPerMessage);
    if (links.length === 0) return;

    const replyParameters = {
      message_id: message.message_id,
      allow_sending_without_reply: true,
    };
    const threadId = message.message_thread_id;

    for (const item of links) {
      queue
        .enqueue(async () => {
          await ctx.api.sendChatAction(ctx.chat.id, 'upload_video', {
            message_thread_id: threadId,
          }).catch(() => {});

          const result = await downloadMedia({
            url: item.url,
            platform: item.platform,
            config,
          });

          try {
            const caption = formatVideoCaption(result.metadata, item.url);
            const stream = fs.createReadStream(result.filePath);

            await ctx.api.sendVideo(
              ctx.chat.id,
              new InputFile(stream, `${item.platform}.mp4`),
              {
                caption: caption || undefined,
                parse_mode: caption ? 'HTML' : undefined,
                supports_streaming: true,
                width: toOptionalPositiveInt(result.metadata.width),
                height: toOptionalPositiveInt(result.metadata.height),
                duration: toOptionalPositiveInt(result.metadata.duration),
                message_thread_id: threadId,
                reply_parameters: replyParameters,
              }
            );

            logger.info('Video inviato', {
              chatId: ctx.chat.id,
              platform: item.platform,
              sizeMb: (result.fileSize / (1024 * 1024)).toFixed(2),
            });
          } finally {
            await result.cleanup();
          }
        })
        .catch(async (err) => {
          if (err instanceof DownloadError && err.code === 'NO_VIDEO') {
            logger.info('Link ignorato (nessun video presente)', { url: item.url });
            return;
          }

          logger.error('Errore gestione link video', {
            chatId: ctx.chat.id,
            url: item.url,
            code: err?.code,
            message: err?.message,
          });

          if (!config.notifyOnError) return;

          const notice = getUserFriendlyErrorMessage(err, config.maxFileSizeMb);
          if (!notice) return;

          await ctx.api.sendMessage(ctx.chat.id, notice, {
            message_thread_id: threadId,
            reply_parameters: replyParameters,
          }).catch(() => {});
        });
    }
  });
}
