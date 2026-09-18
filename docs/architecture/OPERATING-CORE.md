# Operating Core — Source of Truth

Status: canonicalized on 2026-09-18.

## Boundaries

| Capability | Canonical owner | Authority |
|---|---|---|
| Durable job lifecycle | `apps/crm/lib/agent-engine/queue/queue.ts` | PostgreSQL `job_queue` |
| Domain event dispatch | `apps/crm/lib/event-log/dispatcher.ts` | PostgreSQL `event_log` |
| Event draining and retry | `apps/crm/lib/event-log/drain.ts` | `event_log.status`, attempts, and lease |
| Agent event to job bridge | `apps/crm/lib/agent-engine/edge/crm/drain.ts` | `ai_agent.dispatch_requested` → `job_queue` |
| Scheduled work | `apps/crm/lib/agent-engine/cron/scheduler.ts` | `cron_jobs` schedules; `job_queue` executes |
| Runtime process | `apps/crm/workers/agent-worker/main.ts` | one worker composition root |
| Application import boundary | `apps/crm/lib/operating-core/index.ts` | queue and event contracts |

## Rules

- `event_log` stores facts and dispatch state. It is not a second job queue.
- `job_queue` stores executable work and owns claim, lease, retry, completion, and dead-letter state.
- `cron_jobs` stores schedules only. A schedule always enqueues a `job_queue` job.
- Session locks, approvals, receipts, follow-up enrollments, and content jobs are supporting domain state. They do not replace the generic execution queue.
- PostgreSQL remains durable source of truth. Workers perform side effects after claim and must preserve tenant scope and idempotency.

## Superseded paths

`packages/operating-core` found on remediation branches is a provider-free in-memory prototype. It is not present on `origin/main`, is not production-wired, and is superseded by the production modules above. Do not reintroduce it as a parallel runtime.

Inngest, Vercel Workflow, and other runtime experiments remain adapters or benchmarks only. They are not production authority.
