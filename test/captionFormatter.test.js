import assert from 'node:assert/strict';
import test from 'node:test';
import { escapeHtml, formatVideoCaption } from '../src/utils/captionFormatter.js';

test('escapeHtml protegge caratteri HTML e virgolette', () => {
  assert.equal(
    escapeHtml('Cats <3 Dogs & "Birds" > All'),
    'Cats &lt;3 Dogs &amp; &quot;Birds&quot; &gt; All'
  );
});

test('formatVideoCaption include autore, descrizione e link con escape HTML', () => {
  const caption = formatVideoCaption(
    {
      creator: 'Mario <Dev>',
      channel: 'mariodev',
      uploader_url: 'https://www.tiktok.com/@mariodev',
      description: 'Test & demo #reel',
    },
    'https://www.tiktok.com/@mariodev/video/123'
  );

  assert.match(caption, /👤 <a href="https:\/\/www\.tiktok\.com\/@mariodev"><b>Mario &lt;Dev&gt; \(@mariodev\)<\/b><\/a>/);
  assert.match(caption, /Test &amp; demo #reel/);
  assert.match(caption, /🔗 <a href="https:\/\/www\.tiktok\.com\/@mariodev\/video\/123">Link originale<\/a>/);
});

test('formatVideoCaption non duplica handle se uguale a uploader e gestisce descrizione assente', () => {
  const caption = formatVideoCaption(
    {
      uploader: 'acme_official',
      channel: 'acme_official',
      title: 'Video by acme_official',
    },
    'https://www.instagram.com/reel/XYZ/'
  );

  assert.equal(
    caption,
    '👤 <b>@acme_official</b>\n\n🔗 <a href="https://www.instagram.com/reel/XYZ/">Link originale</a>'
  );
});

test('formatVideoCaption tronca descrizioni molto lunghe restando sotto 1024 caratteri renderizzati', () => {
  const longDesc = 'parola '.repeat(300);
  const caption = formatVideoCaption(
    { uploader: 'Creator', description: longDesc },
    'https://www.instagram.com/reel/XYZ/'
  );

  const plainRendered = caption.replace(/<[^>]+>/g, '');
  assert.ok(plainRendered.length <= 1024, `Lunghezza eccessiva: ${plainRendered.length}`);
  assert.ok(plainRendered.endsWith('Link originale'));
  assert.ok(caption.includes('…'));
});
