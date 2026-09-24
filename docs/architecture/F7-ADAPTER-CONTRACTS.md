# F7 Adapter Contracts Matrix

This document outlines the proven contracts and current implementation gaps across all external adapters verified in `tests/invariants/f7-adapter-matrix.test.ts`.

## Proven Contracts

- **Stripe**:
  - `handles provider offline / timeout safely` - The Stripe SDK automatically handles retries for transient issues. The adapter translates `Timeout` and other errors into a standard `Stripe API Error`.
  - `handles idempotency correctly` - Passes `idempotencyKey` down to Stripe SDK mutations (e.g., `createCheckoutSession`).

- **Nuvemshop**:
  - `handles timeout/retry` - Native integration explicitly performs retries over transient 429/500 errors with backoff logic.
  - `prevents SSRF for webhook URLs` - `create_webhook` rejects localhost and requires `https`.

- **Resend**:
  - `handles idempotency and rate limiting` - Translates `RateLimitError` into `rate_limited` code. Adds `Idempotency-Key` headers natively if `ctx.idempotencyKey` is provided.

- **Rate-Limit**:
  - `fails closed or open based on config` - Honors `failClosed` safely wrapping errors from the Redis backend.

- **Sentry**:
  - `scrubs PII` - `scrubEvent` efficiently removes `authorization` and `cookie` information from event payloads.

## Known Gaps

These are known issues tracked as `it.todo` or `it.skip` where the implementations currently deviate from the ideal F7 architecture constraints:

- `gap_meta_adapter_missing_webhook_replay_protection`:
  - **Severity:** Medium
  - **Description:** Meta adapter handles verify webhook, but replay protection/idempotency of inbound webhooks isn't strictly documented/handled inside the adapter interface itself.

- `gap_waha_adapter_missing_retry_config`:
  - **Severity:** Low
  - **Description:** WAHA adapter (`wahaAdapter`) forwards calls to `lib/waha/client` which lacks configurable retry delays at the adapter boundaries.

## Summary

- Proven contracts: 7
- Gaps: 2
