export class QueueFullError extends Error {
  constructor(maxSize) {
    super(`Coda download piena (limite: ${maxSize})`);
    this.name = 'QueueFullError';
  }
}

/**
 * Coda asincrona FIFO a concorrenza limitata per prevenire picchi di RAM e I/O su HDD.
 */
export class AsyncQueue {
  constructor({ concurrency = 1, maxSize = 20 } = {}) {
    this.concurrency = concurrency;
    this.maxSize = maxSize;
    this.pending = [];
    this.activeCount = 0;
    this.idleResolvers = [];
  }

  get size() {
    return this.pending.length;
  }

  enqueue(task) {
    if (this.pending.length >= this.maxSize) {
      return Promise.reject(new QueueFullError(this.maxSize));
    }

    return new Promise((resolve, reject) => {
      this.pending.push({ task, resolve, reject });
      this.#drain();
    });
  }

  clearPending(reason = 'Coda svuotata durante lo spegnimento') {
    const dropped = this.pending.splice(0, this.pending.length);
    for (const item of dropped) {
      item.reject(new Error(reason));
    }
    this.#notifyIfIdle();
  }

  waitForIdle() {
    if (this.activeCount === 0 && this.pending.length === 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.idleResolvers.push(resolve);
    });
  }

  #drain() {
    while (this.activeCount < this.concurrency && this.pending.length > 0) {
      const next = this.pending.shift();
      this.activeCount += 1;

      Promise.resolve()
        .then(() => next.task())
        .then(next.resolve, next.reject)
        .finally(() => {
          this.activeCount -= 1;
          this.#drain();
          this.#notifyIfIdle();
        });
    }
  }

  #notifyIfIdle() {
    if (this.activeCount === 0 && this.pending.length === 0) {
      const resolvers = this.idleResolvers.splice(0, this.idleResolvers.length);
      for (const resolve of resolvers) {
        resolve();
      }
    }
  }
}
