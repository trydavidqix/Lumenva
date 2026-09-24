import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FakeRedisBackend, SlidingWindowRateLimiter } from '../src/index';

describe('Sliding Window Rate Limiter with Fake Redis', () => {
  let backend: FakeRedisBackend;
  let limiter: SlidingWindowRateLimiter;

  beforeEach(() => {
    backend = new FakeRedisBackend();
    limiter = new SlidingWindowRateLimiter(backend, {
      windowMs: 60000,
      maxRequests: 3,
      failClosed: true
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.skip('gap_rate_limit_should_allow_requests_within_limit', async () => {
    const res1 = await limiter.check('test_tenant', 'api_route');
    expect(res1.allowed).toBe(true);
    expect(res1.remaining).toBe(2);

    const res2 = await limiter.check('test_tenant', 'api_route');
    expect(res2.allowed).toBe(true);
    expect(res2.remaining).toBe(1);

    const res3 = await limiter.check('test_tenant', 'api_route');
    expect(res3.allowed).toBe(true);
    expect(res3.remaining).toBe(0);
  });

  it('should block requests over limit and return retryAfter', async () => {
    await limiter.check('tenant', 'route');
    await limiter.check('tenant', 'route');
    await limiter.check('tenant', 'route');

    const blocked = await limiter.check('tenant', 'route');
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfter).toBeGreaterThan(0);
    expect(blocked.retryAfter).toBeLessThanOrEqual(60);
  });

  it.skip('gap_rate_limit_sliding_window_passes', async () => {
    await limiter.check('tenant', 'route');
    await limiter.check('tenant', 'route');
    await limiter.check('tenant', 'route');

    const blocked = await limiter.check('tenant', 'route');
    expect(blocked.allowed).toBe(false);

    vi.advanceTimersByTime(61000);

    const allowed = await limiter.check('tenant', 'route');
    expect(allowed.allowed).toBe(true);
    expect(allowed.remaining).toBe(2);
  });

  it('fail-open should allow requests when backend fails', async () => {
    backend.simulateFailure(true);

    const failOpenLimiter = new SlidingWindowRateLimiter(backend, {
      windowMs: 60000,
      maxRequests: 3,
      failClosed: false
    });

    const res = await failOpenLimiter.check('tenant', 'route');
    expect(res.allowed).toBe(true);
    expect(res.error).toBeDefined();
  });

  it('fail-closed should block requests when backend fails', async () => {
    backend.simulateFailure(true);

    const res = await limiter.check('tenant', 'route');
    expect(res.allowed).toBe(false);
    expect(res.error).toBeDefined();
  });
});
