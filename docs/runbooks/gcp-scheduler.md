# GCP Cloud Tasks / Scheduler Runbook (F8-J5 Contract)

**Status:** F8-C0 Gate (Dry-run, emulated handlers, NO real jobs created).

## Overview
This package (`@lumenva/gcp-scheduler`) provides a contract and wrapper for handling Cloud Tasks and Cloud Scheduler invocations within the DeskcommCRM ecosystem securely and idempotently.
It establishes constraints for when real infrastructure is provisioned (in F8-H1).

## Handlers Contract & Behavior
1. **Authentication (Fail-Closed):**
   Every task invoker must include an authentication header (`authHeader`), resolving to a Secret Manager value or internal token. If the token is missing, invalid, or mismatched with the expected service identity, the handler **fails closed** immediately without processing the payload.
2. **Idempotency & Deduplication:**
   Each Cloud Task triggers with a unique `taskId`. The wrapper verifies against a persistent idempotency store (e.g. database table or Redis mock in tests) whether the task has already been processed. If yes, it acknowledges the task by returning success (`status: 'ok'`) without re-executing the handler to prevent duplicate effects.
3. **Execution & Failure (Dead Letter Queue):**
   Transient execution errors bubble up and result in a `fail` response, triggering Cloud Tasks' built-in retry mechanics. After max retries, the task will be pushed to the Dead Letter Queue (DLQ).

## Target Real GCP Configuration (F8-H1)
While no real jobs are created in F8-C0, the following target properties must be configured when the infrastructure is activated:

### Cloud Tasks
- **Queue Name:** `projects/{project}/locations/{region}/queues/{queue-name}`
- **Routing:** Must target internal endpoint (e.g., `/api/v1/internal/tasks/handler`).
- **OIDC/Service Account Identity:** Invoker must use the `scheduler/task invoker` identity documented in `F8-GCP-ONLY-TARGET-MATRIX.md`.
- **Dedupe:** Handled natively by GCP for identical task names up to the retention window. Handled functionally by the `taskId` logic described above.
- **Deadline:** Default 10 minutes (600s), adjustable per queue depending on task nature.
- **Retry / Backoff:**
  - Min backoff: `1s`
  - Max backoff: `3600s`
  - Max retries: configurable (e.g., 5-10 retries before DLQ).

### Cloud Scheduler
- **Job Name:** `projects/{project}/locations/{region}/jobs/{job-name}`
- **Schedule:** Standard cron expression.
- **Target:** Sends to the internal task handler queue to inherit retries and idempotency, OR directly invokes the handler via OIDC token.

## Local Emulation
For local development and tests, `createMockTaskContext` simulates incoming invocations. Use this to mock the context (`taskId`, `authHeader`, `idempotencyStore`) before calling `handleCloudTask`.

## Restrictions
- **No Direct Reads:** Do not read secrets directly in the task runner; rely on injection from the platform secrets module.
- **No Naked Execution:** Every endpoint receiving tasks must be wrapped in `handleCloudTask` to inherit the fail-closed auth and deduplication logic.
- **Tenancy:** If task payload carries `organization_id`, the handler is responsible for verifying RLS/RBAC tenant scoping via the handler logic.
