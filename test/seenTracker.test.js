import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { SeenTracker } from '../src/utils/seenTracker.js';

test('SeenTracker persiste nuovi ID una sola volta e ricarica da disco', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'seen-test-'));
  const filePath = path.join(tmpDir, 'seen-chats.json');

  try {
    const tracker = new SeenTracker(filePath);
    await tracker.init();

    assert.equal(tracker.markIfNew(111222), true);
    assert.equal(tracker.markIfNew(111222), false);
    assert.equal(tracker.markIfNew(-100999888), true);
    await tracker.flush();

    const reloaded = new SeenTracker(filePath);
    await reloaded.init();
    assert.equal(reloaded.has(111222), true);
    assert.equal(reloaded.has(-100999888), true);
    assert.equal(reloaded.markIfNew(111222), false);
    assert.equal(reloaded.markIfNew(333444), true);
    await reloaded.flush();
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('SeenTracker gestisce file JSON corrotto senza bloccarsi', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'seen-corrupt-'));
  const filePath = path.join(tmpDir, 'seen-chats.json');

  try {
    await fs.writeFile(filePath, '{not-valid-json', 'utf8');
    const tracker = new SeenTracker(filePath);
    await tracker.init();
    assert.equal(tracker.markIfNew(555), true);
    await tracker.flush();
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});
