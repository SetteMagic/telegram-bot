import assert from 'node:assert/strict';
import test from 'node:test';
import { extractSupportedUrls } from '../src/utils/urlParser.js';

test('estrae e pulisce link TikTok completi e short', () => {
  const urls = extractSupportedUrls({
    text: 'Guarda questo https://www.tiktok.com/@creator.test/video/7345678901234567890?is_from_webapp=1&sender_device=pc e anche https://vm.tiktok.com/ZM6abc123/!',
  });

  assert.deepEqual(urls, [
    {
      platform: 'tiktok',
      url: 'https://www.tiktok.com/@creator.test/video/7345678901234567890',
    },
    {
      platform: 'tiktok',
      url: 'https://vm.tiktok.com/ZM6abc123/',
    },
  ]);
});

test('estrae link Instagram Reel, con username, share e /p/ eliminando tracking igsh', () => {
  const urls = extractSupportedUrls(
    {
      text: [
        'https://www.instagram.com/reel/C8abcXYZ123/?igsh=MzRlODBiNWFlZA==',
        'https://instagram.com/nome.utente/reels/D1xyz987/',
        'https://www.instagram.com/share/reel/BAI999/?utm_source=ig_web_copy_link',
        'https://www.instagram.com/p/C9post123/',
      ].join(' '),
    },
    5
  );

  assert.deepEqual(urls, [
    { platform: 'instagram', url: 'https://www.instagram.com/reel/C8abcXYZ123/' },
    { platform: 'instagram', url: 'https://instagram.com/nome.utente/reels/D1xyz987/' },
    { platform: 'instagram', url: 'https://www.instagram.com/share/reel/BAI999/' },
    { platform: 'instagram', url: 'https://www.instagram.com/p/C9post123/' },
  ]);
});

test('estrae link da caption_entities text_link e deduplica', () => {
  const urls = extractSupportedUrls({
    caption: 'Video top https://vm.tiktok.com/ZM6abc123/',
    caption_entities: [
      { type: 'text_link', offset: 0, length: 5, url: 'https://vm.tiktok.com/ZM6abc123/?_t=8abc' },
      { type: 'text_link', offset: 6, length: 3, url: 'https://www.instagram.com/reel/ABC123/?igsh=123' },
    ],
  });

  assert.deepEqual(urls, [
    { platform: 'tiktok', url: 'https://vm.tiktok.com/ZM6abc123/' },
    { platform: 'instagram', url: 'https://www.instagram.com/reel/ABC123/' },
  ]);
});

test('ignora domini non supportati e link a soli profili', () => {
  const urls = extractSupportedUrls({
    text: [
      'https://www.youtube.com/shorts/abc123',
      'https://evil-tiktok.com/@user/video/123',
      'https://www.tiktok.com/@onlyprofile',
      'https://www.instagram.com/onlyprofile/',
    ].join(' '),
  });

  assert.deepEqual(urls, []);
});

test('rispetta il limite maxUrls', () => {
  const urls = extractSupportedUrls(
    {
      text: [
        'https://www.instagram.com/reel/A1/',
        'https://www.instagram.com/reel/A2/',
        'https://www.instagram.com/reel/A3/',
        'https://www.instagram.com/reel/A4/',
      ].join(' '),
    },
    2
  );

  assert.equal(urls.length, 2);
});
