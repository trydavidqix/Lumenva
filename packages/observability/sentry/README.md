# @lumenva/observability-sentry

This package provides the Sentry observability adapter for the F7 architecture.
It ensures that secrets (e.g., authorization headers, tokens, passwords) and PII are redacted from events before sending them to Sentry.

## Usage

```typescript
import { scrubEvent } from '@lumenva/observability-sentry';
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  beforeSend(event) {
    return scrubEvent(event);
  }
});
```
