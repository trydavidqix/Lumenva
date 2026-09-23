import { RateLimiterBackend } from './index';

interface StoreEntry {
  count: number;
  expiresAt: number;
}

export class FakeRedisBackend implements RateLimiterBackend {
  private store: Map<string, StoreEntry> = new Map();
  private simulateFail = false;

  public simulateFailure(fail: boolean) {
    this.simulateFail = fail;
  }

  async incrementAndGet(key: string, windowMs: number): Promise<{ count: number, ttl: number }> {
    if (this.simulateFail) {
      throw new Error('Redis backend failure');
    }

    const now = Date.now();
    let entry = this.store.get(key);

    if (!entry || entry.expiresAt <= now) {
      entry = { count: 0, expiresAt: now + windowMs };
    }

    entry.count += 1;
    this.store.set(key, entry);

    const ttl = Math.max(0, Math.ceil((entry.expiresAt - now) / 1000));
    return { count: entry.count, ttl };
  }
}
