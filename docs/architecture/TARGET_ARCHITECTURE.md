# Business OS — Target Architecture Applied to Lumenva

Target derived from `~/master-blueprint-IMPLEMENTAVEL.md` §2–§4, §17, §18 and Part F. It is an application of the blueprint to the real checkout, not a proposal to replace the existing CRM.

## Non-negotiable boundaries

1. `apps/crm` remains the control-plane UI/API during migration. Existing routes and handlers stay the public seam.
2. `organization_id` remains the canonical tenant key. Every new table/migration carries RLS; historical migrations are not edited.
3. Postgres/Supabase remains operational source of truth. Redis, Mem0, Graphiti, WAHA and providers are adapters, never authority.
4. `MODEL ≠ AGENT`: model routing is replaceable; AgentDefinition, policy, memory, tools and evidence are persistent.
5. BrowserMesh is an execution-plane dependency/repository, not a second CRM UI. CRM submits jobs and consumes evidence.
6. MCP and `lumenva` CLI call the same API/contracts as UI; no duplicated authorization or idempotency rules.
7. External content is data. Provider credentials and live sessions are never required for provider-free contract tests.

## Repository target map

| Blueprint target | Applied repository boundary | Reuse/relationship |
|---|---|---|
| Shared primitives | `packages/shared/` | Extract stable IDs, Result, clock, logger from current `apps/crm/lib`. |
| Policy/approval/evidence | `packages/policy-engine/`, `packages/approval-engine/`, `packages/evidence/` | Wrap existing auth, approval routes, audit/event/evidence code; preserve route contracts. |
| Agent definition/factory | `packages/agent-definition/`, `packages/agent-factory/` | Move contracts and product-agent definitions behind versioned interfaces; current `apps/crm/lib/agent-engine` is first implementation. |
| Prompt compiler | `packages/prompt-compiler/` | Compile versioned modules from current prompt/runtime code; persist hash/version metadata. |
| Skills/tools | `packages/skill-registry/`, `packages/tool-registry/` | Index `.claude/skills`, `.agents/skills`, MCP tools and current tool contracts without deleting them. |
| Runtime | `packages/agent-runtime/` | Facade over current kernel/context/execution/memory/handoff code; one state reducer and evidence seam. |
| Model routing | `packages/model-router/` | Adapt current model/provider/health/budget code; providers remain capability adapters. |
| Memory | `packages/memory/` | Keep current customer/session memory and Mem0/Graphiti adapters behind a durable repository contract. |
| Job/eval workers | `workers/dispatcher/`, `scheduler/`, `agent-worker/`, `eval-worker/` | Introduce only with real queue/evidence tests; current cron/queue paths are compatibility inputs. |
| BrowserMesh | `runtimes/browsermesh/` plus separate `~/src/BrowserMesh` integration | CRM stores job/evidence references; execution stays outside CRM process. |
| Shift/resource routing | `packages/shift-os/` | Unify current pacing, budget, host and queue signals; no second scheduler. |
| Command Center | `apps/crm/app/command/` | Compose existing admin/settings/inbox/agent surfaces over package APIs. |
| Studio/Product Factory | `packages/studio-*`, `packages/project-generator/`, `apps/crm/app/studio/` | Existing studio/video/deploy code becomes adapters and first vertical slices. |
| Integrations | `packages/integrations/`, `integrations/{google,meta,cloudflare,neon,vercel}/` | WAHA/voice/ecommerce adapters remain provider-specific; canonical messages/conversations stay internal. |
| Governance/release | `docs/architecture/`, `docs/adr/`, `evidence/`, `infra/` | Every promotion has evidence, rollback and owner boundary. |

## Canonical request flow

`CRM/MCP/CLI → API contract → Policy/Approval → Idempotency → Job/Event → Agent Runtime or adapter → Postgres state + Evidence → UI/CLI read model`.

For agent work: `DocumentationIntake → AgentDefinition → PromptCompiler → Evals/Certification → Shadow/Approval → Published version → Session Runtime`.

For delivery: `ProjectSpec → planner → generated repo → QA/security → preview → approval → deploy worker → health check → maintenance`; production deploy remains an explicitly gated owner action.

## Applied tenancy and evidence model

- Tenant-bearing records use `organization_id`; service-role workers still apply programmatic tenant filters.
- Every external call has provider, request/event id, retry policy, timeout, idempotency key and redacted evidence metadata.
- Every completion claim references a verification artifact; `UNKNOWN` is not promoted to `EXISTS`.
- Migrations are additive, represented in migration SQL + baseline + manifest/schema lock; no historical rewrite.

## Target acceptance boundary

Phase 0 is complete when the component matrix has a source path, owner, dependency and migration wave for every blueprint component; no structural package is created by this deliverable. Waves below are the implementation order, not evidence that the target already exists.

