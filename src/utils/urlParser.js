const RAW_URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
const TRAILING_PUNCTUATION_REGEX = /[),.!?;:'"]+$/;

const TIKTOK_HOSTS = new Set([
  'tiktok.com',
  'www.tiktok.com',
  'm.tiktok.com',
  'vm.tiktok.com',
  'vt.tiktok.com',
]);

const TIKTOK_SHORT_HOSTS = new Set([
  'vm.tiktok.com',
  'vt.tiktok.com',
]);

const INSTAGRAM_HOSTS = new Set([
  'instagram.com',
  'www.instagram.com',
  'm.instagram.com',
  'instagr.am',
  'www.instagr.am',
]);

const TRACKING_PARAMS = new Set([
  'igsh',
  'igshid',
  'fbclid',
  '_t',
  '_r',
  'is_from_webapp',
  'sender_device',
  'sender_web_id',
  'tt_from',
  'u_code',
  'share_app_id',
  'checksum',
  'sec_uid',
  'preview_pb',
  'language',
  'referer_url',
]);

function stripTrackingParams(urlObj) {
  for (const key of [...urlObj.searchParams.keys()]) {
    const lower = key.toLowerCase();
    if (TRACKING_PARAMS.has(lower) || lower.startsWith('utm_')) {
      urlObj.searchParams.delete(key);
    }
  }
}

function classifySupportedUrl(rawCandidate) {
  const cleaned = rawCandidate.trim().replace(TRAILING_PUNCTUATION_REGEX, '');
  let parsed;
  try {
    parsed = new URL(cleaned);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname;

  if (TIKTOK_HOSTS.has(host)) {
    const isShort = TIKTOK_SHORT_HOSTS.has(host) && /^\/[A-Za-z0-9_-]+\/?$/.test(pathname);
    const isVideo = /^\/@[^/]*\/video\/\d+/.test(pathname)
      || /^\/t\/[A-Za-z0-9_-]+\/?$/.test(pathname)
      || /^\/v\/\d+/.test(pathname);

    if (!isShort && !isVideo) {
      return null;
    }

    parsed.protocol = 'https:';
    parsed.hash = '';
    stripTrackingParams(parsed);
    return { platform: 'tiktok', url: parsed.toString() };
  }

  if (INSTAGRAM_HOSTS.has(host)) {
    const isReelOrPost = /^\/(?:[A-Za-z0-9._]+\/)?(?:reels?|p|tv)\/[A-Za-z0-9_-]+/.test(pathname)
      || /^\/share\/(?:(?:reel|p)\/)?[A-Za-z0-9_-]+/.test(pathname);

    if (!isReelOrPost) {
      return null;
    }

    parsed.protocol = 'https:';
    parsed.hash = '';
    stripTrackingParams(parsed);
    return { platform: 'instagram', url: parsed.toString() };
  }

  return null;
}

function collectRawCandidatesFromTextAndEntities(text, entities) {
  const candidates = [];
  if (!text) return candidates;

  if (Array.isArray(entities)) {
    for (const entity of entities) {
      if (entity.type === 'text_link' && entity.url) {
        candidates.push(entity.url);
      } else if (entity.type === 'url') {
        candidates.push(text.slice(entity.offset, entity.offset + entity.length));
      }
    }
  }

  const matches = text.match(RAW_URL_REGEX);
  if (matches) {
    candidates.push(...matches);
  }

  return candidates;
}

/**
 * Estrae, normalizza e deduplica i link TikTok e Instagram Reel da un messaggio Telegram.
 * @param {import('grammy/types').Message} message
 * @param {number} maxUrls
 * @returns {Array<{ platform: 'tiktok' | 'instagram', url: string }>}
 */
export function extractSupportedUrls(message, maxUrls = 3) {
  if (!message) return [];

  const rawCandidates = [
    ...collectRawCandidatesFromTextAndEntities(message.text, message.entities),
    ...collectRawCandidatesFromTextAndEntities(message.caption, message.caption_entities),
  ];

  const seen = new Set();
  const results = [];

  for (const candidate of rawCandidates) {
    const normalized = classifySupportedUrl(candidate);
    if (!normalized || seen.has(normalized.url)) {
      continue;
    }

    seen.add(normalized.url);
    results.push(normalized);

    if (results.length >= maxUrls) {
      break;
    }
  }

  return results;
}
