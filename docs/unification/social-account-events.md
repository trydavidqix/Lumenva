# Social Account Events - Task 07 Status: BLOCKED_SCOPE

## Summary
Task 07 execution was partially finalized but remains `BLOCKED_SCOPE` due to structural integration constraints outside the allowlist.

The webhook integration securely maps the event's external identifiers to a tenant (`workspace_id`) by querying the `social_accounts` table directly from the route handler using the `ServiceRole` client. Events fail closed on absent or ambiguous mappings, returning `200 OK` for terminal invalid states and `500` for transient DB errors (allowing provider retries). Identifiers (tenant, account, event ID) are scrubbed from logs to prevent data leakage.

## Evidence & Blockers

1. **Cross-Package Import Restriction**:
   The `apps/social-web/app/api/webhooks/meta/route.ts` route handler needs to access the domain event ingester. However, cross-package relative imports (`../../../../...`) are strictly forbidden by `AGENTS.md`. To use it correctly, `createEventIngester` must be exported from `packages/core/social-brain/core/src/index.ts`, which falls outside the current Task 07 allowlist.

2. **Durable Idempotency and Enqueue Missing Contract**:
   The Task 07 plan explicitly requires deduplication by ID/provider/account, an enqueue mechanism, and a receipt. An in-memory Set inside the Next.js API route is insufficient because retries after a restart or across serverless instances will duplicate events. Since the allowlist forbids inventing unverified schemas or packages, and there is no existing public durable job/event contract accessible from the webhook route or `event-ingester` without expanding the allowlist, we cannot securely fulfill the enqueue/receipt criteria.

## Conclusion
To proceed securely, the following architectural adjustments are required from the Owner:
- Export `createEventIngester` in `packages/core/social-brain/core/src/index.ts`.
- Expose an existing, supported durable store/job contract (e.g., Redis idempotency cache, `cloud-tasks` publisher) to the webhook route or ingester to fulfill the deduplication and enqueue acceptance criteria.
