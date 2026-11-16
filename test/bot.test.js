import assert from 'node:assert/strict';
import test from 'node:test';
import { createBot } from '../src/bot.js';
import { loadConfig } from '../src/config.js';
import { AsyncQueue } from '../src/utils/queue.js';

test('loadConfig valida BOT_TOKEN e createBot inizializza grammY senza errori', () => {
  const prevToken = process.env.BOT_TOKEN;
  const prevAllowed = process.env.ALLOWED_CHAT_IDS;

  try {
    process.env.BOT_TOKEN = '123456:TEST_TOKEN_VAL';
    process.env.ALLOWED_CHAT_IDS = '-1001234567890, 987654321';

    const config = loadConfig();
    assert.equal(config.botToken, '123456:TEST_TOKEN_VAL');
    assert.equal(config.allowedChatIds.has(-1001234567890), true);
    assert.equal(config.allowedChatIds.has(987654321), true);

    const queue = new AsyncQueue({ concurrency: 1, maxSize: config.maxQueueSize });
    const bot = createBot({ config, queue });
    assert.ok(bot);
  } finally {
    if (prevToken === undefined) delete process.env.BOT_TOKEN;
    else process.env.BOT_TOKEN = prevToken;

    if (prevAllowed === undefined) delete process.env.ALLOWED_CHAT_IDS;
    else process.env.ALLOWED_CHAT_IDS = prevAllowed;
  }
});
