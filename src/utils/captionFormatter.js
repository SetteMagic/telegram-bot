const TELEGRAM_CAPTION_LIMIT = 1024;
const GENERIC_TITLE_REGEX = /^(video by |tiktok video #|instagram video)/i;

/**
 * Esegue l'escape dei caratteri speciali per Telegram parse_mode HTML.
 */
export function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function cleanText(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/\r\n/g, '\n').trim();
}

function isNumericId(value) {
  return /^\d+$/.test(value);
}

function extractAuthorInfo(meta) {
  if (!meta) return { label: '', url: '' };

  const displayName = cleanText(meta.creator || meta.uploader);
  const rawHandle = cleanText(meta.channel || (!isNumericId(meta.uploader_id || '') ? meta.uploader_id : ''));
  const handle = rawHandle.replace(/^@/, '');

  let label = '';
  if (displayName && handle && displayName.toLowerCase() !== handle.toLowerCase()) {
    label = `${displayName} (@${handle})`;
  } else if (handle) {
    label = `@${handle}`;
  } else if (displayName) {
    label = displayName;
  }

  let url = '';
  const candidateUrl = cleanText(meta.uploader_url || meta.channel_url);
  if (candidateUrl.startsWith('https://') || candidateUrl.startsWith('http://')) {
    url = candidateUrl;
  }

  return { label, url };
}

function extractDescription(meta) {
  if (!meta) return '';

  const desc = cleanText(meta.description);
  if (desc) return desc;

  const title = cleanText(meta.title);
  if (title && !GENERIC_TITLE_REGEX.test(title)) {
    return title;
  }

  return '';
}

function truncateText(text, maxLength) {
  if (maxLength <= 0) return '';
  if (text.length <= maxLength) return text;
  if (maxLength === 1) return '…';

  const slice = text.slice(0, maxLength - 1);
  const lastSpace = Math.max(slice.lastIndexOf(' '), slice.lastIndexOf('\n'));
  const cut = lastSpace > Math.floor(maxLength * 0.6) ? slice.slice(0, lastSpace) : slice;
  return `${cut.trimEnd()}…`;
}

/**
 * Formatta autore, descrizione del video e link originale in HTML sicuro entro i 1024 caratteri Telegram.
 */
export function formatVideoCaption(meta, sourceUrl) {
  const author = extractAuthorInfo(meta);
  const description = extractDescription(meta);

  const authorHtml = author.label
    ? (author.url
        ? `👤 <a href="${escapeHtml(author.url)}"><b>${escapeHtml(author.label)}</b></a>`
        : `👤 <b>${escapeHtml(author.label)}</b>`)
    : '';

  const footerText = 'Link originale';
  const footerHtml = sourceUrl
    ? `🔗 <a href="${escapeHtml(sourceUrl)}">${footerText}</a>`
    : '';

  // Calcola lo spazio residuo reale per la descrizione contando i caratteri UTF-16 renderizzati
  const fixedPlainLength = (author.label ? `👤 ${author.label}`.length + 2 : 0)
    + (sourceUrl ? `🔗 ${footerText}`.length + 2 : 0);
  const availableForDesc = TELEGRAM_CAPTION_LIMIT - fixedPlainLength;

  const finalDescription = description && availableForDesc > 10
    ? truncateText(description, availableForDesc)
    : '';

  const htmlBlocks = [];
  if (authorHtml) htmlBlocks.push(authorHtml);
  if (finalDescription) htmlBlocks.push(escapeHtml(finalDescription));
  if (footerHtml) htmlBlocks.push(footerHtml);

  return htmlBlocks.join('\n\n');
}
