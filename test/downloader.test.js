import assert from 'node:assert/strict';
import test from 'node:test';
import { buildYtDlpArgs, DownloadError, downloadMedia } from '../src/utils/downloader.js';

test('buildYtDlpArgs genera flag validi senza opzioni non supportate', () => {
  const args = buildYtDlpArgs({
    url: 'https://vm.tiktok.com/ZGdX4yspx/',
    maxFileSizeMb: 48,
    outputTemplate: '/tmp/job/video.%(ext)s',
    cookiePath: '/tmp/job/cookies.txt',
  });

  assert.equal(args.includes('--proto'), false);
  assert.equal(args.includes('--ignore-config'), true);
  assert.equal(args[args.length - 2], '--');
  assert.equal(args[args.length - 1], 'https://vm.tiktok.com/ZGdX4yspx/');
  assert.equal(args.includes('--cookies'), true);
});

test('downloadMedia rifiuta protocolli diversi da http/https prima di invocare yt-dlp', async () => {
  await assert.rejects(
    downloadMedia({
      url: 'file:///etc/passwd',
      platform: 'tiktok',
      config: {
        dataDir: '/tmp',
        maxFileSizeMb: 48,
        maxFileSizeBytes: 48 * 1024 * 1024,
        downloadTimeoutMs: 5000,
        ytdlpPath: 'yt-dlp',
      },
    }),
    (err) => err instanceof DownloadError && err.code === 'UNKNOWN'
  );
});
