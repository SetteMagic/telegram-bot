import assert from 'node:assert/strict';
import test from 'node:test';
import { AsyncQueue, QueueFullError } from '../src/utils/queue.js';

test('AsyncQueue esegue task in ordine FIFO con concorrenza 1 e isola errori', async () => {
  const queue = new AsyncQueue({ concurrency: 1, maxSize: 5 });
  const events = [];

  const p1 = queue.enqueue(async () => {
    events.push('start-1');
    await new Promise((r) => setTimeout(r, 20));
    events.push('end-1');
    return 'ok-1';
  });

  const p2 = queue.enqueue(async () => {
    events.push('start-2');
    throw new Error('boom');
  });

  const p3 = queue.enqueue(async () => {
    events.push('start-3');
    return 'ok-3';
  });

  assert.equal(await p1, 'ok-1');
  await assert.rejects(p2, /boom/);
  assert.equal(await p3, 'ok-3');
  await queue.waitForIdle();

  assert.deepEqual(events, ['start-1', 'end-1', 'start-2', 'start-3']);
});

test('AsyncQueue rifiuta quando raggiunge maxSize', async () => {
  const queue = new AsyncQueue({ concurrency: 1, maxSize: 1 });
  let releaseFirst;

  const first = queue.enqueue(() => new Promise((resolve) => {
    releaseFirst = resolve;
  }));
  const second = queue.enqueue(async () => 'second');

  await assert.rejects(
    queue.enqueue(async () => 'overflow'),
    QueueFullError
  );

  releaseFirst('done');
  assert.equal(await first, 'done');
  assert.equal(await second, 'second');
});
