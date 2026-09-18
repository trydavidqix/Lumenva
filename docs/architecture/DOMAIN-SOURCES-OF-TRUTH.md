# Lumenva — Domain Sources of Truth

Status: canonical map, consolidated 2026-09-18.

| Domain | Canonical code | Durable source of truth | Non-canonical paths |
|---|---|---|---|
| Agents | `apps/crm/lib/agent-engine/` + `apps/crm/workers/agent-worker/main.ts` | `ai_agents`, `ai_agent_versions`, `ai_agent_runs`, CRM tables | `lib/ai/runtime/agent.ts` is deprecated compatibility path for internal/dry-run execution |
| Jobs | `apps/crm/lib/agent-engine/queue/queue.ts` | PostgreSQL `job_queue` | No second generic scheduler/queue |
| Events | `apps/crm/lib/event-log/dispatcher.ts` + `drain.ts` | PostgreSQL `event_log` | Dedicated bridges are adapters, not another event store |
| Runtime | `apps/crm/workers/agent-worker/main.ts` | Worker leases and database state | Vercel/Inngest/Workflow experiments are not production authority |
| Memory | `apps/crm/lib/agent-engine/memory/`, `context/`, `graph/` | CRM/Postgres facts; Mem0 and Graphiti are derived projections | Markdown is project/operator memory, not customer memory |
| CRM | `apps/crm/app/api/v1/` + `apps/crm/lib/` domain modules | Supabase Postgres tables and RLS | UI state and provider caches are projections |
| Content OS | `apps/crm/lib/content-os/` + `apps/crm/workers/content-os-*` | Content tables, `creative_jobs`, and `event_log` | Content job state is domain-specific; it is not a second generic queue |
| Providers | `apps/crm/lib/agent-engine/edge/llm/providers/` and `lib/content-os/providers/` | Tenant configuration and provider job rows | Provider clients never own CRM truth |
| Integrations | `apps/crm/lib/waha/`, `lib/nuvemshop/`, `lib/channels/`, `lib/mcp/`, `lib/voice/` | CRM integration tables plus audit/event records | External systems are adapters and delivery endpoints |
| Operational state | queue/event/session/approval/receipt tables in `supabase/migrations/` | PostgreSQL with tenant filters, leases, idempotency, audit | In-memory state is cache or test double only |

## Rules

- New code imports the public Operating Core facade at `apps/crm/lib/operating-core/` for generic jobs and events.
- New agent product behavior belongs in `lib/agent-engine`; do not add features to deprecated `lib/ai/runtime/agent.ts`.
- Domain-specific job tables may model provider lifecycle, but execution side effects remain event-driven and idempotent.
- Every external provider write carries tenant scope, source identity, and retry/idempotency semantics.
- Product facts remain in Postgres. Memory, search, caches, and provider systems are rebuildable projections.
