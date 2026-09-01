# Existing Architecture Inventory → Agent OS Mapping

This inventory prevents the Agent OS work from duplicating functionality that already exists in Deskcomm.

## Existing runtime and orchestration

- `lib/agent-engine/` → existing product agent runtime foundation. **Evolve; do not replace.**
- `workers/agent-worker/main.ts` → existing asynchronous agent execution worker.
- `event_log` → canonical business-event history.
- `job_queue` → existing asynchronous work queue; initial implementation behind future `ExecutionPort`.
- `lib/ai/runtime/agent.ts` → existing AI agent runtime path and budget/step behavior; must be reconciled with canonical loop contracts rather than shadowed.

## Existing agent control-plane data

Existing schema/types/specs already include concepts for:

- `ai_agents`;
- `ai_agent_versions`;
- `ai_agent_runs`;
- AI invocations;
- model/provider/pricing data;
- budgets;
- routers/router decisions.

**Decision:** Phase 1 extends these structures only when a concrete missing invariant is proven. No parallel `agent_os_*` table family.

## Existing Skills

- `lib/ai/skills/db.ts` → runtime/product skill persistence/access path.
- `skill_versions`, `skill_pointers`, `skill_activations` → existing version/pointer/activation primitives.
- `.claude/skills/` and `.agents/skills/` → engineering-agent skills, separate from runtime CRM skills.

**Decision:** Product Skill OS is built on the existing runtime skill schema. Repo engineering skills remain governed by repo doctrine.

## Existing Tools and MCP

- `lib/mcp/tools/**` → existing CRM capabilities exposed through MCP/tool paths.
- MCP lead tools already received cross-tenant hardening in the 2026-08 security sweep.
- Current tool catalog/types are candidates for canonical Tool Registry metadata rather than replacement.

**Decision:** MCP becomes an adapter into the Tool/Policy Gateway; it never becomes a policy bypass.

## Existing memory/knowledge/graph

- `lib/agent-engine/memory/**` and memory workers → existing memory projections/lifecycle.
- `lib/agent-engine/graph/**` and graph workers → existing relationship/temporal projection infrastructure.
- knowledge/RAG/pgvector paths → authoritative published knowledge retrieval layer.

**Decision:** preserve current projection architecture. Postgres/CRM remains source of truth; memory/graph are derived.

## Existing guardrails and evaluation

- `lib/agent-engine/guardrails/**` → existing runtime safety checks.
- flywheel/judge scripts/tables/evidence → existing evaluation/improvement foundation.
- existing AI agent test routes and E2E tests → baseline sources for Phase 1.6 golden cases.

**Decision:** canonical Policy Engine and Loop Guards should absorb/reuse existing guardrails where semantics match, not create a second safety stack.

## Existing n8n/integration boundary

Phase 6 AI-platform work already established signed webhooks, HMAC, anti-SSRF, idempotency, tenant isolation and MCP scopes. `n8n` remains an integration layer rather than source of truth/orchestrator core.

## Security work already merged before Agent OS Phase 1

The August 2026 security sweep already addressed important agent-facing gaps, including:

- cross-tenant MCP lead IDORs;
- AI provider credential/budget RLS role checks;
- duplicate-send idempotency on outbound message paths;
- rate limiting on AI-cost routes;
- RAG claim/race hardening;
- router cross-tenant validation.

**Decision:** Plan 1.2 must re-run current security/advisor evidence and only fix remaining gaps. Do not re-implement historical fixes.

## Canonical mapping summary

```text
Existing Deskcomm                       Agent OS concept
---------------------------------------------------------------
lib/agent-engine                        Agent Kernel/runtime base
lib/ai/runtime/agent.ts                 current inner-loop/runtime behavior
event_log                               Event Bus/business facts
job_queue + workers                     initial ExecutionPort adapter
ai_agents / versions / runs             Agent Registry + Run records
ai_models/pricing/routers                Model Registry + Model Router
lib/ai/skills + skill_* tables           Product Skill Registry
lib/mcp/tools                            Tool Registry implementation source
guardrails                               Loop/Policy safety candidates
memory + graph workers                  Memory/Graph projections
flywheel/judge/evals                     Evaluation + Learning foundation
n8n integration                         external integration adapter
CLAUDE/AGENTS/.claude/.agents/loop       Engineering Agent OS foundation
```

## Explicit non-goal

No Phase 1 task may introduce a second database/control plane, duplicate agent runtime, duplicate memory source of truth or framework-owned CRM state.
