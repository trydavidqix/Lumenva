# @lumenva/platform-rate-limit

This package provides a rate limiting interface for the F7 architecture, compatible with both Upstash and standard Redis (Memorystore).

It supports:
- Sliding window
- TTL
- \`Retry-After\` header
- Fail-open/fail-closed behaviors

## Usage

```typescript
import { SlidingWindowRateLimiter, FakeRedisBackend } from '@lumenva/platform-rate-limit';

const backend = new FakeRedisBackend();
const limiter = new SlidingWindowRateLimiter(backend, {
  windowMs: 60000,
  maxRequests: 100,
  failClosed: true
});

const result = await limiter.check('tenant-id', '/api/route');
if (!result.allowed) {
  // Return 429 Too Many Requests with Retry-After: result.retryAfter
}
```
