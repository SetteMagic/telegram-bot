import fs from 'node:fs/promises';
import path from 'node:path';
import { logger } from './logger.js';

/**
 * Traccia in modo persistente i Chat ID già incontrati (gruppi e chat private)
 * mantenendo un Set in RAM e scrivendo su disco solo alla scoperta di nuovi ID.
 */
export class SeenTracker {
  constructor(filePath) {
    this.filePath = filePath;
    this.seenIds = new Set();
    this.writeChain = Promise.resolve();
  }

  async init() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.chatIds)) {
        for (const id of parsed.chatIds) {
          if (typeof id === 'number' && Number.isSafeInteger(id)) {
            this.seenIds.add(id);
          }
        }
      }
    } catch (err) {
      if (err?.code !== 'ENOENT') {
        logger.warn('Impossibile leggere seen-chats.json, riparto da elenco vuoto', {
          error: err?.message,
        });
      }
    }
  }

  has(chatId) {
    return this.seenIds.has(chatId);
  }

  /**
   * Segna il chatId come visto. Restituisce true solo se è la prima volta in assoluto.
   */
  markIfNew(chatId) {
    if (typeof chatId !== 'number' || !Number.isSafeInteger(chatId)) {
      return false;
    }

    if (this.seenIds.has(chatId)) {
      return false;
    }

    this.seenIds.add(chatId);
    this.#enqueuePersist();
    return true;
  }

  flush() {
    return this.writeChain;
  }

  #enqueuePersist() {
    this.writeChain = this.writeChain
      .then(async () => {
        await fs.mkdir(path.dirname(this.filePath), { recursive: true });
        const tmpPath = `${this.filePath}.tmp`;
        const payload = JSON.stringify({ chatIds: [...this.seenIds] });
        await fs.writeFile(tmpPath, payload, 'utf8');
        await fs.rename(tmpPath, this.filePath);
      })
      .catch((err) => {
        logger.warn('Errore salvataggio seen-chats.json', { error: err?.message });
      });
  }
}
