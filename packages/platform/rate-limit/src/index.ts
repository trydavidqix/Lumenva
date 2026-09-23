export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
  error?: Error;
}

export interface RateLimiterBackend {
  incrementAndGet(key: string, windowMs: number): Promise<{ count: number, ttl: number }>;
}

export { FakeRedisBackend } from './fake-redis';

export class SlidingWindowRateLimiter {
  constructor(
    private backend: RateLimiterBackend,
    private config: { windowMs: number, maxRequests: number, failClosed: boolean }
  ) {}

  async check(tenantId: string, route: string): Promise<RateLimitResult> {
    const key = `rate-limit:${tenantId}:${route}`;
    try {
      const { count, ttl } = await this.backend.incrementAndGet(key, this.config.windowMs);
      const remaining = Math.max(0, this.config.maxRequests - count);

      if (count > this.config.maxRequests) {
        return {
          allowed: false,
          remaining: 0,
          retryAfter: ttl
        };
      }

      return {
        allowed: true,
        remaining
      };
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));

      if (this.config.failClosed) {
        return {
          allowed: false,
          remaining: 0,
          error: err
        };
      }

      return {
        allowed: true,
        remaining: 0,
        error: err
      };
    }
  }
}
