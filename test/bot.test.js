import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createBot } from '../src/bot.js';
import { loadConfig } from '../src/config.js';
import { AsyncQueue } from '../src/utils/queue.js';
import { SeenTracker } from '../src/utils/seenTracker.js';

const TEST_BOT_INFO = {
  id: 999999,
  is_bot: true,
  first_name: 'TestBot',
  username: 'test_reels_bot',
  can_join_groups: true,
  can_read_all_group_messages: true,
  supports_inline_queries: false,
  can_connect_to_business: false,
  has_main_web_app: false,
};

function createTestBotWithConfig(overrides = {}, seenTracker = undefined) {
  const config = {
    botToken: '123456:TEST_TOKEN_VAL',
    allowedChatIds: new Set(),
    adminIds: new Set([42]),
    notifyOnError: true,
    dropPendingUpdates: false,
    maxFileSizeMb: 48,
    maxFileSizeBytes: 48 * 1024 * 1024,
    downloadTimeoutMs: 60_000,
    maxUrlsPerMessage: 3,
    maxQueueSize: 20,
    ytdlpPath: 'yt-dlp',
    dataDir: os.tmpdir(),
    ...overrides,
  };

  const queue = new AsyncQueue({ concurrency: 1, maxSize: config.maxQueueSize });
  const bot = createBot({ config, queue, seenTracker });
  bot.botInfo = TEST_BOT_INFO;

  const apiCalls = [];
  bot.api.config.use(async (_prev, method, payload) => {
    apiCalls.push({ method, payload });
    return {
      ok: true,
      result: {
        message_id: apiCalls.length,
        date: 1700000000,
        chat: { id: payload.chat_id, type: 'private' },
      },
    };
  });

  return { bot, apiCalls, queue };
}

test('loadConfig valida BOT_TOKEN e parsifica ADMIN_IDS e ALLOWED_CHAT_IDS', () => {
  const prevToken = process.env.BOT_TOKEN;
  const prevAllowed = process.env.ALLOWED_CHAT_IDS;
  const prevAdmin = process.env.ADMIN_IDS;

  try {
    process.env.BOT_TOKEN = '123456:TEST_TOKEN_VAL';
    process.env.ALLOWED_CHAT_IDS = '-1001234567890, 987654321';
    process.env.ADMIN_IDS = '42, 77';

    const config = loadConfig();
    assert.equal(config.botToken, '123456:TEST_TOKEN_VAL');
    assert.equal(config.allowedChatIds.has(-1001234567890), true);
    assert.equal(config.adminIds.has(42), true);
    assert.equal(config.adminIds.has(77), true);
  } finally {
    if (prevToken === undefined) delete process.env.BOT_TOKEN;
    else process.env.BOT_TOKEN = prevToken;

    if (prevAllowed === undefined) delete process.env.ALLOWED_CHAT_IDS;
    else process.env.ALLOWED_CHAT_IDS = prevAllowed;

    if (prevAdmin === undefined) delete process.env.ADMIN_IDS;
    else process.env.ADMIN_IDS = prevAdmin;
  }
});

test('/ping risponde solo agli ADMIN_IDS mentre /id funziona per tutti', async () => {
  const { bot, apiCalls } = createTestBotWithConfig();

  // Utente non admin prova /ping -> ignorato
  await bot.handleUpdate({
    update_id: 1,
    message: {
      message_id: 10,
      date: 1700000000,
      chat: { id: 100, type: 'private' },
      from: { id: 100, is_bot: false, first_name: 'Altro' },
      text: '/ping',
      entities: [{ type: 'bot_command', offset: 0, length: 5 }],
    },
  });
  assert.equal(apiCalls.length, 0);

  // Utente non admin usa /id -> risponde con User ID
  await bot.handleUpdate({
    update_id: 2,
    message: {
      message_id: 11,
      date: 1700000001,
      chat: { id: 100, type: 'private' },
      from: { id: 100, is_bot: false, first_name: 'Altro' },
      text: '/id',
      entities: [{ type: 'bot_command', offset: 0, length: 3 }],
    },
  });
  assert.equal(apiCalls.length, 1);
  assert.match(apiCalls[0].payload.text, /100/);

  // Admin usa /ping -> risponde con diagnostica
  await bot.handleUpdate({
    update_id: 3,
    message: {
      message_id: 12,
      date: 1700000002,
      chat: { id: 42, type: 'private' },
      from: { id: 42, is_bot: false, first_name: 'Admin' },
      text: '/ping',
      entities: [{ type: 'bot_command', offset: 0, length: 5 }],
    },
  });
  assert.equal(apiCalls.length, 2);
  assert.match(apiCalls[1].payload.text, /Pong!/);
});

test('notifica admin una sola volta per nuovo utente privato e nuovo gruppo', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'notifier-test-'));
  const tracker = new SeenTracker(path.join(tmpDir, 'seen-chats.json'));
  await tracker.init();

  try {
    const { bot, apiCalls } = createTestBotWithConfig({}, tracker);

    // 1. Nuovo utente in privato manda /start -> 1 notifica admin + 1 risposta /start
    await bot.handleUpdate({
      update_id: 10,
      message: {
        message_id: 20,
        date: 1700000010,
        chat: { id: 777, type: 'private' },
        from: { id: 777, is_bot: false, first_name: 'Luca', username: 'luca_test' },
        text: '/start',
        entities: [{ type: 'bot_command', offset: 0, length: 6 }],
      },
    });

    // 2. Lo stesso utente riscrive -> nessuna nuova notifica admin
    await bot.handleUpdate({
      update_id: 11,
      message: {
        message_id: 21,
        date: 1700000011,
        chat: { id: 777, type: 'private' },
        from: { id: 777, is_bot: false, first_name: 'Luca', username: 'luca_test' },
        text: 'ciao',
      },
    });

    // 3. Bot aggiunto a un nuovo gruppo via my_chat_member -> 1 notifica admin
    await bot.handleUpdate({
      update_id: 12,
      my_chat_member: {
        chat: { id: -100555, type: 'supergroup', title: 'Gruppo Amici' },
        from: { id: 777, is_bot: false, first_name: 'Luca', username: 'luca_test' },
        date: 1700000012,
        old_chat_member: { user: TEST_BOT_INFO, status: 'left' },
        new_chat_member: { user: TEST_BOT_INFO, status: 'member' },
      },
    });

    // 4. Utente nel gruppo manda un messaggio -> gruppo già visto, nessuna doppia notifica
    await bot.handleUpdate({
      update_id: 13,
      message: {
        message_id: 22,
        date: 1700000013,
        chat: { id: -100555, type: 'supergroup', title: 'Gruppo Amici' },
        from: { id: 888, is_bot: false, first_name: 'Marco' },
        text: 'ciao ragazzi',
      },
    });

    const adminMessages = apiCalls.filter((c) => c.method === 'sendMessage' && c.payload.chat_id === 42);
    assert.equal(adminMessages.length, 2);
    assert.match(adminMessages[0].payload.text, /Nuovo utente/);
    assert.match(adminMessages[0].payload.text, /luca_test/);
    assert.match(adminMessages[1].payload.text, /nuovo gruppo/i);
    assert.match(adminMessages[1].payload.text, /Gruppo Amici/);

    await tracker.flush();
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});
