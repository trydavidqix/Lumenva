# IMPROVE-2 — ORCHESTRATION PLANE (implementable detail)

Companion to `master-blueprint-full.md`. Scope: sections 4.14–4.21, 4.41–4.50, 4.56–4.61, 7, 8.2, 8.5, 12.5, 13, 14.
This document does NOT re-judge the blueprint. It turns every named component into: real SQL DDL, real TypeScript
contracts, real algorithms, failure branches, sequencing and engineer-day estimates. Every gap is closed with a
decision, not a "consider".

---

## 0. GROUND RULES THIS DOCUMENT COMMITS TO

**0.1 Reuse, do not rebuild.**
- The existing `event_log` table (append-only) is THE event substrate. We add columns, we add a partition strategy,
  we do NOT introduce Kafka/NATS/a second bus. (§8.5 detail below.)
- The existing `workers/` pool + `workers/scheduler` + `workers/dispatcher` are THE execution substrate for jobs.
  Job Engine is a schema + a claim protocol layered on top, not a new daemon.
- Supabase Postgres is the only stateful store. No Redis. Leases, quotas, circuit state, locks all live in Postgres
  rows with `FOR UPDATE SKIP LOCKED` claim semantics. At our scale (<50 agents, <5k jobs/day) this is correct and
  removes an availability dependency.

**0.2 Tenancy.** `organization_id uuid NOT NULL` on every table below. Canonical tenant. RLS on every table.
Two access modes:
- **User/API mode:** RLS restricts to the caller's org via JWT claim.
- **Worker/service mode:** connects with a role that has `BYPASSRLS`-equivalent via a SECURITY DEFINER RPC layer,
  and MUST set `SET LOCAL app.org_id = '<uuid>'` at the start of every transaction so triggers/audit still record org.

Shared helper (in `supabase/policies/00_helpers.sql`):

```sql
create schema if not exists app;

-- Resolve the caller's org: prefer explicit GUC (workers), fall back to JWT claim (users).
create or replace function app.current_org_id() returns uuid
language sql stable as $$
  select coalesce(
    nullif(current_setting('app.org_id', true), '')::uuid,
    nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'organization_id', '')::uuid
  )
$$;

-- Standard RLS predicate, applied verbatim to every table in this doc.
-- create policy org_isolation on <table>
--   using (organization_id = app.current_org_id())
--   with check (organization_id = app.current_org_id());

-- Service role (workers) additionally gets:
-- create policy service_full on <table> to service_role using (true) with check (true);
```

Every `create table` below is followed by `enable row level security` + the two policies. To keep this document
readable the policy block is written once as `RLS(<table>)` and expands to:

```sql
alter table <table> enable row level security;
create policy org_isolation on <table>
  using (organization_id = app.current_org_id())
  with check (organization_id = app.current_org_id());
create policy service_full on <table> to service_role using (true) with check (true);
```

**0.3 IDs & time.** PK = `uuid default gen_random_uuid()` unless a natural key is stronger. All timestamps
`timestamptz`, default `now()`, stored UTC. Money/cost in `numeric(12,6)` EUR. Durations in `integer` milliseconds
unless suffixed `_s` (seconds).

**0.4 Migrations.** One migration file per module in `supabase/migrations/`, prefixed `NNNN_orch_<module>.sql`.
Applied migrations are forward-only (ADR-023). Every module ships: DDL + RLS + seed + a `supabase/tests/<module>.sql`
pgTAP file asserting RLS isolation and the state machine's illegal transitions.

**0.5 Package layout.** All orchestration code lands under `packages/` per §16 of the blueprint:
`packages/agent-runtime/` (loop, planner, verification, evidence, handoff), `packages/model-router/`
(providers, registry, routing, scoring, quota, drain, health, circuit-breaker), `packages/policy-engine/`,
`packages/approval-engine/`, `packages/shift-os/` (shift scheduler, resource router). Workers that drive them live
in `workers/`.

---

## A. EXECUTION LOOP / PLANNER / PARALLEL DAG (blueprint 4.14–4.16)

### A.1 Canonical loop — state machine

The loop is a deterministic reducer around a probabilistic step. Runtime owns everything except the ACT decision.

```
                 ┌────────────────────────────────────────────────┐
                 v                                                │
 [UNDERSTAND] → [RETRIEVE] → [PLAN] → [ACT] → [OBSERVE] → [VERIFY] → [UPDATE_STATE]
                                       │                              │
                                       │ (tool/model error)           ├─→ CONTINUE (loop)
                                       v                              ├─→ FINISH  (completion conditions met + verified)
                                  [RECOVER]                           └─→ BLOCKED (needs approval / needs human / dependency)
```

**Loop invariants (runtime-enforced, code not prompt):**
| Invariant | Enforcement |
|---|---|
| Max iterations per run | `run.budget.max_iterations` (default 12 for engineering, 6 for conversational). Hard stop → status `PARTIAL`. |
| Wall-clock budget | `run.budget.deadline_at`. Checked before every ACT. Exceeded → checkpoint + `PARTIAL`. |
| Token budget | `run.budget.max_tokens`. Context Budget Manager refuses to compile a turn that would exceed it; triggers compaction first. |
| No two ACTs without an OBSERVE between them | Reducer rejects a second `tool_calls[]` batch if prior batch has unresolved `tool_call_id`s. |
| State written only by StateReducer | LLM output is validated → guardrails → reducer. Direct `UPDATE agent_sessions` from agent code is a lint failure + runtime assertion. |
| Idempotent re-entry | Every iteration re-reads `state_version`; a mismatch (concurrent writer) forces a re-RETRIEVE, never a blind ACT. |

**Per-step module + DB I/O + failure branch:**

| Step | Module | Reads | Writes | Failure branch |
|---|---|---|---|---|
| UNDERSTAND | `agent-runtime/runtime/interpret.ts` | `agent_sessions`, last N `event_log` | — | Ambiguous intent + no clarifying budget → `BLOCKED(reason=needs_user)` |
| RETRIEVE | Context Engine + Memory Gate (read) | `customer_memories`, `agent_skill_bindings`, `tool_registry` | — | Retrieval store down → proceed with `degraded_context=true` flag on turn; VERIFY depth forced to max |
| PLAN | Planner (A.2) | plan cache | `execution_plans` row (or reuse) | Planner returns invalid schema → 1 bounded repair; then `BLOCKED(reason=planner_failure)` |
| ACT | Model Router + Tool Runtime | routing inputs | `routing_decisions`, `tool_calls` (status `requested`) | Provider 429/5xx → `RECOVER` (see §14 runbooks) |
| OBSERVE | Tool Runtime | `tool_calls` (status `completed`) | `tool_calls.result_*`, `event_log` | Tool timeout → retry matrix (4.53); side-effecting tool → only retry with idempotency proof |
| VERIFY | Verification Engine (B.1) | verification policy | `evidence` rows | Verification fails → `CONTINUE` with a repair sub-goal, max 2; then `FAILED` |
| UPDATE_STATE | StateReducer | — | `agent_sessions` (`state_version++`), `session_snapshots`, `event_log` | Reducer rejects (business rule) → discard turn, emit `state.rejected`, `CONTINUE` |

### A.2 Planner

Two paths. **Fast path** when: single required capability, no R2+ action, no fan-out, context < 50% budget →
skip structured plan, synthesize a 1-step plan inline. **Structured path** otherwise.

```typescript
// packages/agent-runtime/planner/types.ts

export type PlanStepKind = "tool" | "model" | "subagent" | "verify" | "wait" | "approval";

export interface PlanStep {
  id: string;                          // stable within plan, e.g. "s1"
  kind: PlanStepKind;
  description: string;
  dependsOn: string[];                 // ids of steps that must be COMPLETE first
  capability?: string;                 // capability tag → resolved to a tool at ACT time
  toolName?: string;                   // if pre-bound
  skillIds?: string[];
  riskLevel: RiskLevel;                // R0..R4, see §12.5
  idempotencyKeyTemplate?: string;     // e.g. "calendar.book:{{contact_id}}:{{slot_iso}}"
  verification: VerificationSpec;      // how OBSERVE→VERIFY proves this step
  completionConditions: string[];      // human-readable, each must map to an EvidenceItem
  estimatedTokens?: number;
  estimatedMs?: number;
  maxRetries: number;                  // default per riskLevel: R0..R1=2, R2=1, R3..R4=0
}

export interface ExecutionPlan {
  id: string;
  organizationId: string;
  sessionId: string;
  runId: string;
  agentId: string;
  goal: string;
  createdAt: string;
  planVersion: number;                 // bumps on every re-plan within a run
  strategy: "fast" | "structured";
  steps: PlanStep[];
  dag: { nodes: string[]; edges: Array<[string, string]> }; // derived, persisted for observability
  risks: Array<{ description: string; mitigation: string; severity: "low" | "med" | "high" }>;
  completionConditions: string[];      // plan-level; superset union of step conditions + goal check
  fallbackPlanId?: string;             // pre-computed degraded plan (fewer tools / more asking)
  status: "draft" | "active" | "superseded" | "done" | "abandoned";
}

export interface VerificationSpec {
  method:
    | "tests" | "lint" | "typecheck"           // code
    | "http_status" | "response_schema" | "behavior_probe"  // API
    | "db_assertion"                            // database
    | "file_exists" | "file_diff"              // file
    | "health_check"                            // deploy
    | "source_validation"                       // research
    | "e2e" | "visual" | "a11y"                // UI
    | "manual_human";                           // last resort, creates an approval
  target?: string;                              // path, url, query, selector
  expect?: unknown;                             // matcher payload
  depthOverride?: "shallow" | "standard" | "deep"; // else derived from riskLevel
}
```

**Planner algorithm (structured path):**

1. Decompose goal → candidate steps via model call (Reasoning Policy = STANDARD, or DEEP if goal tagged
   `architecture|migration|multi-service`).
2. **Static validation (code, not model):** every `dependsOn` id exists; DAG is acyclic (Kahn's algorithm); every
   R2+ step has an `idempotencyKeyTemplate`; every step has ≥1 `completionConditions`; no step both `wait` and has
   dependents that aren't `wait`/`approval`.
3. **Risk roll-up:** `plan.maxRisk = max(step.riskLevel)`. If `>= R2` → Planner attaches an `approval` step as a
   dependency gate before the first R2+ step (Approval Engine, §D).
4. **Fallback synthesis:** clone plan, downgrade every `tool` step whose `riskLevel >= R2` to either a `wait`
   (ask user) or a read-only alternative capability. Persist as `fallbackPlanId`.
5. Persist `execution_plans` + `execution_plan_steps`. Emit `plan.created`.
6. Re-plan trigger: any step `FAILED` after retries, OR VERIFY of a step invalidates an assumption listed in
   `plan.risks`, OR `state_version` conflict on 2 consecutive iterations. Re-plan bumps `planVersion`, marks old
   row `superseded`, keeps `runId` stable.

```sql
-- 0002_orch_planner.sql
create table execution_plans (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  session_id        uuid not null,
  run_id            uuid not null,
  agent_id          uuid not null,
  goal              text not null,
  plan_version      integer not null default 1,
  strategy          text not null check (strategy in ('fast','structured')),
  max_risk          text not null default 'R0' check (max_risk in ('R0','R1','R2','R3','R4')),
  status            text not null default 'draft'
                    check (status in ('draft','active','superseded','done','abandoned')),
  dag               jsonb not null default '{"nodes":[],"edges":[]}'::jsonb,
  risks             jsonb not null default '[]'::jsonb,
  completion_conditions jsonb not null default '[]'::jsonb,
  fallback_plan_id  uuid references execution_plans(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index on execution_plans (organization_id, run_id, plan_version desc);
create index on execution_plans (organization_id, session_id, status);
-- RLS(execution_plans)

create table execution_plan_steps (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  plan_id           uuid not null references execution_plans(id) on delete cascade,
  step_key          text not null,                 -- "s1"
  kind              text not null check (kind in ('tool','model','subagent','verify','wait','approval')),
  description       text not null,
  depends_on        text[] not null default '{}',
  capability        text,
  tool_name         text,
  skill_ids         text[] not null default '{}',
  risk_level        text not null default 'R0' check (risk_level in ('R0','R1','R2','R3','R4')),
  idempotency_key_template text,
  verification      jsonb not null,
  completion_conditions jsonb not null default '[]'::jsonb,
  estimated_tokens  integer,
  estimated_ms      integer,
  max_retries       integer not null default 2,
  retry_count       integer not null default 0,
  status            text not null default 'pending'
                    check (status in ('pending','ready','running','blocked','complete','failed','skipped')),
  started_at        timestamptz,
  finished_at       timestamptz,
  unique (plan_id, step_key)
);
create index on execution_plan_steps (organization_id, plan_id, status);
-- RLS(execution_plan_steps)
```

### A.3 Parallel execution / DAG (4.16)

**Rule: parallelize only real independence, never apparent speed.** A fan-out group is admissible iff, for the
candidate steps: (a) pairwise no `dependsOn` relation, (b) pairwise disjoint write-sets (write-set = set of
`idempotency_key_template` roots + tables the tool mutates, declared in `tool_registry.side_effects`), (c) combined
projected token cost ≤ remaining budget, (d) all steps `riskLevel <= R1` OR each R2+ step already has its approval
granted.

**Executor:** a topological scheduler over `execution_plan_steps`.

```typescript
// packages/agent-runtime/runtime/dag-executor.ts (shape)
async function runPlan(plan: ExecutionPlan, ctx: RunContext) {
  const steps = indexBy(plan.steps, s => s.id);
  const done = new Set<string>(), failed = new Set<string>();
  while (done.size + failed.size < plan.steps.length) {
    const ready = plan.steps.filter(s =>
      s.status === "pending" &&
      s.dependsOn.every(d => done.has(d)));
    if (ready.length === 0) {
      if (inFlight() === 0) return finalize(plan, done, failed); // deadlock or all-blocked → BLOCKED/PARTIAL
      await awaitAnyInFlight();
      continue;
    }
    const group = admissibleFanout(ready, ctx.budget); // §A.3 rule; may be size 1
    await Promise.all(group.map(s => execStep(s, ctx)
      .then(() => done.add(s.id))
      .catch(() => { failed.add(s.id); maybeReplan(plan, s, ctx); })));
  }
}
```

`inFlight`/`awaitAnyInFlight` are backed by `execution_plan_steps.status='running'` rows with a lease
(`started_at` + `estimated_ms * 3` timeout). Concurrency ceiling for a single run = `min(3, budget.parallelism)`;
the Concurrency Governor (§E.3) can lower it globally under load.

**Join semantics:** a step depending on a fan-out group starts only when ALL group members are `complete`. If any
member is `failed` and not recoverable, the join step is `blocked`, the run re-plans or degrades to `fallbackPlanId`.

---

## B. VERIFICATION / EVIDENCE / COMMUNICATION / SUBAGENTS / HANDOFF (4.17–4.21)

### B.1 Verification Engine (4.17)

Verification is a policy table keyed on operation class, resolved at plan time and re-checked at VERIFY.

| Operation class | Default method(s) | Shallow (R0–R1) | Standard (R2) | Deep (R3–R4) |
|---|---|---|---|---|
| code change | typecheck, lint, unit | typecheck + changed-file lint | + full lint + affected unit tests | + integration + `db` + regression subset on Hetzner CX53 runner |
| API call (read) | http_status | 2xx + non-empty | + response_schema | + behavior_probe (round-trip read-back) |
| API call (write) | http_status + read-back | n/a (write is ≥R1) | status + `db_assertion` read-back of the mutation | + behavior_probe + idempotency-record check |
| database write | db_assertion | affected row count matches | + constraint/RLS check query | + cross-tenant isolation probe |
| file write | file_exists + file_diff | exists | + diff matches intent hash | + content lint/parse |
| deploy | health_check | `/healthz` 200 | + smoke E2E | + rollback dry-run verified |
| research/answer | source_validation | ≥1 named source resolvable | + 2 independent sources agree | + primary/official source cited |
| UI change | e2e/visual/a11y | build passes | + Playwright happy path | + visual diff + axe a11y pass |

Depth is `max(riskDerived, verification.depthOverride)`. A failed VERIFY produces an `EvidenceItem` with
`result="fail"` and spawns at most 2 repair sub-goals; exhausting them sets step `failed`.

```typescript
// packages/agent-runtime/verification/types.ts
export type VerificationDepth = "shallow" | "standard" | "deep";
export interface VerificationRun {
  id: string;
  stepId: string;
  method: VerificationSpec["method"];
  depth: VerificationDepth;
  command?: string;              // e.g. "pnpm -w typecheck --filter @crm/...”
  startedAt: string; finishedAt?: string;
  result: "pass" | "fail" | "error" | "skipped";
  detail: string;               // captured stdout tail / assertion message (secret-scrubbed)
  evidenceIds: string[];
}
```

### B.2 Evidence Engine (4.18)

```typescript
// packages/agent-runtime/evidence/types.ts
export type EvidenceKind =
  | "tool_result" | "verification" | "artifact" | "external_source"
  | "db_snapshot" | "screenshot" | "log_excerpt" | "approval_record";

export interface EvidenceItem {
  id: string;
  organizationId: string;
  runId: string;
  sessionId: string;
  stepId?: string;
  claim: string;                         // "calendar slot 14:30 booked for contact X"
  kind: EvidenceKind;
  source: string;                        // tool name / url / query / file path
  toolCallId?: string;
  artifactUri?: string;                  // storage:// or repo path or PR url
  verification?: { method: string; result: "pass" | "fail"; detail: string };
  contentHash: string;                   // sha256 of the normalized evidence payload
  result: "pass" | "fail" | "partial";
  traceId: string;
  spanId: string;
  createdAt: string;
  redactions: number;                    // count of secret-scrub hits (>0 ⇒ incident review)
}

export type TaskStatus = "COMPLETE" | "PARTIAL" | "BLOCKED" | "FAILED";
export interface CompletionAssessment {
  status: TaskStatus;
  unmetConditions: string[];             // completionConditions with no passing EvidenceItem
  evidenceIds: string[];
  reason?: string;                       // required for PARTIAL/BLOCKED/FAILED
}
```

**Rule enforced in code:** `status = "COMPLETE"` is allowed only when every entry in
`plan.completionConditions` has ≥1 `EvidenceItem` with `result="pass"` whose `claim` is linked to that condition
(link table `evidence_condition_map`). Otherwise the Communication Contract emits `PARTIAL` with `unmetConditions`.

```sql
-- 0003_orch_evidence.sql
create table evidence (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  run_id          uuid not null,
  session_id      uuid not null,
  step_id         uuid references execution_plan_steps(id) on delete set null,
  claim           text not null,
  kind            text not null check (kind in
                   ('tool_result','verification','artifact','external_source',
                    'db_snapshot','screenshot','log_excerpt','approval_record')),
  source          text not null,
  tool_call_id    uuid,
  artifact_uri    text,
  verification    jsonb,
  content_hash    text not null,
  result          text not null check (result in ('pass','fail','partial')),
  trace_id        text not null,
  span_id         text not null,
  redactions      integer not null default 0,
  created_at      timestamptz not null default now()
);
create index on evidence (organization_id, run_id, created_at);
create index on evidence (organization_id, tool_call_id);
-- RLS(evidence)

create table evidence_condition_map (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  run_id          uuid not null,
  condition_text  text not null,
  evidence_id     uuid not null references evidence(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique (run_id, condition_text, evidence_id)
);
-- RLS(evidence_condition_map)
```

### B.3 Communication Contract (4.19)

Long-running work emits a fixed set of **status frames** to `event_log` (type `agent.comm.*`) and, when a channel
is attached (Command Center chat / WhatsApp), renders a one-line human summary. Internal logs are never dumped.

```typescript
export type CommFrameType =
  | "STARTED" | "PROGRESS" | "BLOCKER" | "DECISION" | "VERIFICATION" | "COMPLETE";

export interface CommFrame {
  type: CommFrameType;
  runId: string; sessionId: string; agentId: string;
  at: string;
  headline: string;                 // <= 140 chars, no markdown for WhatsApp channel
  detail?: string;                  // shown only in Command Center, still no raw logs
  // type-specific:
  progressPct?: number;             // PROGRESS
  blockerReason?: "needs_approval" | "needs_user" | "dependency" | "provider_down" | "quota"; // BLOCKER
  decision?: { chose: string; alternatives: string[]; because: string };  // DECISION
  verification?: { method: string; result: "pass" | "fail" };             // VERIFICATION
  assessment?: CompletionAssessment;                                      // COMPLETE
}
```

Emission cadence: `STARTED` once; `PROGRESS` on every plan-step `complete` (throttled to ≤1/20s per run);
`DECISION` whenever the Planner picks among ≥2 viable options or the Model Router switches provider;
`VERIFICATION` on every VERIFY; `BLOCKER` on entering BLOCKED; `COMPLETE` once, self-contained (restates goal,
outcome, evidence links, residual risks). A final frame must be understandable without scrollback.

### B.4 Subagents (4.20)

Spawn a subagent only if the Planner marks a step `kind="subagent"`, which it does only when ALL hold:
work is independent (own write-set), specialization has a distinct AgentDefinition, parallelism is materially
useful OR context isolation prevents budget blow-up.

Two modes, both persisted:

- **Manager / agent-as-tool:** orchestrator issues a `subagent.invoke` tool call → child run created with its own
  `run_id`, `parent_run_id` set, own budget carved from parent (`parent.budget * share`, share ≤ 0.5). Child returns
  a structured result; orchestrator retains ownership of the session and state. Child cannot write `agent_sessions`
  of the parent — only its own scratch session + an `EvidenceItem` bundle.
- **Handoff:** ownership transfers (B.5). Used when the remaining goal belongs to a different role (e.g. Sales →
  Booking). The parent stops after emitting the HandoffPackage.

```sql
-- 0004_orch_subagents.sql
create table agent_runs (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  session_id        uuid not null,
  parent_run_id     uuid references agent_runs(id) on delete set null,
  agent_id          uuid not null,
  agent_version     text not null,
  kind              text not null default 'root' check (kind in ('root','subagent','handoff_target')),
  goal              text not null,
  budget            jsonb not null,        -- {max_iterations,max_tokens,deadline_at,parallelism}
  status            text not null default 'running'
                    check (status in ('running','complete','partial','blocked','failed','cancelled')),
  assessment        jsonb,                 -- CompletionAssessment
  trace_id          text not null,
  started_at        timestamptz not null default now(),
  finished_at       timestamptz
);
create index on agent_runs (organization_id, session_id, started_at desc);
create index on agent_runs (organization_id, parent_run_id);
create index on agent_runs (organization_id, status) where status = 'running';
-- RLS(agent_runs)
```

### B.5 Agent Handoff Package (4.21) — distinct from Model Handoff Pack (4.30)

Agent handoff = responsibility moves between two different agent identities. Model handoff = same agent, new engine.

```typescript
// packages/agent-runtime/handoff/agent-handoff.ts
export interface AgentHandoffPackage {
  handoffId: string;
  organizationId: string;
  sessionId: string;
  fromAgentId: string; fromAgentVersion: string;
  toAgentId: string;   toAgentVersion: string;
  reason: string;                       // "qualification complete, booking required"
  goal: string;                         // the remaining goal, restated for the receiver
  scope: { includes: string[]; excludes: string[] };
  context: {
    knownFacts: Array<{ fact: string; confidence: number; source: string }>;
    decisions: Array<{ decision: string; because: string; at: string }>;
    artifacts: Array<{ uri: string; kind: string }>;
    customerState: Record<string, unknown>;   // phase, language, preferences
  };
  constraints: string[];                // "do not re-ask availability window", policy notes
  expectedOutput: { schema: string; completionConditions: string[] };
  authority: AuthorityEnvelope;         // receiver's envelope for the remaining goal (never > sender's)
  mustNotRepeat: string[];              // questions/actions already done
  stateVersion: number;
  createdAt: string;
  contextHash: string;                  // sha256 over the serialized package minus this field
}
```

Guards before a handoff is allowed (Safe Handoff Boundary, 4.28): state persisted, no `tool_calls` in status
`requested`/`running`, no open DB transaction owned by the run, previous agent response complete, latest
`session_snapshot` consistent with `state_version`. If any fails → the handoff is queued as a `wait` step until
the boundary is safe, or (provider failure) escalates to Emergency Handoff.

```sql
-- 0005_orch_agent_handoffs.sql
create table agent_handoffs (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  session_id        uuid not null,
  from_agent_id     uuid not null,
  to_agent_id       uuid not null,
  kind              text not null default 'agent' check (kind in ('agent','model')),
  reason            text not null,
  package           jsonb not null,       -- AgentHandoffPackage or HandoffPack
  context_hash      text not null,
  state_version     integer not null,
  status            text not null default 'proposed'
                    check (status in ('proposed','boundary_wait','accepted','rejected','completed','failed')),
  continuity_check  jsonb,                -- ContinuityValidator output
  created_at        timestamptz not null default now(),
  completed_at      timestamptz
);
create index on agent_handoffs (organization_id, session_id, created_at desc);
-- RLS(agent_handoffs)
```

---

## C. SESSION-AWARE MODEL ROUTER STACK (4.41–4.50)

### C.1 Core TypeScript contracts

```typescript
// packages/model-router/types.ts

export type ReasoningPolicy = "FAST" | "STANDARD" | "DEEP" | "MAX";
export type PrivacyClass = "public" | "internal" | "customer_pii" | "regulated";
export type LatencyClass = "realtime" | "interactive" | "batch";
export type CostClass = "free" | "cheap" | "standard" | "premium";
export type ModelStatus = "candidate" | "evaluating" | "approved" | "degraded" | "blocked";

export interface ModelCapabilityRecord {
  provider: string;                 // "google" | "groq" | "mock" | ...
  model: string;                    // "gemini-2.0-flash"
  snapshot: string;                 // provider version/date pin
  modalities: { text: boolean; vision: boolean; audio: boolean; video: boolean };
  tools: boolean;
  structuredOutput: boolean;
  streaming: boolean;
  reasoning: boolean;               // supports explicit reasoning effort
  contextWindow: number;            // tokens
  maxOutputTokens: number;
  privacyClass: PrivacyClass;       // max sensitivity this model/provider may see
  latencyClass: LatencyClass;
  costClass: CostClass;
  costPerMTokIn: number;            // EUR
  costPerMTokOut: number;
  quotaSupported: boolean;          // provider exposes usable quota signals
  scores: {                        // 0..1, per-agent overrides live in model_scores
    behavior: number;
    tool: number;
    continuity: number;
    security: number;
    quality: number;
  };
  approvedAgentTypes: string[];     // e.g. ["sales","support"]; "*" = any
  status: ModelStatus;
  updatedAt: string;
}

export interface QuotaState {
  provider: string; model: string | null;      // null = provider-wide bucket
  limits: Partial<Record<
    "rpm" | "tpm" | "rpd" | "tpd" | "hourly_req" | "daily_req" |
    "monthly_req" | "audio_seconds" | "credits", number>>;
  used: Partial<Record<string, number>>;        // same keys
  windowResetAt: Partial<Record<string, string>>;
  confidence: "OFFICIAL" | "ESTIMATED" | "UNKNOWN";
  updatedAt: string;
}

export interface QuotaForecast {
  provider: string; model: string | null;
  consumptionRatePerMin: number;                // EWMA of tokens or requests, normalized to the binding limit
  bindingLimit: string;                         // which key is closest to exhaustion
  remainingFraction: number;                    // 0..1 of binding limit
  estimatedExhaustionAt: string | null;
  reserveThreshold: number;                     // fraction below which Drain Mode arms (default 0.15)
  recommendation: "ok" | "arm_drain" | "draining" | "exhausted";
}

export type ProviderErrorClass =
  | "RATE_LIMIT"        // 429
  | "QUOTA_EXCEEDED"    // hard cap / billing
  | "TIMEOUT"
  | "SERVER_ERROR"      // 5xx
  | "BAD_REQUEST"       // 400 malformed
  | "AUTH"              // 401/403
  | "CONTENT_FILTER"
  | "CONTEXT_OVERFLOW"
  | "SCHEMA_ERROR"      // structured output invalid
  | "UNAVAILABLE"       // network / DNS / provider down
  | "UNKNOWN";

export interface ProviderError extends Error {
  class: ProviderErrorClass;
  provider: string; model?: string;
  retryable: boolean;
  retryAfterMs?: number;                        // from Retry-After header when present
  raw?: unknown;                                // scrubbed
}

export interface ProviderHealth {
  provider: string;
  state: "healthy" | "degraded" | "down";
  p50LatencyMs: number; p95LatencyMs: number;
  errorRate1m: number; errorRate5m: number;     // 0..1
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorClass: ProviderErrorClass | null;
  consecutiveFailures: number;
  updatedAt: string;
}

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";
export interface CircuitBreakerState {
  provider: string; model: string | null;
  state: CircuitState;
  failureThreshold: number;                     // consecutive failures to trip (default 5)
  rollingWindowSec: number;                     // error-rate window (default 60)
  errorRateThreshold: number;                   // trip if rate over window ≥ this (default 0.5) with ≥ minSamples
  minSamples: number;                           // default 8
  openedAt: string | null;
  probeAfterMs: number;                         // OPEN → HALF_OPEN delay (default 20000, x2 each re-trip, cap 300000)
  halfOpenProbes: number;                       // successes needed to close (default 2)
  halfOpenInFlight: number;
  updatedAt: string;
}

export interface ScoreBreakdown {
  provider: string; model: string;
  passedAbsoluteFilters: boolean;
  filterRejections: string[];                   // e.g. ["privacy","context_fit"]
  terms: {
    compatibility: number;
    capability: number;
    behavior: number;
    health: number;
    quota: number;
    contextFit: number;
    quality: number;
    privacyEligibility: number;
    latency: number;
    cost: number;
    continuityBonus: number;
    switchingPenalty: number;                   // negative contribution
    degradationPenalty: number;                 // negative
    quotaRiskPenalty: number;                   // negative
  };
  weightedTotal: number;
}

export interface RoutingDecision {
  id: string;
  organizationId: string;
  sessionId: string;
  runId: string;
  turnId: string;
  agentId: string;
  taskType: string;                             // ANSWER|RESEARCH|BUILD|...
  reasoningPolicy: ReasoningPolicy;
  requiredCapabilities: string[];
  contextTokens: number;
  privacyClass: PrivacyClass;
  chosen: { provider: string; model: string; snapshot: string; reasoningEffortNative: string };
  lock: { locked: boolean; scope: "session" | "run" | "turn"; reason: string };
  fallbackChain: Array<{ provider: string; model: string }>;
  candidatesEvaluated: ScoreBreakdown[];
  decidedBy: "router" | "model_lock" | "tool_loop_lock" | "emergency_handoff" | "human";
  latencyBudgetMs: number;
  costBudgetEur: number;
  createdAt: string;
}
```

### C.2 Reasoning Policy mapping (4.42)

Abstract → native, resolved by each provider adapter. Never store a provider name in routing logic.

| Abstract | Trigger | Gemini native | Groq native | Mock |
|---|---|---|---|---|
| FAST | simple/lookup/classify; conversational turn ≤2 sentences | `thinkingBudget: 0` / flash | `reasoning_effort: "none"` (or 8B model) | `mode:"fast"` |
| STANDARD | normal task, single tool hop | `thinkingBudget: 4096` | `reasoning_effort: "default"` | `mode:"standard"` |
| DEEP | multi-step plan, code change, ambiguous intent | `thinkingBudget: 16384` | `reasoning_effort: "high"` | `mode:"deep"` |
| MAX | architecture / migration / research / R3+ decision, only when justified by task tag | `thinkingBudget: 32768` + 2.5-pro if approved | `reasoning_effort: "high"` + 70B | `mode:"max"` |

Policy selection is a pure function `reasoningPolicy(taskType, complexityScore, riskLevel, ambiguity)` with a
lookup table; MAX requires `justification` string persisted on the RoutingDecision or it is downgraded to DEEP.

### C.3 Model Capability Registry + scores — SQL (4.43)

```sql
-- 0010_orch_model_registry.sql
create table model_registry (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  provider        text not null,
  model           text not null,
  snapshot        text not null default 'latest',
  modalities      jsonb not null default '{"text":true,"vision":false,"audio":false,"video":false}'::jsonb,
  supports_tools  boolean not null default false,
  supports_structured_output boolean not null default false,
  supports_streaming boolean not null default true,
  supports_reasoning boolean not null default false,
  context_window  integer not null,
  max_output_tokens integer not null default 4096,
  privacy_class   text not null default 'internal'
                  check (privacy_class in ('public','internal','customer_pii','regulated')),
  latency_class   text not null default 'interactive'
                  check (latency_class in ('realtime','interactive','batch')),
  cost_class      text not null default 'standard'
                  check (cost_class in ('free','cheap','standard','premium')),
  cost_per_mtok_in  numeric(12,6) not null default 0,
  cost_per_mtok_out numeric(12,6) not null default 0,
  quota_supported boolean not null default false,
  status          text not null default 'candidate'
                  check (status in ('candidate','evaluating','approved','degraded','blocked')),
  approved_agent_types text[] not null default '{}',
  updated_at      timestamptz not null default now(),
  unique (organization_id, provider, model, snapshot)
);
create index on model_registry (organization_id, status);
-- RLS(model_registry)

-- Per-(agent_type, model) behavioral scores; router reads the agent-specific row, falls back to model default.
create table model_scores (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  provider        text not null,
  model           text not null,
  agent_type      text not null default '*',           -- '*' = default
  behavior_score    numeric(4,3) not null default 0.5,
  tool_score        numeric(4,3) not null default 0.5,
  continuity_score  numeric(4,3) not null default 0.5,
  security_score    numeric(4,3) not null default 0.5,
  quality_score     numeric(4,3) not null default 0.5,
  sample_size     integer not null default 0,
  source          text not null default 'seed'         -- 'seed'|'eval_run'|'incident'|'manual'
                  check (source in ('seed','eval_run','incident','manual')),
  updated_at      timestamptz not null default now(),
  unique (organization_id, provider, model, agent_type)
);
-- RLS(model_scores)

create table routing_decisions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  session_id      uuid not null,
  run_id          uuid not null,
  turn_id         uuid not null,
  agent_id        uuid not null,
  task_type       text not null,
  reasoning_policy text not null check (reasoning_policy in ('FAST','STANDARD','DEEP','MAX')),
  required_capabilities text[] not null default '{}',
  context_tokens  integer not null default 0,
  privacy_class   text not null,
  chosen_provider text not null,
  chosen_model    text not null,
  chosen_snapshot text not null,
  reasoning_effort_native text,
  lock_scope      text not null default 'session' check (lock_scope in ('session','run','turn')),
  locked          boolean not null default true,
  decided_by      text not null default 'router'
                  check (decided_by in ('router','model_lock','tool_loop_lock','emergency_handoff','human')),
  fallback_chain  jsonb not null default '[]'::jsonb,
  candidates      jsonb not null default '[]'::jsonb,   -- ScoreBreakdown[]
  latency_budget_ms integer,
  cost_budget_eur numeric(12,6),
  created_at      timestamptz not null default now()
);
create index on routing_decisions (organization_id, session_id, created_at desc);
create index on routing_decisions (organization_id, run_id);
create index on routing_decisions (organization_id, chosen_provider, chosen_model, created_at desc);
-- RLS(routing_decisions)

create table model_locks (
  session_id      uuid primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  provider        text not null,
  model           text not null,
  snapshot        text not null,
  scope           text not null default 'session' check (scope in ('session','run')),
  locked_at       timestamptz not null default now(),
  locked_by_run   uuid,
  reason          text not null default 'active_session',
  tool_loop_lock  boolean not null default false,       -- true = even emergency handoff waits for tool cycle end
  epoch           integer not null default 1
);
-- RLS(model_locks)
```

### C.4 Quota Manager / Forecaster / Drain Mode (4.46–4.48) — SQL

```sql
-- 0011_orch_quota.sql
create table provider_quotas (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  provider        text not null,
  model           text,                                  -- null = provider-wide
  limits          jsonb not null default '{}'::jsonb,     -- {rpm,tpm,rpd,tpd,hourly_req,daily_req,monthly_req,audio_seconds,credits}
  used            jsonb not null default '{}'::jsonb,
  window_reset_at jsonb not null default '{}'::jsonb,
  confidence      text not null default 'UNKNOWN' check (confidence in ('OFFICIAL','ESTIMATED','UNKNOWN')),
  updated_at      timestamptz not null default now(),
  unique (organization_id, provider, coalesce(model,''))
);
-- RLS(provider_quotas)

create table quota_ledger (                               -- append-only usage increments; forecaster reads this
  id              bigint generated always as identity primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  provider        text not null,
  model           text,
  at              timestamptz not null default now(),
  requests        integer not null default 0,
  tokens_in       integer not null default 0,
  tokens_out      integer not null default 0,
  audio_seconds   integer not null default 0,
  credits         numeric(12,6) not null default 0,
  routing_decision_id uuid
);
create index on quota_ledger (organization_id, provider, model, at desc);
-- RLS(quota_ledger)

create table drain_state (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  provider        text not null,
  model           text,
  mode            text not null default 'ACTIVE' check (mode in ('ACTIVE','DRAINING','EXHAUSTED')),
  reason          text,
  forecast        jsonb,                                   -- QuotaForecast snapshot
  entered_at      timestamptz not null default now(),
  unique (organization_id, provider, coalesce(model,''))
);
-- RLS(drain_state)
```

**Forecaster (runs in `workers/model-health-worker`, every 30s):**
For each `(provider, model)` bucket with a known binding limit:
```
rate = EWMA(alpha=0.3) over quota_ledger deltas in last 10 min, normalized to binding limit's window
remainingFraction = 1 - used[binding] / limit[binding]
estimatedExhaustionAt = now + (remainingFraction * limitWindow) / rate   (null if rate ≈ 0)
if remainingFraction <= reserveThreshold (0.15)  → recommendation = arm_drain
if a live 429 with QUOTA_EXCEEDED seen in last 2 min → recommendation = draining
if remainingFraction <= 0.02 or hard cap hit      → recommendation = exhausted
```
Writes `drain_state.mode`: `ACTIVE` (accept all) → `DRAINING` (finish existing sessions, route NEW sessions
elsewhere) → `EXHAUSTED` (no new turns even for existing; force Emergency Handoff / WAIT).

### C.5 Circuit Breaker (4.49) — SQL + transitions

```sql
-- 0012_orch_circuit_breaker.sql
create table circuit_breaker_state (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  provider        text not null,
  model           text,
  state           text not null default 'CLOSED' check (state in ('CLOSED','OPEN','HALF_OPEN')),
  failure_threshold integer not null default 5,
  rolling_window_sec integer not null default 60,
  error_rate_threshold numeric(4,3) not null default 0.5,
  min_samples     integer not null default 8,
  consecutive_failures integer not null default 0,
  opened_at       timestamptz,
  probe_after_ms  integer not null default 20000,
  half_open_probes_needed integer not null default 2,
  half_open_in_flight integer not null default 0,
  half_open_successes integer not null default 0,
  updated_at      timestamptz not null default now(),
  unique (organization_id, provider, coalesce(model,''))
);
-- RLS(circuit_breaker_state)
```

Transitions (enforced in `packages/model-router/circuit-breaker/index.ts`, all writes via one `UPDATE ... WHERE`
with optimistic `updated_at` check):

| From | Event | Guard | To | Side effect |
|---|---|---|---|---|
| CLOSED | provider error | `consecutive_failures+1 >= failure_threshold` OR (`errorRate(window) >= 0.5` AND `samples >= min_samples`) | OPEN | set `opened_at=now`; emit `circuit.open`; router excludes this bucket (absolute filter) |
| CLOSED | provider success | — | CLOSED | `consecutive_failures=0` |
| OPEN | probe timer | `now - opened_at >= probe_after_ms` | HALF_OPEN | allow up to `half_open_probes_needed` real turns as probes |
| HALF_OPEN | probe success | `half_open_successes+1 >= half_open_probes_needed` | CLOSED | reset counters; `probe_after_ms` back to base 20000; emit `circuit.close` |
| HALF_OPEN | probe failure | — | OPEN | `probe_after_ms = min(probe_after_ms*2, 300000)`; `opened_at=now` |

### C.6 Free-First routing pipeline (4.44) + Routing Score (4.45)

Pipeline is **absolute filters first (boolean), then weighted score**. A model that fails any absolute filter is
removed regardless of score.

**Absolute filters (order matters — cheapest checks first):**
1. `status in ('approved','degraded')` and (`agent_type` in `approved_agent_types` or `'*'`).
2. **Capability:** every `requiredCapabilities` supported (tools, vision, audio, structured_output, streaming).
3. **Privacy eligibility:** `model.privacyClass >= task.privacyClass` on the ordered scale
   `public < internal < customer_pii < regulated`. A `regulated` task never touches a `public` model.
4. **Context fit:** `contextTokens + reserveOut <= contextWindow * 0.9`.
5. **Health:** circuit `state != OPEN`; `ProviderHealth.state != 'down'`.
6. **Quota:** `drain_state.mode != 'EXHAUSTED'`; if `mode='DRAINING'` allowed ONLY when this is an existing
   locked session (continuity), never for a new session.
7. **Model lock / tool-loop lock:** if session has a lock and this candidate ≠ locked model → filtered out
   UNLESS we are in Emergency Handoff selection mode (lock released).

**Weighted score (code):**

```typescript
// packages/model-router/scoring/score.ts
export const WEIGHTS = {
  compatibility:      3.0,   // agent-type/behavior fit gate residual (0..1)
  capability:         2.0,   // headroom beyond the hard requirement (0..1)
  behavior:           4.0,   // model_scores.behavior_score for this agent_type
  health:             2.5,   // 1 - errorRate5m, latency-adjusted
  quota:              2.0,   // remainingFraction of binding limit
  contextFit:         1.0,   // 1 - contextTokens/(contextWindow*0.9)
  quality:            3.0,   // model_scores.quality_score
  privacyEligibility: 1.0,   // 1 if class margin >=1 tier, 0.6 if exact match
  latency:            1.5,   // 1 - min(p95/latencyBudget, 1)
  cost:               2.5,   // 1 for free, then 1/(1+eurPerKTokBlended) normalized; FREE-FIRST bias lives here
  continuityBonus:    5.0,   // +1 if candidate == session.lockedModel (applied only in re-eval, not first pick)
} as const;

export const SWITCHING_PENALTY   = 6.0;   // subtracted when choosing a model != current session lock
export const DEGRADATION_PENALTY = 4.0;   // subtracted when model_registry.status = 'degraded'
export const QUOTA_RISK_PENALTY  = 3.0;   // scaled by (1 - remainingFraction)^2 when forecast.recommendation != 'ok'

export function scoreCandidate(c: Candidate, ctx: RoutingContext): ScoreBreakdown {
  const t = {
    compatibility:      WEIGHTS.compatibility      * c.compatibility,
    capability:         WEIGHTS.capability         * c.capabilityHeadroom,
    behavior:           WEIGHTS.behavior           * c.behaviorScore,
    health:             WEIGHTS.health             * c.healthScore,
    quota:              WEIGHTS.quota              * c.quotaRemainingFraction,
    contextFit:         WEIGHTS.contextFit         * c.contextFitScore,
    quality:            WEIGHTS.quality            * c.qualityScore,
    privacyEligibility: WEIGHTS.privacyEligibility * c.privacyMargin,
    latency:            WEIGHTS.latency            * c.latencyScore,
    cost:               WEIGHTS.cost               * c.costScore,
    continuityBonus:    ctx.isReEval && c.isSessionLock ? WEIGHTS.continuityBonus : 0,
    switchingPenalty:   ctx.currentLock && !c.isSessionLock ? -SWITCHING_PENALTY : 0,
    degradationPenalty: c.status === "degraded" ? -DEGRADATION_PENALTY : 0,
    quotaRiskPenalty:   c.forecastRec !== "ok" ? -(QUOTA_RISK_PENALTY * (1 - c.quotaRemainingFraction) ** 2) : 0,
  };
  const weightedTotal = Object.values(t).reduce((a, b) => a + b, 0);
  return { provider: c.provider, model: c.model, passedAbsoluteFilters: true,
           filterRejections: [], terms: t, weightedTotal };
}
```

**Tie-break order** (within 0.5 of top score): (1) higher `behavior` term, (2) `cost` term (free wins),
(3) is the current session lock, (4) lower `p95` latency, (5) provider with more `remainingFraction`,
(6) lexicographic `provider,model` for determinism.

**First pick vs re-eval:** on the FIRST turn of a session there is no lock → `continuityBonus=0`,
`switchingPenalty=0`, pure free-first + quality. On re-eval (quota/health event) the `switchingPenalty` and
`continuityBonus` make the router strongly prefer staying put unless the current model is filtered out or its
score collapses by > `SWITCHING_PENALTY`.

### C.7 ModelProvider interface + Gemini/Groq skeletons (4.50)

```typescript
// packages/model-router/providers/provider.ts
export interface GenerateRequest {
  model: string;
  system: string;
  messages: Array<{ role: "user" | "assistant" | "tool"; content: string; toolCallId?: string }>;
  tools?: Array<{ name: string; description: string; parameters: object }>;
  reasoningPolicy: ReasoningPolicy;
  responseSchema?: object;            // JSON schema for structured output
  maxOutputTokens: number;
  temperature?: number;
  privacyClass: PrivacyClass;
  idempotencyKey: string;            // provider request idempotency where supported
  signal?: AbortSignal;
}
export interface GenerateResult {
  text: string;
  parsed?: unknown;                  // when responseSchema set and valid
  toolCalls: Array<{ id: string; name: string; arguments: unknown }>;
  finishReason: "stop" | "length" | "tool_calls" | "content_filter" | "error";
  usage: { promptTokens: number; completionTokens: number; totalTokens: number; reasoningTokens?: number };
  raw: unknown;                      // scrubbed
  latencyMs: number;
}
export interface StreamChunk { delta: string; toolCallDelta?: unknown; done: boolean; usage?: GenerateResult["usage"]; }

export interface ModelProvider {
  readonly name: string;                                   // "google" | "groq" | "mock"
  auth(cfg: ProviderAuthConfig): Promise<void>;            // reads key from env/secret store ONLY
  capabilities(): Promise<ModelCapabilityRecord[]>;        // static + provider /models where available
  generate(req: GenerateRequest): Promise<GenerateResult>;
  stream(req: GenerateRequest): AsyncIterable<StreamChunk>;
  health(): Promise<ProviderHealth>;
  getQuota(model?: string): Promise<QuotaState>;
  normalizeError(e: unknown): ProviderError;               // → ProviderErrorClass
  mapReasoning(policy: ReasoningPolicy): Record<string, unknown>;  // native knobs
}
export interface ProviderAuthConfig { apiKeyEnvVar: string; baseUrl?: string; project?: string; }
```

```typescript
// packages/model-router/providers/gemini.ts  (skeleton)
import { GoogleGenAI } from "@google/genai";

export class GeminiProvider implements ModelProvider {
  readonly name = "google";
  private client!: GoogleGenAI;
  private lastHealth: ProviderHealth = blankHealth("google");

  async auth(cfg: ProviderAuthConfig) {
    const key = process.env[cfg.apiKeyEnvVar];
    if (!key) throw new Error(`Gemini: missing ${cfg.apiKeyEnvVar}`);
    this.client = new GoogleGenAI({ apiKey: key });
  }

  mapReasoning(p: ReasoningPolicy) {
    const budget = { FAST: 0, STANDARD: 4096, DEEP: 16384, MAX: 32768 }[p];
    return { thinkingConfig: { thinkingBudget: budget } };
  }

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const started = Date.now();
    try {
      const res = await this.client.models.generateContent({
        model: req.model,
        contents: toGeminiContents(req.messages),
        config: {
          systemInstruction: req.system,
          maxOutputTokens: req.maxOutputTokens,
          temperature: req.temperature ?? 0.4,
          responseMimeType: req.responseSchema ? "application/json" : "text/plain",
          responseSchema: req.responseSchema as any,
          tools: req.tools?.length ? [{ functionDeclarations: req.tools }] : undefined,
          ...this.mapReasoning(req.reasoningPolicy),
          abortSignal: req.signal,
        },
      });
      this.recordSuccess(Date.now() - started);
      return mapGeminiResult(res, Date.now() - started);
    } catch (e) {
      const err = this.normalizeError(e);
      this.recordError(err);
      throw err;
    }
  }

  async *stream(req: GenerateRequest) {
    const it = await this.client.models.generateContentStream({ /* same config */ } as any);
    for await (const c of it) yield { delta: c.text ?? "", done: false } as StreamChunk;
    yield { delta: "", done: true };
  }

  async health() { return this.lastHealth; }

  async getQuota(model?: string): Promise<QuotaState> {
    // Gemini free tier has no live quota endpoint → confidence ESTIMATED from published limits + local ledger.
    return {
      provider: "google", model: model ?? null,
      limits: { rpm: 15, tpm: 1_000_000, rpd: 1_500 },   // seeded from official free-tier docs, dated
      used: {}, windowResetAt: {}, confidence: "ESTIMATED", updatedAt: new Date().toISOString(),
    };
  }

  normalizeError(e: any): ProviderError {
    const status = e?.status ?? e?.response?.status;
    const map: Record<number, ProviderErrorClass> = {
      429: "RATE_LIMIT", 400: "BAD_REQUEST", 401: "AUTH", 403: "AUTH",
      404: "BAD_REQUEST", 408: "TIMEOUT", 500: "SERVER_ERROR", 503: "UNAVAILABLE", 504: "TIMEOUT",
    };
    let cls: ProviderErrorClass = map[status] ?? "UNKNOWN";
    const msg = String(e?.message ?? "");
    if (/exceeded your current quota|billing/i.test(msg)) cls = "QUOTA_EXCEEDED";
    if (/safety|blocked/i.test(msg)) cls = "CONTENT_FILTER";
    if (/token count|context length/i.test(msg)) cls = "CONTEXT_OVERFLOW";
    const retryAfter = Number(e?.response?.headers?.["retry-after"]) * 1000 || undefined;
    return Object.assign(new Error(scrub(msg)), {
      class: cls, provider: "google", model: e?.model,
      retryable: ["RATE_LIMIT","TIMEOUT","SERVER_ERROR","UNAVAILABLE"].includes(cls),
      retryAfterMs: retryAfter, raw: undefined,
    }) as ProviderError;
  }

  private recordSuccess(ms: number) { /* EWMA latency, errorRate decay, consecutiveFailures=0, lastSuccessAt */ }
  private recordError(err: ProviderError) { /* bump counters, set lastErrorClass, maybe state=degraded/down */ }
  async capabilities() { return GEMINI_STATIC_CAPS; }
}
```

```typescript
// packages/model-router/providers/groq.ts  (skeleton)
import Groq from "groq-sdk";

export class GroqProvider implements ModelProvider {
  readonly name = "groq";
  private client!: Groq;
  private lastHealth = blankHealth("groq");

  async auth(cfg: ProviderAuthConfig) {
    const key = process.env[cfg.apiKeyEnvVar];
    if (!key) throw new Error(`Groq: missing ${cfg.apiKeyEnvVar}`);
    this.client = new Groq({ apiKey: key });
  }

  mapReasoning(p: ReasoningPolicy) {
    return { reasoning_effort: ({ FAST: "none", STANDARD: "default", DEEP: "high", MAX: "high" } as const)[p] };
  }

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const started = Date.now();
    try {
      const res = await this.client.chat.completions.create({
        model: req.model,
        messages: [{ role: "system", content: req.system }, ...toOpenAIMessages(req.messages)],
        max_tokens: req.maxOutputTokens,
        temperature: req.temperature ?? 0.4,
        response_format: req.responseSchema
          ? { type: "json_schema", json_schema: { name: "out", schema: req.responseSchema } }
          : undefined,
        tools: req.tools?.map(t => ({ type: "function", function: t })),
        ...this.mapReasoning(req.reasoningPolicy),
      }, { signal: req.signal, headers: { "Idempotency-Key": req.idempotencyKey } });
      this.recordSuccess(Date.now() - started);
      return mapOpenAIResult(res, Date.now() - started);
    } catch (e) {
      const err = this.normalizeError(e); this.recordError(err); throw err;
    }
  }

  async *stream(req: GenerateRequest) {
    const s = await this.client.chat.completions.create({ /* ...*/ stream: true } as any, { signal: req.signal });
    for await (const part of s) yield { delta: part.choices?.[0]?.delta?.content ?? "", done: false } as StreamChunk;
    yield { delta: "", done: true };
  }

  async health() { return this.lastHealth; }

  async getQuota(model?: string): Promise<QuotaState> {
    // Groq returns x-ratelimit-* headers on every response → we cache them into provider_quotas after each call.
    const q = await readCachedGroqHeaders(model);
    return { provider: "groq", model: model ?? null, limits: q.limits, used: q.used,
             windowResetAt: q.reset, confidence: "OFFICIAL", updatedAt: new Date().toISOString() };
  }

  normalizeError(e: any): ProviderError {
    const status = e?.status ?? e?.response?.status;
    const map: Record<number, ProviderErrorClass> = {
      429: "RATE_LIMIT", 400: "BAD_REQUEST", 401: "AUTH", 403: "AUTH",
      413: "CONTEXT_OVERFLOW", 422: "SCHEMA_ERROR", 500: "SERVER_ERROR", 503: "UNAVAILABLE", 504: "TIMEOUT",
    };
    let cls = map[status] ?? "UNKNOWN";
    if (/rate limit/i.test(String(e?.message)) ) cls = "RATE_LIMIT";
    const retryAfterMs = Number(e?.response?.headers?.["retry-after"]) * 1000 || undefined;
    return Object.assign(new Error(scrub(String(e?.message ?? ""))), {
      class: cls, provider: "groq",
      retryable: ["RATE_LIMIT","TIMEOUT","SERVER_ERROR","UNAVAILABLE"].includes(cls),
      retryAfterMs,
    }) as ProviderError;
  }
  private recordSuccess(ms: number) {}
  private recordError(e: ProviderError) {}
  async capabilities() { return GROQ_STATIC_CAPS; }
}
```

**MockProvider** implements the same interface deterministically (seeded RNG), lets us drive GOLDEN_004/005
(simulated 429 after a tool call) with no network.

---

## D. APPROVAL ENGINE / RISK MODEL / JOB ENGINE (4.56–4.58)

### D.1 Risk Model (4.57 / 12.5)

Single canonical enum, used by Planner, Policy Engine, Approval Engine, Verification depth.

| Level | Name | Examples | Default gate | Verification depth |
|---|---|---|---|---|
| R0 | READ | read row, search KB, inspect file, GET API, `git status` | none | shallow |
| R1 | REVERSIBLE INTERNAL WRITE | update CRM field, create draft, write scratch file, create branch, internal note | none (inside safe-default autonomy) | standard |
| R2 | EXTERNAL COMMUNICATION | send WhatsApp/email/DM, calendar invite to customer, post internal-only comment on external system | approval unless agent autonomy ≥ AUTO_LOW_RISK for that channel | standard |
| R3 | COMMERCIAL / PRODUCTION | send quote/invoice, take payment, deploy to prod, publish public content, large campaign send | approval always (owner or delegated role) | deep |
| R4 | DESTRUCTIVE / SECURITY / ADMIN | delete data, rotate/issue credentials, change RLS/RBAC, drop resources, modify security settings | approval always + second factor (owner only) + dry-run evidence | deep + rollback proof |

```typescript
export type RiskLevel = "R0" | "R1" | "R2" | "R3" | "R4";

export interface AuthorityEnvelope {
  taskClass: "ANSWER"|"RESEARCH"|"REVIEW"|"DIAGNOSE"|"PLAN"|"BUILD"|"CHANGE"|"EXECUTE"|"MONITOR";
  maxRisk: RiskLevel;                 // highest risk this envelope may perform without a fresh approval
  allowedCapabilities: string[];      // tool capability tags
  deniedCapabilities: string[];
  channels: string[];                 // for R2: which channels may be used ("whatsapp","email",...)
  autonomyLevel: "OFF"|"SHADOW"|"DRAFT"|"ASSISTED"|"AUTO_LOW_RISK"|"AUTO_EXPANDED";
  spendCapEur?: number;               // cumulative external spend allowed in this envelope
  expiresAt?: string;
  grantedBy: string;                  // user id or "policy_default"
  parentEnvelopeId?: string;          // an envelope can never widen its parent (handoff/subagent)
}
```

Rule enforced in `packages/policy-engine`: `effectiveEnvelope = intersect(agentPolicyEnvelope, taskEnvelope,
parentEnvelope)`. Persistence/age of a session never widens it (blueprint 4.7).

### D.2 Approval Engine (4.56)

```typescript
export interface ApprovalRequest {
  id: string;
  organizationId: string;
  sessionId?: string;
  runId?: string;
  planStepId?: string;
  requestedByAgentId: string;
  action: string;                    // "email.send" | "deploy.prod" | "payment.capture"
  target: string;                    // recipient / repo+env / invoice id
  argsHash: string;                  // sha256 of the exact args to be executed
  reason: string;
  riskLevel: RiskLevel;
  reversibility: "reversible" | "compensavailable" | "irreversible";
  requestedScope: { capability: string; oneShot: boolean; ttlSec?: number; maxUses?: number };
  evidence: string[];                // evidence ids: dry-run output, diff, preview url
  status: "pending" | "approved" | "rejected" | "expired" | "consumed" | "cancelled";
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
  expiresAt: string;                 // default now + 30 min (R2), + 4h (R3), + 24h (R4)
  createdAt: string;
}
```

**Behavior:**
- Approval applies ONLY to the `requestedScope` (capability + argsHash). A different `argsHash` → new request.
- `oneShot=true` → status flips to `consumed` on first successful execution; the Tool Runtime checks
  `approval.status='approved' AND approval.args_hash = call.args_hash AND not expired` before an R2+ side effect.
- Blocked plan step sits in `status='blocked'`; the run emits `BLOCKER(needs_approval)` and yields (does not spin).
- Delegation: owner can pre-authorize standing scopes per agent per channel (e.g. "Support may send WhatsApp
  R2 auto up to 200/day") stored as `approval_grants` (standing) vs `approvals` (per-action). Standing grants are
  R2 max; R3/R4 are always per-action.
- Auto-expiry worker (`workers/notification-worker` piggyback, 1/min) flips `pending`→`expired`, re-emits BLOCKER.

```sql
-- 0020_orch_approvals.sql
create table approvals (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  session_id      uuid,
  run_id          uuid,
  plan_step_id    uuid references execution_plan_steps(id) on delete set null,
  requested_by_agent_id uuid not null,
  action          text not null,
  target          text not null,
  args_hash       text not null,
  reason          text not null,
  risk_level      text not null check (risk_level in ('R0','R1','R2','R3','R4')),
  reversibility   text not null check (reversibility in ('reversible','compensavailable','irreversible')),
  requested_scope jsonb not null,
  evidence        jsonb not null default '[]'::jsonb,
  status          text not null default 'pending'
                  check (status in ('pending','approved','rejected','expired','consumed','cancelled')),
  decided_by      uuid,
  decided_at      timestamptz,
  decision_note   text,
  expires_at      timestamptz not null,
  created_at      timestamptz not null default now()
);
create index on approvals (organization_id, status, expires_at);
create index on approvals (organization_id, session_id, created_at desc);
create unique index on approvals (organization_id, args_hash, requested_by_agent_id)
  where status in ('pending','approved');
-- RLS(approvals)

create table approval_grants (                    -- standing pre-authorizations (R2 max)
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  agent_id        uuid not null,
  capability      text not null,                  -- "email.send"
  channel         text,                           -- "whatsapp"
  max_risk        text not null default 'R2' check (max_risk in ('R1','R2')),
  daily_cap       integer,                        -- uses/day
  spend_cap_eur   numeric(12,6),
  used_today      integer not null default 0,
  window_date     date not null default current_date,
  active          boolean not null default true,
  granted_by      uuid not null,
  created_at      timestamptz not null default now(),
  unique (organization_id, agent_id, capability, coalesce(channel,''))
);
-- RLS(approval_grants)
```

### D.3 Job Engine (4.58) — schema

```typescript
export type JobClass = "TINY" | "LIGHT" | "NORMAL" | "HEAVY" | "EXCLUSIVE";
export type JobState =
  | "queued" | "scheduled" | "assigned" | "starting" | "running"
  | "waiting" | "blocked" | "retrying" | "completed" | "failed" | "cancelled";

export interface Job {
  id: string;
  organizationId: string;
  namespace: string;                 // "crm."|"sales."|"support."|"agent."|"session."|"studio."|"build."|"deploy."|"marketing."|"social."|"video."|"memory."|"infra."|"integration."
  type: string;                      // "session.turn" | "build.factory" | "deploy.preview"
  jobClass: JobClass;
  priority: number;                  // 0 (highest) .. 9
  payload: Record<string, unknown>;  // opaque to the engine; secret-free
  dedupeKey?: string;                // unique among non-terminal jobs → enqueue is idempotent
  state: JobState;
  attempts: number;
  maxAttempts: number;
  runAt: string;                     // scheduled earliest start
  deadlineAt?: string;
  leaseOwner?: string;               // worker id
  leaseUntil?: string;               // heartbeat extends this
  heartbeatAt?: string;
  lastError?: { class: string; message: string; at: string };
  result?: Record<string, unknown>;
  parentJobId?: string;
  runId?: string;                    // links to agent_runs when the job is an agent turn
  hostPlacementId?: string;          // Resource Router decision
  createdAt: string; updatedAt: string; startedAt?: string; finishedAt?: string;
}
```

```sql
-- 0021_orch_jobs.sql
create table agent_jobs (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  namespace       text not null,
  type            text not null,
  job_class       text not null check (job_class in ('TINY','LIGHT','NORMAL','HEAVY','EXCLUSIVE')),
  priority        integer not null default 5 check (priority between 0 and 9),
  payload         jsonb not null default '{}'::jsonb,
  dedupe_key      text,
  state           text not null default 'queued'
                  check (state in ('queued','scheduled','assigned','starting','running',
                                   'waiting','blocked','retrying','completed','failed','cancelled')),
  attempts        integer not null default 0,
  max_attempts    integer not null default 3,
  run_at          timestamptz not null default now(),
  deadline_at     timestamptz,
  lease_owner     text,
  lease_until     timestamptz,
  heartbeat_at    timestamptz,
  last_error      jsonb,
  result          jsonb,
  parent_job_id   uuid references agent_jobs(id) on delete set null,
  run_id          uuid,
  host_placement_id uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  started_at      timestamptz,
  finished_at     timestamptz
);
-- claim index: ready work, cheapest first
create index agent_jobs_claim_idx on agent_jobs (priority, run_at)
  where state in ('queued','scheduled','retrying');
-- lease reaper index
create index agent_jobs_lease_idx on agent_jobs (lease_until)
  where state in ('assigned','starting','running','waiting');
-- dedupe: only one live job per key
create unique index agent_jobs_dedupe_idx on agent_jobs (organization_id, dedupe_key)
  where dedupe_key is not null and state not in ('completed','failed','cancelled');
create index on agent_jobs (organization_id, namespace, state);
create index on agent_jobs (organization_id, run_id);
-- RLS(agent_jobs)

create table agent_job_events (                 -- per-job transition audit (also mirrored to event_log)
  id              bigint generated always as identity primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  job_id          uuid not null references agent_jobs(id) on delete cascade,
  from_state      text,
  to_state        text not null,
  worker_id       text,
  detail          jsonb,
  at              timestamptz not null default now()
);
create index on agent_job_events (organization_id, job_id, at);
-- RLS(agent_job_events)
```

### D.4 Job Engine state machine — transitions, guards, timeouts, retry

Claim protocol (worker loop, one SQL statement):

```sql
-- worker claims up to N jobs it is eligible for (by class/host), atomically
with cte as (
  select id from agent_jobs
   where state in ('queued','scheduled','retrying')
     and run_at <= now()
     and job_class = any($1)                       -- classes this worker serves
   order by priority, run_at
   for update skip locked
   limit $2
)
update agent_jobs j
   set state = 'assigned', lease_owner = $3,
       lease_until = now() + ($4 || ' seconds')::interval,  -- lease TTL per class, below
       heartbeat_at = now(), attempts = j.attempts + 1, updated_at = now(), started_at = coalesce(j.started_at, now())
  from cte where j.id = cte.id
returning j.*;
```

| Transition | Guard | Timeout / trigger | On timeout |
|---|---|---|---|
| `queued → scheduled` | `run_at > now()` (delayed enqueue) | scheduler tick | — |
| `queued/scheduled/retrying → assigned` | claim SQL above; `run_at <= now()`; dedupe ok | — | — |
| `assigned → starting` | worker acked, resources reserved (Resource Router placement recorded) | 30s to leave `assigned` | lease reaper → `retrying` |
| `starting → running` | process/turn actually began | 120s | reaper → `retrying` |
| `running → waiting` | job awaits external (approval, tool callback, sub-job join) | — | lease still heartbeated while waiting |
| `waiting → running` | dependency resolved | `deadline_at` | → `failed(class=deadline)` |
| `running → blocked` | needs approval / missing capability / host unavailable | — | stays until unblocked or `deadline_at` → `failed` |
| `running/starting/waiting → retrying` | lease expired OR retryable error AND `attempts < max_attempts` | lease reaper (every 15s): `lease_until < now()` | backoff `run_at = now() + base*2^(attempts-1) ± jitter` (base per class) |
| `* → failed` | `attempts >= max_attempts` OR non-retryable error OR `deadline_at` passed | — | emit `job.failed`, run compensation hook if registered |
| `running → completed` | worker posts result; for agent turns: `agent_runs.status in (complete,partial)` | — | — |
| `* → cancelled` | owner/parent cancels; parent job failed and `cancel_children=true` | — | best-effort SIGTERM to worker |

**Lease / heartbeat mechanics.** Worker sends `UPDATE agent_jobs SET lease_until = now() + ttl, heartbeat_at = now()
WHERE id=$1 AND lease_owner=$2 AND state IN (...)` every `ttl/3`. If the update affects 0 rows (lease stolen /
job cancelled) the worker aborts the job immediately (fence). Lease reaper is a single job
(`infra.job.lease_reaper`, 15s cadence) that moves expired leases to `retrying` (or `failed` if attempts
exhausted) and emits `job.lease_expired`.

**Per-JobClass policy:**

| Class | Lease TTL | Heartbeat | maxAttempts | Backoff base | Concurrency (per host) | Notes |
|---|---|---|---|---|---|---|
| TINY | 30s | 10s | 5 | 2s | 20 | in-process; e.g. `session.snapshot`, `memory.write_gate` |
| LIGHT | 120s | 40s | 4 | 5s | 8 | single tool hop, `session.turn` FAST |
| NORMAL | 600s | 60s | 3 | 15s | 4 | agent turn DEEP, `studio.render_preview` |
| HEAVY | 3600s | 120s | 2 | 60s | 1 (Linux box) or 1 (Hetzner CX53) | `build.factory`, `deploy.*`, video encode — never on the 3.7GB prod VPS |
| EXCLUSIVE | 7200s | 120s | 1 | n/a (manual re-queue) | 1 global (advisory lock `pg_advisory_xact_lock(hashtext(namespace))`) | migrations, schema ops, release cut |

**Crash recovery.** Because every side-effecting tool call carries an `idempotency_key` and writes a
`tool_calls` row BEFORE execution, a job resumed after a crash: (1) reloads its `run`/`plan`, (2) for each
`tool_calls` row in status `requested` with no `result`, checks the provider/tool idempotency record — if the
effect already happened, marks it `completed` from the record; if not, re-issues. (3) The agent loop re-enters at
RETRIEVE with the persisted `state_version`. No side effect is replayed without an idempotency proof (blueprint
4.53, §14).

**Compensation hooks.** A job type may register `onFail`/`onCancel` compensating job types (e.g.
`deploy.preview` → `deploy.preview.teardown`). Registered in code `JOB_REGISTRY[type] = { class, compensation }`.

---

## E. SHIFT OS / RESOURCE ROUTER / ROUTER SEPARATION (4.59–4.61)

### E.1 Router separation (4.61) — one line each, non-overlapping

| Router | Question | Reads | Writes | Never decides |
|---|---|---|---|---|
| Agent Router | WHO handles this? | inbound event, conversation, agent registry, shifts | `agent_runs` | which model, where it runs |
| Model Router (§C) | WHICH inference engine? | routing inputs, registry, quota, health, lock | `routing_decisions`, `model_locks` | which host, whether allowed |
| Resource Router (§E.4) | WHERE does it execute? | job class, `host_nodes`, `host_metrics`, queue, deadline | `job_placements`, `agent_jobs.host_placement_id` | which agent/model |
| Capability Router | WHICH tools/skills? | task capabilities, `tool_registry`, policy | injected schemas (ephemeral) | approval |
| Policy Engine | ALLOWED? | actor, action, `AuthorityEnvelope`, RBAC/RLS | deny/allow log | human sign-off |
| Approval Engine (§D.2) | HUMAN approval needed? | risk level, autonomy level, grants | `approvals` | anything technical |

### E.2 Shift OS tables

```sql
-- 0030_orch_shift_os.sql
create table agent_shifts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  agent_id        uuid not null,
  window_start    time not null,                  -- local business tz, e.g. '09:00'
  window_end      time not null,                  -- '18:00'  (wraps midnight allowed: start > end)
  weekdays        smallint[] not null default '{1,2,3,4,5}',  -- ISO dow
  timezone        text not null default 'Europe/Lisbon',
  role_band       text not null default 'commercial'
                  check (role_band in ('always_on','night_support','commercial','reduced','batch')),
  target_concurrency integer not null default 1,  -- desired simultaneous runs for this agent in-window
  min_concurrency integer not null default 0,
  max_concurrency integer not null default 3,
  wake_priority   integer not null default 5,     -- lower = woken first
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on agent_shifts (organization_id, agent_id, active);
-- RLS(agent_shifts)

create table agent_runtime_state (
  agent_id        uuid primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  lifecycle       text not null default 'asleep'
                  check (lifecycle in ('asleep','waking','idle','busy','draining','error','disabled')),
  current_concurrency integer not null default 0,
  max_concurrency integer not null default 3,
  active_run_ids  uuid[] not null default '{}',
  last_wake_at    timestamptz,
  last_sleep_at   timestamptz,
  last_activity_at timestamptz,
  consecutive_errors integer not null default 0,
  cooldown_until  timestamptz,                    -- error backoff
  pinned_provider text,                           -- optional sticky from model lock policy
  updated_at      timestamptz not null default now(),
  state_version   integer not null default 0
);
-- RLS(agent_runtime_state)

create table agent_work_sessions (               -- a continuous period an agent was awake & serving
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  agent_id        uuid not null,
  shift_id        uuid references agent_shifts(id) on delete set null,
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  runs_handled    integer not null default 0,
  jobs_handled    integer not null default 0,
  tokens_in       bigint not null default 0,
  tokens_out      bigint not null default 0,
  cost_eur        numeric(12,6) not null default 0,
  wake_reason     text,                           -- 'shift_start'|'queue_pressure'|'manual'|'escalation'
  sleep_reason    text                            -- 'shift_end'|'idle_timeout'|'error_cooldown'|'manual'|'drain'
);
create index on agent_work_sessions (organization_id, agent_id, started_at desc);
-- RLS(agent_work_sessions)
```

### E.3 Shift scheduler algorithm

Runs as `infra.shift.tick` job, cadence **60s**, EXCLUSIVE-lite (advisory lock on `'shift_tick'`). Also a
**stagger cron** (see §7 Work Schedules) for the 22:00–00:00 batch train.

```
INPUT per tick:
  now, org business tz
  shifts        = agent_shifts WHERE active
  rtstate       = agent_runtime_state (all agents)
  queue         = agent_jobs GROUP BY namespace/agent target: {ready_count, oldest_age_s, p95_wait_s}
  hosts         = host_nodes + latest host_metrics
  policy_band   = band for current local time  (00-07 night_support | 07-09 ramp | 09-18 commercial | 18-22 reduced | 22-00 batch)

FOR EACH agent a:
  inWindow      = now within any shift row for a (weekday + time, tz-aware, wrap-aware)
  desired       = inWindow ? clamp(shift.target_concurrency * bandFactor(policy_band), shift.min, shift.max) : 0
                  bandFactor: night_support→{support/escalation/ops:1, others:0}
                              ramp 07-09 → 0.5   commercial → 1.0   reduced → 0.4   batch → {batch agents:1, others:0}
  # queue-pressure bump: if this agent's queue oldest_age_s > 180 and inWindow → desired = min(desired+1, shift.max)
  # global governor: if Σ desired across agents * avgCostPerRun projects over daily budget OR
  #                  any HEAVY host at load>0.85 → scale every desired down by governorFactor (0.5..1.0)

  cur = rtstate[a].current_concurrency
  IF rtstate[a].lifecycle == 'error' and now < cooldown_until: skip
  IF desired > 0 and rtstate[a].lifecycle == 'asleep':
     → set lifecycle='waking'; open agent_work_sessions(wake_reason); load compiled prompt + warm caches
     → on ready: lifecycle='idle'
  IF desired > cur and lifecycle in ('idle','busy'):
     → allow Agent Router to assign up to (desired-cur) more runs (raise max_concurrency)
  IF desired < cur:
     → lifecycle='draining' for this agent: no NEW runs; existing runs finish; when current_concurrency==0 → sleep
  IF desired == 0 and cur == 0 and lifecycle != 'asleep':
     → lifecycle='asleep'; close agent_work_sessions(sleep_reason='shift_end'); flush usage rollup
  IF inWindow and desired>0 and cur==0 and last_activity_at older than idle_timeout(15m) and queue empty:
     → keep idle (warm) until shift end; do NOT sleep mid-shift unless band flips

WRITE: agent_runtime_state (optimistic on state_version), emit shift.wake / shift.sleep / shift.scale events.
```

**Stagger cron** (avoids a thundering herd at 22:00): fixed offsets from Work Schedules §7 —
22:00 Analytics, 22:15 Reports, 22:30 Hermes, 23:00 Memory, 23:20 Backup-verify, 23:40 Cleanup. Implemented as
6 `scheduled` jobs seeded daily by `infra.shift.plan_batch` at 21:45.

**Concurrency governor math.**
```
projectedDailyCost = Σ_agents desired_a * runsPerHour_a(EWMA) * hoursLeftInDay * avgCostPerRun_a(EWMA)
budgetRemaining    = dailyBudgetEur - spentTodayEur
governorFactor     = clamp(budgetRemaining / max(projectedDailyCost, ε), 0.5, 1.0)
hostFactor         = min over HEAVY hosts of  (1 - max(0, load1 - 0.85) / 0.15)   # 1.0 healthy → 0 at load 1.0
effectiveDesired_a = ceil(desired_a * min(governorFactor, hostFactor))
```
If `budgetRemaining <= 0` → governorFactor floors at 0.5 for `always_on`/`night_support` bands (never fully
starve support), 0 for everything else, and an `incident(kind=budget_exhausted, severity=warning)` is opened +
owner notified (WhatsApp per the 6 escalation cases).

### E.4 Resource Router — placement decision function

Hosts available (seed `host_nodes`):

| id | kind | vCPU | RAM | notes | serves classes |
|---|---|---|---|---|---|
| mac | control | 8 | 16GB | owner machine, fallback only, no persistent worker | TINY (emergency only) |
| linux-home | heavy-exec | 8 | 8GB | `ssh claude@192.168.1.78`, BrowserMesh/Claude/Codex/build/FFmpeg | LIGHT, NORMAL, HEAVY |
| hetzner-cx53 | burst-ci | 8 | 32GB | on-demand `~/ci-cloud/run-gate.sh`, €0.047/h, ceiling €15/mo, spins up/down per run | HEAVY, EXCLUSIVE (CI gates, factory builds) |
| vps-prod | reliability | 2 | 3.7GB | `lumenva-crm` hel1 — CRM, WAHA, scheduler, notif, Ops Watcher. **NEVER heavy builds.** | TINY, LIGHT (session turns, snapshots, memory gate) |

```typescript
// packages/shift-os/resource-router/place.ts
export interface HostSnapshot {
  id: string; kind: string;
  status: "up" | "degraded" | "down" | "cold";     // cold = on-demand, not yet booted
  load1: number; loadPerCpu: number;                // load1 / vCPU
  memFreeMb: number; memTotalMb: number; swapUsedMb: number;
  diskFreeGb: number;
  queueDepth: number;                               // jobs currently placed here not finished
  p95PickupMs: number;
  bootSeconds: number;                              // 0 for always-on, ~90 for hetzner
  eurPerHour: number;
  capabilities: string[];                           // ["browsermesh","ffmpeg","docker","codex","gpu"...]
  servesClasses: JobClass[];
}
export interface PlacementInput {
  job: Pick<Job,"jobClass"|"type"|"namespace"|"deadlineAt"|"payload">;
  requiredCapabilities: string[];
  estimatedRamMb: number; estimatedMs: number;
  latencySensitive: boolean;                        // session turns = true
}
export interface Placement {
  hostId: string; reason: string;
  score: number; breakdown: Record<string,number>;
  requiresBoot: boolean; estBootMs: number;
  fallbackHostIds: string[];
}

export function placeJob(inp: PlacementInput, hosts: HostSnapshot[]): Placement {
  // 1. ABSOLUTE FILTERS
  let cand = hosts.filter(h =>
    h.status !== "down" &&
    h.servesClasses.includes(inp.job.jobClass) &&
    inp.requiredCapabilities.every(c => h.capabilities.includes(c)) &&
    h.memFreeMb >= inp.estimatedRamMb * 1.3 &&
    !(h.id === "vps-prod" && (inp.job.jobClass === "HEAVY" || inp.job.jobClass === "EXCLUSIVE")) &&
    !(h.id === "mac" && inp.job.jobClass !== "TINY")
  );
  if (cand.length === 0) return escalateNoHost(inp);         // → incident + WAIT/queue

  // 2. DEADLINE FEASIBILITY: can this host still finish in time (incl. boot + queue drain)?
  const now = Date.now();
  const feasible = cand.filter(h => {
    const start = now + (h.status === "cold" ? h.bootSeconds*1000 : 0)
                      + h.queueDepth * h.p95PickupMs;
    return !inp.job.deadlineAt || (start + inp.estimatedMs) <= Date.parse(inp.job.deadlineAt);
  });
  cand = feasible.length ? feasible : cand;                  // if none feasible, still try best-effort

  // 3. SCORE
  const W = { headroom: 3.0, latency: inp.latencySensitive ? 4.0 : 1.0,
              cost: 2.0, warm: 2.5, queue: 2.0, affinity: 1.5, swap: 2.0 };
  const scored = cand.map(h => {
    const b = {
      headroom: W.headroom * clamp01((h.memFreeMb/h.memTotalMb) * (1 - Math.min(h.loadPerCpu,1))),
      latency:  W.latency  * clamp01(1 - Math.min(h.p95PickupMs / 3000, 1)),
      cost:     W.cost     * clamp01(1 - h.eurPerHour / 0.06),         // free/cheap hosts win
      warm:     W.warm     * (h.status === "cold" ? 0 : 1),
      queue:    W.queue    * clamp01(1 - h.queueDepth / 8),
      affinity: W.affinity * (typeAffinity(inp.job.type, h) ? 1 : 0), // e.g. build.* → linux-home/hetzner
      swap:    -W.swap     * clamp01(h.swapUsedMb / 512),              // penalty
    };
    return { h, score: Object.values(b).reduce((a,c)=>a+c,0), b };
  }).sort((x,y) => y.score - x.score);

  const best = scored[0];
  // 4. HEAVY builds: prefer linux-home if healthy; burst to hetzner only if linux-home load>0.85 or busy
  let chosen = best;
  if (inp.job.jobClass === "HEAVY") {
    const home = scored.find(s => s.h.id === "linux-home" && s.h.loadPerCpu < 0.85 && s.h.status === "up");
    if (home) chosen = home;
    else {
      const hz = scored.find(s => s.h.id === "hetzner-cx53");
      if (hz && withinMonthlyCiCeiling()) chosen = hz;
    }
  }
  return {
    hostId: chosen.h.id, reason: explain(chosen.b, inp),
    score: chosen.score, breakdown: chosen.b,
    requiresBoot: chosen.h.status === "cold",
    estBootMs: chosen.h.status === "cold" ? chosen.h.bootSeconds*1000 : 0,
    fallbackHostIds: scored.slice(1).map(s => s.h.id),
  };
}
```

**Reroute / fallback logic.** A placed job that (a) fails to be picked up within `2 × p95PickupMs + estBootMs`,
or (b) whose host emits `host.down`/`host.degraded` while `assigned`/`starting`, is moved back to `retrying` with
`host_placement_id` cleared and a `placement.rerouted` event; the next claim recomputes `placeJob` with the
failed host excluded for `cooldown=300s`. If `escalateNoHost` fires (no eligible host) the job goes `blocked`,
an `incident(kind=no_capacity)` opens, and — for HEAVY CI — `~/ci-cloud/run-gate.sh` boot is requested via an
`infra.host.boot` job targeting hetzner-cx53 (respecting the €15/mo ceiling; over ceiling → owner approval R3).

```sql
-- 0031_orch_resource_router.sql
create table host_nodes (
  id              text primary key,                -- 'linux-home'
  organization_id uuid not null references organizations(id) on delete cascade,
  kind            text not null check (kind in ('control','heavy-exec','burst-ci','reliability')),
  vcpu            integer not null,
  ram_mb          integer not null,
  serves_classes  text[] not null default '{}',
  capabilities    text[] not null default '{}',
  eur_per_hour    numeric(12,6) not null default 0,
  boot_seconds    integer not null default 0,
  on_demand       boolean not null default false,
  status          text not null default 'cold'
                  check (status in ('up','degraded','down','cold')),
  ssh_alias       text,
  monthly_cost_ceiling_eur numeric(12,6),
  last_seen_at    timestamptz,
  created_at      timestamptz not null default now()
);
-- RLS(host_nodes)

create table host_metrics (
  id              bigint generated always as identity primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  host_id         text not null references host_nodes(id) on delete cascade,
  at              timestamptz not null default now(),
  load1           numeric(6,2) not null,
  load_per_cpu    numeric(6,3) not null,
  mem_free_mb     integer not null,
  swap_used_mb    integer not null default 0,
  disk_free_gb    numeric(8,2) not null,
  queue_depth     integer not null default 0,
  p95_pickup_ms   integer not null default 0,
  net_ok          boolean not null default true
);
create index on host_metrics (organization_id, host_id, at desc);
-- retention: drop rows older than 14 days (pg_cron)
-- RLS(host_metrics)

create table job_placements (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  job_id          uuid not null references agent_jobs(id) on delete cascade,
  host_id         text not null references host_nodes(id),
  score           numeric(8,3) not null,
  breakdown       jsonb not null,
  requires_boot   boolean not null default false,
  fallback_hosts  text[] not null default '{}',
  outcome         text not null default 'placed'
                  check (outcome in ('placed','picked_up','rerouted','failed_no_host')),
  created_at      timestamptz not null default now()
);
create index on job_placements (organization_id, job_id, created_at desc);
-- RLS(job_placements)
```

`host_metrics` is fed by a tiny reporter on each host: `linux-home` + `vps-prod` push every 15s via an
`infra.host.report` job; `hetzner-cx53` pushes only while booted; `mac` pushes opportunistically when a terminal
session is active. Missing 3 consecutive reports → `status='degraded'`, 6 → `down`.

---

## F. RUNTIME FLOW — 30 STEPS EXPANDED (blueprint 7.1)

For each step: **module** · **DB read** · **DB write** · **failure branch**. `T` = current turn id, `S` = session,
`R` = run. Every step also appends one `event_log` row (`type = runtime.step.<nn>`); omitted below for brevity
except where the event is load-bearing.

| # | Step | Module | Reads | Writes | Failure branch |
|---|---|---|---|---|---|
| 01 | Inbound event | `integrations/*` webhook → `workers/dispatcher` | — | `event_log(inbound.received)`; `agent_jobs(session.turn, dedupe_key=provider_msg_id)` | Signature/HMAC invalid → drop + `security.rejected` event; never enqueue |
| 02 | Normalize | `packages/integrations/normalize` | channel config | canonical `messages` row (existing schema) | Unknown channel → `incident(kind=integration_unmapped)`, park raw payload |
| 03 | Resolve organization | `policy-engine/tenant` | domain/route map, channel→org | `SET LOCAL app.org_id` | No org match → reject, `security.rejected(no_tenant)`; do NOT default an org |
| 04 | Resolve customer | CRM contacts | `contacts` by handle/phone/email | create `contacts` (R1) if new + `contact.created` | Ambiguous match (2+ contacts) → attach to conversation, flag `needs_merge`, continue |
| 05 | Resolve conversation | CRM conversations | `conversations` by (contact,channel) | open `conversations` if none | — |
| 06 | Resolve/open session | `agent-runtime/sessions` | `agent_sessions` by conversation, not closed | open `agent_sessions` (state_version=0) OR reopen (`session.reopened`, new `execution_epoch`) | Reopen after >24h → force full context recompile, mark `stale_context=true` |
| 07 | Resolve agent | **Agent Router** | routing rules (channel/intent/shift), `agent_runtime_state`, `agent_shifts` | `agent_runs`(kind=root, status=running) | No agent in-shift for band → route to `night_support` fallback agent OR queue `waiting` until shift; if none → `incident(no_agent)`, owner notify |
| 08 | Load agent version | `agent-definition` | `agent_versions` (published), `compiled_prompt_versions` | cache warm | No published version (still candidate) → refuse, `incident(agent_uncertified)` |
| 09 | Load session state | `agent-runtime/state` | `agent_sessions`, latest `session_snapshots` | — | Snapshot/state_version mismatch → rebuild from `event_log` replay; if replay gap → `blocked(state_corrupt)` + incident |
| 10 | Retrieve relevant memories | Memory (read) + Memory Gate | `customer_memories`, `agent_memory` scoped by org+agent+contact | — | Memory store slow/down → continue `degraded_context=true`; VERIFY depth ↑ |
| 11 | Retrieve skills/tools | Capability Router | `agent_skill_bindings`, `tool_registry`, search index | ephemeral shortlist | Search index stale → fall back to tag match; log `capability.search_degraded` |
| 12 | Determine task | `agent-runtime/runtime/interpret` | intent model (FAST) | `agent_runs.task_class`, `AuthorityEnvelope` computed | Low confidence + clarifying budget>0 → ask user (emit `BLOCKER(needs_user)` is NOT used; a normal reply asks) ; budget=0 → `blocked(needs_user)` |
| 13 | Model-lock evaluation | Model Router / `model_locks` | `model_locks` for S, `ToolLoopLock` flag | set/confirm `model_locks` | Locked model now `blocked`/circuit OPEN → release lock, go to Emergency Handoff selection at step 14 |
| 14 | Provider health/quota eval | Health Manager + Quota Manager + Drain | `provider_health`(cache), `provider_quotas`, `drain_state`, `circuit_breaker_state` | refresh caches | All candidate providers filtered → **runbook all-providers-down** (§14.5): `waiting` + timed retry or human handoff |
| 15 | Compile context | Context Engine | classes 01–20 (blueprint 4.32), `context_items` metadata | — | Over budget → step 15a Structured Compaction (§14.3) then recompile once; still over → drop P3 then P2 by priority |
| 16 | Compile executable prompt | Prompt Compiler | `compiled_prompt_versions` + runtime context + selected skills/tools | `context_hash` on turn | Compiler fails closed → `blocked(prompt_compile_failed)` + incident; never send a partial prompt |
| 17 | Model invocation | `ModelProvider.generate/stream` | routing decision | `routing_decisions`, `quota_ledger`, `event_log(model.selected)` | `ProviderError` → classify → §14 runbook (429 / 5xx / context overflow / schema) |
| 18 | Validate structured response | `agent-runtime/runtime/validate` | `AgentResponse` JSON schema | — | Schema invalid → 1 bounded output-repair call (same model); still invalid → Emergency Handoff or `failed(schema)` |
| 19 | Execute tool requests | Tool Runtime | `tool_registry`, `approvals`/`approval_grants`, idempotency records | `tool_calls`(requested→running), `event_log(tool.requested)` | R2+ without approval → create `approvals`, step `blocked`; tool error → 4.53 retry matrix |
| 20 | Return tool result to same model | ToolLoopLock | `tool_calls`(completed) | `tool_calls.result_*`, `event_log(tool.completed)` | Model changed mid-loop attempt → rejected by ToolLoopLock; only Emergency Handoff may break, and it carries tool_state |
| 21 | Obtain final structured response | ModelProvider | — | final `AgentResponse` | length finish reason → compact + continue; content_filter → `blocked(policy)` + incident |
| 22 | StateReducer | `agent-runtime/state/reducer` | current state, business rules | `agent_sessions`(state_version++), `event_log(state.updated)` | Rule rejection → discard updates, `event_log(state.rejected)`, CONTINUE loop with corrective sub-goal |
| 23 | Append events | Event Store | — | `event_log` batch (message.*, fact.*, goal.*, tool.*, model.*, etc.) | Append failure = hard fail: abort turn, do not ack inbound (it will redeliver; dedupe_key protects) |
| 24 | Persist snapshot | `agent-runtime/sessions/snapshot` | state | `session_snapshots`(state_version, context_hash) | Snapshot write fails → retry x3; then `incident`, keep session usable from event replay |
| 25 | MemoryGate | Memory Write Gate | `memory_candidates` from AgentResponse | validated → `customer_memories`/`agent_memory`; rejected → `memory_candidates(status=rejected)` | Dedup/conflict → keep higher-confidence, store conflict record (GOLDEN_009) |
| 26 | Verification | Verification Engine (§B.1) | verification policy per completed step | `evidence`, `evidence_condition_map` | Fail → repair sub-goal (≤2) → else `FAILED` for that step; plan may degrade to fallback |
| 27 | Calculate handoff_safe | `agent-runtime/handoff/boundary` | tool_calls open?, tx open?, response complete?, snapshot consistent? | `agent_sessions.handoff_safe` | Not safe → `handoff_safe=false`; any pending handoff waits (`agent_handoffs.status=boundary_wait`) |
| 28 | Final output gate | Output Guardrails | guardrail set, `AuthorityEnvelope` | — | Secret detected in output → scrub + `incident(secret_in_output)`; PII to wrong channel → block send |
| 29 | Send | channel adapter (Tool Runtime, idempotent `message.send`) | `approvals` for R2 send | outbound `messages`, `event_log(message.sent)`, `tool_calls(message.send)` | Send fails → retry with same idempotency_key; exhausted → `blocked(delivery_failed)` + notify |
| 30 | Metrics / evidence | Observability (§13) | turn timings, usage | `trace_spans`, `agent_usage`, `agent_session_usage`, `quota_ledger`, dashboards refresh | Metrics write failure is non-fatal: log + drop, never block the turn |

**Loop vs turn.** Steps 01–06 run once per inbound. Steps 07–30 run once per turn. Steps 15–26 repeat per loop
iteration inside a turn (the Execution Loop §A.1) until FINISH/BLOCKED/PARTIAL. `agent_runs` closes at turn end
with a `CompletionAssessment`.

## G. RUNTIME ROLES (7.2)

| Role | System | Owns | Does NOT own |
|---|---|---|---|
| Maestri | canvas orchestration | which agent terminals exist, human-facing dispatch, notes | session truth, model choice, evidence |
| Claude (Orchestrator) | `agent-runtime` root agent | planning, architecture, task decomposition, dependency control, decisions | writing state directly, executing builds |
| Codex | engineering subagents on linux-home / hetzner | code, migrations, tests, git of the project | approvals, production toggles, prod deploy without R3 |
| Hermes | learning loop (Wave 13+) | improvement candidates, eval-driven proposals | promoting anything to prod (governed promotion only) |
| Agent Runtime | `packages/agent-runtime` | identity, session state, tool lifecycle, handoff, evidence | inference (delegated to providers), placement |
| BrowserMesh | `runtimes/browsermesh` on linux-home | physical process execution, browser/CLI/git/ffmpeg, sandbox, evidence collection | deciding WHO/WHICH/ALLOWED |

## H. WORK SCHEDULES (7.3) — concrete policy the Shift scheduler reads

```jsonc
// seed: agent_shifts + a policy_bands config row per org
{
  "timezone": "Europe/Lisbon",
  "bands": [
    { "id": "night_support", "start": "00:00", "end": "07:00",
      "agents": ["support","escalation","notification_router","ops_watcher"], "bandFactor": 1.0,
      "others": 0.0 },
    { "id": "ramp",          "start": "07:00", "end": "09:00",
      "agents": ["sales","crm","research","content_planner","support"], "bandFactor": 0.5 },
    { "id": "commercial",    "start": "09:00", "end": "18:00", "agents": ["*"], "bandFactor": 1.0 },
    { "id": "reduced",       "start": "18:00", "end": "22:00", "agents": ["*"], "bandFactor": 0.4 },
    { "id": "batch",         "start": "22:00", "end": "00:00",
      "agents": ["analytics","reports","hermes","memory","backup_verify","cleanup"], "bandFactor": 1.0,
      "others": 0.0 }
  ],
  "staggerCron": [
    { "at": "22:00", "job": "marketing.analytics.rollup" },
    { "at": "22:15", "job": "reports.nightly.generate" },
    { "at": "22:30", "job": "memory.hermes.learn" },
    { "at": "23:00", "job": "memory.consolidate" },
    { "at": "23:20", "job": "infra.backup.verify" },
    { "at": "23:40", "job": "infra.cleanup.sweep" }
  ],
  "idleTimeoutMin": 15,
  "errorCooldownMin": 10,
  "maxErrorsBeforeDisable": 5
}
```

`bandFactor` multiplies `agent_shifts.target_concurrency`; `others: 0.0` means agents not listed for that band
are forced to `desired=0` (drain then sleep). The scheduler never sleeps an agent mid-band unless the band flips
or it hits `errorCooldown`.

---

## I. BUSINESS OS TABLES CONSOLIDATED (blueprint 8.2)

All tables from §§B–E plus the remainder named in 8.2. Full list with the ones not yet given DDL:

```sql
-- 0040_orch_business_os_remainder.sql

-- 8.2 agent_interactions: one row per agent<->party exchange (analytics-grade, denormalized from event_log)
create table agent_interactions (
  id              bigint generated always as identity primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  session_id      uuid not null,
  run_id          uuid,
  agent_id        uuid not null,
  contact_id      uuid,
  channel         text not null,
  direction       text not null check (direction in ('inbound','outbound')),
  turn_id         uuid,
  intent          text,
  tokens_in       integer not null default 0,
  tokens_out      integer not null default 0,
  tool_calls      integer not null default 0,
  latency_ms      integer,
  outcome         text,                                  -- 'answered'|'booked'|'escalated'|'blocked'|...
  at              timestamptz not null default now()
);
create index on agent_interactions (organization_id, agent_id, at desc);
create index on agent_interactions (organization_id, contact_id, at desc);
-- RLS(agent_interactions)

-- 8.2 agent_usage: per-agent per-hour rollup (Costs dashboard)
create table agent_usage (
  id              bigint generated always as identity primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  agent_id        uuid not null,
  bucket_hour     timestamptz not null,                  -- truncated to hour
  provider        text,
  model           text,
  runs            integer not null default 0,
  turns           integer not null default 0,
  tokens_in       bigint not null default 0,
  tokens_out      bigint not null default 0,
  reasoning_tokens bigint not null default 0,
  tool_calls      integer not null default 0,
  cost_eur        numeric(12,6) not null default 0,
  errors          integer not null default 0,
  handoffs        integer not null default 0,
  unique (organization_id, agent_id, bucket_hour, coalesce(provider,''), coalesce(model,''))
);
create index on agent_usage (organization_id, bucket_hour desc);
-- RLS(agent_usage)

-- 8.2 agent_session_usage: per-session lifetime rollup
create table agent_session_usage (
  session_id      uuid primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  agent_id        uuid not null,
  runs            integer not null default 0,
  turns           integer not null default 0,
  tokens_in       bigint not null default 0,
  tokens_out      bigint not null default 0,
  cost_eur        numeric(12,6) not null default 0,
  handoffs        integer not null default 0,
  model_switches  integer not null default 0,
  first_at        timestamptz not null default now(),
  last_at         timestamptz not null default now()
);
-- RLS(agent_session_usage)

-- 8.2 incidents
create table incidents (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  kind            text not null,                          -- 'provider_down'|'quota_exhausted'|'no_capacity'|
                                                          -- 'agent_uncertified'|'state_corrupt'|'secret_in_output'|
                                                          -- 'cross_tenant_attempt'|'budget_exhausted'|'worker_crash'|...
  severity        text not null default 'warning'
                  check (severity in ('info','warning','critical')),
  status          text not null default 'open'
                  check (status in ('open','ack','mitigating','resolved')),
  title           text not null,
  detail          jsonb not null default '{}'::jsonb,     -- secret-scrubbed
  session_id      uuid, run_id uuid, agent_id uuid, host_id text, provider text,
  trace_id        text,
  opened_at       timestamptz not null default now(),
  acked_at        timestamptz, resolved_at timestamptz,
  owner_notified  boolean not null default false,
  dedupe_key      text                                    -- collapse repeats within a window
);
create unique index on incidents (organization_id, dedupe_key) where status != 'resolved' and dedupe_key is not null;
create index on incidents (organization_id, status, severity, opened_at desc);
-- RLS(incidents)

-- 8.2 notifications (owner-facing; the 6 WhatsApp escalation cases + Command Center bell)
create table notifications (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  audience        text not null default 'owner' check (audience in ('owner','team','agent')),
  channel         text not null check (channel in ('whatsapp','command_center','email')),
  urgency         text not null default 'normal' check (urgency in ('low','normal','high','critical')),
  category        text not null,                          -- 'approval_needed'|'incident'|'budget'|'quota_drain'|
                                                          -- 'agent_error'|'deploy_result'|'daily_digest'
  title           text not null,
  body            text not null,
  link            text,                                   -- deep link into Command Center
  ref_incident_id uuid references incidents(id) on delete set null,
  ref_approval_id uuid references approvals(id) on delete set null,
  status          text not null default 'pending'
                  check (status in ('pending','sent','failed','suppressed','read')),
  dedupe_key      text,
  created_at      timestamptz not null default now(),
  sent_at         timestamptz
);
create unique index on notifications (organization_id, dedupe_key) where dedupe_key is not null and status = 'pending';
create index on notifications (organization_id, status, urgency, created_at desc);
-- RLS(notifications)
```

**The 6 WhatsApp escalation cases** (only these send `channel='whatsapp'`, everything else stays in Command
Center): (1) approval needed for R3/R4, (2) `incident.severity='critical'`, (3) budget/quota exhausted
(`budget_exhausted` / drain EXHAUSTED with no fallback), (4) all-providers-down WAIT entered, (5) production
deploy result (pass or fail), (6) an agent disabled after `maxErrorsBeforeDisable`. A `notification-worker`
consumes `notifications` where `channel='whatsapp' AND status='pending'`, sends via WAHA `/api/sendText` on the
VPS, marks `sent`/`failed`. Rate-limited to 1 per dedupe_key per 15 min.

**Rollup workers.** `agent_interactions` is written inline at runtime step 30. `agent_usage` /
`agent_session_usage` are upserted by a `memory.usage.rollup` job every 5 min from `quota_ledger` +
`routing_decisions` + `agent_runs`. `host_metrics` retention + `quota_ledger` retention (90 days) + `trace_spans`
retention (30 days) run nightly in `infra.cleanup.sweep`.

## J. EVENT STORE (blueprint 8.5) — extend `event_log`, do not replace

The existing `event_log` is the substrate. Additions:

```sql
-- 0041_orch_event_log_ext.sql
alter table event_log add column if not exists organization_id uuid;   -- backfill from context
alter table event_log add column if not exists trace_id     text;
alter table event_log add column if not exists span_id       text;
alter table event_log add column if not exists session_id    uuid;
alter table event_log add column if not exists run_id        uuid;
alter table event_log add column if not exists agent_id      uuid;
alter table event_log add column if not exists actor         text;    -- 'agent:<id>'|'user:<id>'|'system'|'worker:<id>'
alter table event_log add column if not exists stream        text;    -- e.g. 'session:<uuid>' partition-ish key
alter table event_log add column if not exists seq           bigint;  -- per-stream monotonic (assigned by trigger)
alter table event_log add column if not exists causation_id  uuid;    -- the event that caused this one
alter table event_log add column if not exists correlation_id uuid;   -- top-level request

create index if not exists event_log_stream_seq_idx on event_log (stream, seq);
create index if not exists event_log_org_type_idx   on event_log (organization_id, type, created_at desc);
create index if not exists event_log_trace_idx      on event_log (trace_id);
create index if not exists event_log_session_idx    on event_log (organization_id, session_id, created_at);

-- per-stream sequence, gap-free, assigned atomically
create or replace function event_log_assign_seq() returns trigger language plpgsql as $$
begin
  select coalesce(max(seq),0) + 1 into new.seq from event_log where stream = new.stream for update;
  return new;
end $$;
create trigger event_log_seq before insert on event_log
  for each row when (new.stream is not null and new.seq is null) execute function event_log_assign_seq();

-- append-only enforcement
create rule event_log_no_update as on update to event_log do instead nothing;
create rule event_log_no_delete as on delete to event_log do instead nothing;  -- purge only via partition drop
-- RLS: org_isolation on organization_id (nullable rows visible only to service_role)
alter table event_log enable row level security;
create policy org_isolation on event_log using (organization_id = app.current_org_id());
create policy service_full on event_log to service_role using (true) with check (true);
```

**Partitioning.** Convert `event_log` to monthly range partitions on `created_at` (`event_log_yYYYYmMM`). Nightly
job creates next month's partition; retention = keep 13 months hot, detach+archive older to cold storage
(Supabase storage bucket as compressed JSONL). This is the ONLY delete path (partition drop), preserving
append-only for live rows.

**Canonical event types** (namespaced, the runtime emits exactly these — 4.24 list made concrete):
`message.received|sent`, `intent.detected`, `fact.learned|updated`, `goal.started|completed`,
`plan.created|updated|superseded`, `step.ready|running|complete|failed`,
`tool.requested|completed|failed`, `model.selected|failed|rate_limited|switched`,
`routing.decided`, `quota.armed_drain|draining|exhausted`, `circuit.open|half_open|close`,
`handoff.started|completed|failed`, `memory.proposed|accepted|rejected|conflict`,
`verification.started|completed`, `evidence.recorded`,
`approval.requested|granted|rejected|consumed|expired`,
`job.enqueued|claimed|started|waiting|blocked|retrying|completed|failed|lease_expired`,
`shift.wake|sleep|scale`, `placement.decided|rerouted|failed_no_host`,
`host.up|degraded|down`, `incident.opened|ack|resolved`, `session.opened|closed|reopened`,
`state.updated|rejected`, `runtime.step.NN`.

**Read models.** `agent_sessions`, `session_snapshots`, `agent_interactions`, `agent_usage`, the dashboards —
all are projections rebuildable from `event_log` by replaying a `stream`. A `replayStream(stream, fromSeq)`
helper in `packages/agent-runtime/sessions` is the recovery path referenced in runtime step 09 and §14.4.

---

## K. RISK LEVELS (12.5) — canonical mapping table

Already defined as the enum in §D.1. The cross-references so every module uses ONE definition:

| Consumer | How it uses RiskLevel |
|---|---|
| Planner (§A.2) | `step.riskLevel`; rolls up to `plan.maxRisk`; inserts `approval` gate step at first `>= R2` |
| Policy Engine | `AuthorityEnvelope.maxRisk` is the ceiling; action above ceiling → deny → Approval Engine |
| Approval Engine (§D.2) | R2 → approval unless standing `approval_grants`; R3/R4 → always per-action; R4 → owner + 2FA + dry-run evidence |
| Verification Engine (§B.1) | depth = `{R0:shallow, R1:standard, R2:standard, R3:deep, R4:deep+rollback proof}` |
| Resource Router | no direct use, but R4 EXCLUSIVE jobs pin to hetzner/linux + advisory lock |
| Observability | `trace_span.risk_level` attribute; Command Center filters incidents/approvals by risk |
| Retry Matrix (4.53) | side-effecting retry allowed only with idempotency proof; R3/R4 steps have `maxRetries=0` |

Reversibility axis (orthogonal, stored on `approvals.reversibility`): `reversible` (undo is a single internal
write), `compensavailable` (a compensating action exists — refund, redeploy previous), `irreversible` (no
programmatic undo — external send, payment capture, hard delete). R4 + irreversible is the only combination that
requires owner 2FA.

## L. OBSERVABILITY / TRACING (blueprint 13)

### L.1 Trace/span schema

Provider-neutral. Hierarchy: **Trace → Run → Agent → Turn → {Model Call, Tool Call, Skill Load, Memory Read,
Guardrail, Handoff, Verification}**. One `trace_spans` table (flat, parent-linked) + OTLP export shim.

```typescript
// packages/agent-runtime/observability/types.ts
export type SpanKind =
  | "trace_root" | "run" | "agent" | "turn"
  | "model_call" | "tool_call" | "skill_load" | "memory_read" | "memory_write"
  | "guardrail" | "handoff" | "verification" | "planner" | "context_compile"
  | "routing" | "job" | "placement";

export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  organizationId: string;
  kind: SpanKind;
  name: string;                       // "model_call gemini-2.0-flash" / "tool_call calendar.book"
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  status: "ok" | "error" | "cancelled";
  attributes: {
    sessionId?: string; runId?: string; turnId?: string; agentId?: string; agentVersion?: string;
    provider?: string; model?: string; reasoningPolicy?: ReasoningPolicy;
    tokensIn?: number; tokensOut?: number; reasoningTokens?: number; costEur?: number;
    toolName?: string; toolCallId?: string; idempotencyKey?: string; sideEffect?: boolean;
    riskLevel?: RiskLevel; approvalId?: string;
    contextTokens?: number; contextHash?: string; compaction?: boolean;
    routingDecisionId?: string; switched?: boolean; fromModel?: string;
    handoffId?: string; handoffKind?: "agent" | "model"; continuityScore?: number;
    verificationMethod?: string; verificationResult?: "pass" | "fail";
    jobId?: string; jobClass?: JobClass; hostId?: string;
    errorClass?: ProviderErrorClass | string;
    evidenceIds?: string[];
  };
  events: Array<{ at: string; name: string; data?: Record<string, unknown> }>; // scrubbed
}
```

```sql
-- 0050_orch_tracing.sql
create table trace_spans (
  span_id         uuid primary key default gen_random_uuid(),
  trace_id        uuid not null,
  parent_span_id  uuid,
  organization_id uuid not null references organizations(id) on delete cascade,
  kind            text not null,
  name            text not null,
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  duration_ms     integer,
  status          text not null default 'ok' check (status in ('ok','error','cancelled')),
  session_id      uuid, run_id uuid, turn_id uuid, agent_id uuid,
  provider        text, model text,
  tokens_in       integer, tokens_out integer, reasoning_tokens integer,
  cost_eur        numeric(12,6),
  tool_name       text, side_effect boolean,
  risk_level      text,
  error_class     text,
  attributes      jsonb not null default '{}'::jsonb,
  events          jsonb not null default '[]'::jsonb
);
create index on trace_spans (trace_id, started_at);
create index on trace_spans (organization_id, kind, started_at desc);
create index on trace_spans (organization_id, run_id);
create index on trace_spans (organization_id, provider, model, started_at desc) where kind = 'model_call';
-- monthly partitions on started_at; 30-day hot retention, then drop
-- RLS(trace_spans)
```

### L.2 What each of the 30 runtime steps emits

| Steps | Span kind(s) | Key attributes / events |
|---|---|---|
| 01–02 | `trace_root` opens; `run` child at 07 | `correlation_id`, channel, `inbound.received` event |
| 03 | event only | `tenant.resolved` (org id), or `security.rejected` |
| 06 | `agent` span opens (spans the session turn) | sessionId, execution_epoch, `session.opened|reopened` |
| 07 | `routing` (agent) | chosen agentId, band, shift; `agent.routed` |
| 08 | `context_compile` prelude | agentVersion, promptVersion |
| 10 | `memory_read` | count, degraded flag |
| 11 | `skill_load` (one per loaded skill) | skill ids, search mode |
| 12 | event | task_class, envelope summary |
| 13–14 | `routing` (model) | lock state, drain mode, circuit states per candidate |
| 15 | `context_compile` | contextTokens, compaction bool, dropped priorities; `context.compacted` event |
| 16 | event | contextHash |
| 17 | `model_call` | provider, model, reasoningPolicy, tokensIn/Out, costEur, latency; `model.selected`, on error `model.failed`/`model.rate_limited` |
| 18 | child event of `model_call` | schema_valid bool, repair_attempts |
| 19–20 | `tool_call` (one per call) | toolName, toolCallId, idempotencyKey, sideEffect, riskLevel, approvalId; `tool.requested`/`tool.completed`/`tool.failed` |
| 21 | `model_call` (2nd) | finalize |
| 22 | `guardrail` + event | reducer accepted/rejected; `state.updated`/`state.rejected` |
| 23–24 | events | `events.appended` (count), `snapshot.persisted` (state_version) |
| 25 | `memory_write` | candidates, accepted, rejected, conflicts |
| 26 | `verification` (one per method) | method, result, evidenceIds |
| 27 | event | handoff_safe bool |
| 28 | `guardrail` | output gate result, scrub hits |
| 29 | `tool_call` message.send | delivery status |
| 30 | closes `agent`,`run`,`trace_root` | rollup: total tokens, cost, tool calls, handoffs, assessment.status |

Emergency Handoff (§14) opens a `handoff` span linking `fromModel`→`toModel` with `continuityScore` from the
Continuity Validator; GOLDEN_005 asserts this span exists and `continuityScore >= 0.95`.

### L.3 Command Center dashboard queries

All parameterized by `organization_id` (RLS also enforces). Written for the panels in blueprint §13.

**Agents panel — live roster:**
```sql
select ars.agent_id, ad.name, ars.lifecycle, ars.current_concurrency, ars.max_concurrency,
       ars.last_activity_at, ars.consecutive_errors,
       (select count(*) from agent_runs r
         where r.agent_id = ars.agent_id and r.status = 'running') as active_runs
from agent_runtime_state ars
join agent_definitions ad on ad.id = ars.agent_id
where ars.organization_id = $1
order by (ars.lifecycle = 'error') desc, ars.current_concurrency desc;
```

**Jobs panel — queue depth & age by namespace:**
```sql
select namespace,
       count(*) filter (where state in ('queued','scheduled','retrying'))          as ready,
       count(*) filter (where state in ('assigned','starting','running','waiting')) as active,
       count(*) filter (where state = 'blocked')                                   as blocked,
       count(*) filter (where state = 'failed' and finished_at > now()-interval '1h') as failed_1h,
       extract(epoch from (now() - min(run_at) filter (where state in ('queued','retrying'))))::int as oldest_ready_s
from agent_jobs
where organization_id = $1 and (finished_at is null or finished_at > now()-interval '1h')
group by namespace order by ready desc;
```

**Provider Health + Quota panel:**
```sql
select cb.provider, cb.model, cb.state as circuit,
       ph.state as health, ph.p95_latency_ms, ph.error_rate_5m,
       ds.mode as drain,
       q.confidence,
       round(100 * (1 - coalesce((q.used->>q_binding.key)::numeric,0)
                        / nullif((q.limits->>q_binding.key)::numeric,0)))::int as pct_remaining_binding
from circuit_breaker_state cb
left join provider_health ph on ph.provider = cb.provider
left join drain_state ds on ds.provider = cb.provider and coalesce(ds.model,'') = coalesce(cb.model,'')
left join provider_quotas q on q.provider = cb.provider and coalesce(q.model,'') = coalesce(cb.model,'')
left join lateral (select key from jsonb_object_keys(q.limits) key
                   order by (coalesce((q.used->>key)::numeric,0)/nullif((q.limits->>key)::numeric,0)) desc
                   limit 1) q_binding on true
where cb.organization_id = $1;
```

**Costs panel — today by agent & model:**
```sql
select ad.name as agent, u.provider, u.model,
       sum(u.turns) turns, sum(u.tokens_in) tok_in, sum(u.tokens_out) tok_out,
       round(sum(u.cost_eur), 4) cost_eur, sum(u.errors) errors, sum(u.handoffs) handoffs
from agent_usage u join agent_definitions ad on ad.id = u.agent_id
where u.organization_id = $1 and u.bucket_hour >= date_trunc('day', now())
group by rollup (ad.name, u.provider, u.model)
order by cost_eur desc nulls last;
```

**Sessions panel — continuity / handoff health (last 24h):**
```sql
select count(*) as sessions,
       sum(model_switches) as switches,
       sum(handoffs) as handoffs,
       round(avg(nullif(cost_eur,0))::numeric, 4) as avg_cost,
       (select count(*) from agent_handoffs h
         where h.organization_id = $1 and h.created_at > now()-interval '24h'
           and (h.continuity_check->>'score')::numeric < 0.95) as low_continuity_handoffs
from agent_session_usage
where organization_id = $1 and last_at > now() - interval '24h';
```

**Incidents / Approvals panel:**
```sql
select 'incident' t, id, kind as label, severity, status, opened_at at
from incidents where organization_id = $1 and status <> 'resolved'
union all
select 'approval' t, id, action as label, risk_level, status, created_at at
from approvals where organization_id = $1 and status = 'pending'
order by at desc;
```

**Infrastructure panel — host load:**
```sql
select h.id, h.kind, h.status,
       m.load_per_cpu, m.mem_free_mb, m.swap_used_mb, m.disk_free_gb, m.queue_depth, m.p95_pickup_ms
from host_nodes h
left join lateral (select * from host_metrics hm
                   where hm.host_id = h.id order by hm.at desc limit 1) m on true
where h.organization_id = $1
order by m.load_per_cpu desc nulls last;
```

### L.4 Metrics catalog (emitted to `trace_spans` + rolled to `agent_usage`)

latency (p50/p95 per step kind), tokens (in/out/reasoning), cost EUR, success/failure rate, retry_count,
provider/model distribution, context size distribution, memory reads/writes, tool calls (by tool, side-effect
share), handoffs (agent vs model, continuity score), agent behavior score trend (from `model_scores`), session
continuity (switches per session), jobs (throughput, queue age p95, failure rate by class), host utilization
(load_per_cpu, mem_free, swap), quota burn rate vs forecast, circuit trips per provider per day, approval
latency (request→decision), incident MTTA/MTTR.

---

## M. RELIABILITY RUNBOOKS (blueprint 14) — concrete state sequences

Each runbook is a deterministic sequence executed by the runtime/workers, with the exact row transitions.
No step is "consider" — each is an operation.

### 14.1 Provider 429 (RATE_LIMIT) mid-turn

Trigger: `ModelProvider.generate` throws `ProviderError{class:"RATE_LIMIT"}` at runtime step 17 or 21.

```
1. Health Manager: provider_health.consecutive_failures += 1; lastErrorClass = RATE_LIMIT; error_rate_1m updated.
2. Circuit Breaker: record failure. IF threshold met → circuit_breaker_state.state = OPEN (event circuit.open).
3. Quota Manager: if error carries Retry-After → provider_quotas.window_reset_at[binding] = now + retryAfter.
   Forecaster re-runs → likely drain_state.mode = DRAINING (event quota.draining).
4. Is there retry budget AND no side effect pending?
   - tool_calls open for this turn?  NO  → allow ONE local wait: sleep(min(retryAfterMs, 8000)); retry SAME model once.
                                     YES → skip local retry (must not stall a tool cycle) → go to 5.
5. Retry exhausted / not allowed → EMERGENCY HANDOFF (model handoff, §14 / blueprint 4.29):
   a. Freeze run: agent_jobs.state running→waiting; execution_epoch unchanged yet.
   b. Checkpoint: force snapshot (session_snapshots @ current state_version); assert handoff_safe path:
      - if a tool_call is in status 'requested'/'running' with a side effect: WAIT for its idempotency record
        to resolve (completed or provably-not-done) before proceeding. Never abandon mid-side-effect.
   c. Build HandoffPack (blueprint 4.30): from_provider/model, goal, current_task, known_facts, decisions,
      completed, pending, tool_state, important_tool_results, must_not_repeat, state_version, execution_epoch,
      context_hash. Persist agent_handoffs(kind='model', status='accepted').
   d. Model Router re-selects with lock RELEASED and the failed (provider,model) filtered (circuit OPEN + drain).
      Pick a capability-compatible fallback (e.g. Groq for Gemini). If none → runbook 14.5.
   e. Bootstrap: new model_locks row (epoch += 1); compile context WITH the HandoffPack as context class 18.
   f. Continuity Validator runs: checks the new model's first output does not (re-introduce, re-ask a known
      fact, repeat a completed tool call, drop the goal, change behavior class). Score 0..1.
      score < 0.95 → one corrective re-prompt with explicit "do not repeat X" list; still failing → escalate human.
   g. Resume: agent_jobs.state waiting→running; continue Execution Loop at RETRIEVE with new epoch.
6. Emit: model.rate_limited, handoff.started, model.switched, handoff.completed, circuit.open (if tripped).
7. routing_decisions row for the new turn: decided_by='emergency_handoff', fallback_chain recorded.
```

GOLDEN_004/005 assert: no duplicate `calendar.book`, goal preserved, `continuityScore >= 0.95`, one
`handoff` span present.

### 14.2 Quota drain (forecast, not yet 429)

Trigger: `workers/model-health-worker` forecaster sets `drain_state.mode = DRAINING` for `(provider[,model])`.

```
1. Event quota.armed_drain → quota.draining. notifications(category='quota_drain', channel='command_center';
   channel='whatsapp' ONLY if no compatible fallback exists → escalation case 3).
2. Model Router absolute filter: this bucket now INELIGIBLE for NEW sessions (step 14 filter 6).
3. Existing sessions locked to this bucket: KEEP serving (continuity) until either
   (a) their turn naturally completes and the next turn's re-eval prefers a fallback (switching penalty is
       outweighed because the current model now carries QUOTA_RISK_PENALTY scaled by (1-remaining)^2), or
   (b) mode escalates to EXHAUSTED → forced Emergency Handoff (14.1 step 5) at the next safe boundary.
4. Shift scheduler: Concurrency Governor sees reduced provider capacity → lowers desired concurrency for
   agents pinned to this provider (pinned_provider), raising it for others.
5. Recovery: when window resets (provider_quotas.window_reset_at passed) and a probe succeeds →
   drain_state.mode = ACTIVE; event quota.armed_drain cleared; bucket eligible again.
```

### 14.3 Context overflow (CONTEXT_OVERFLOW or budget check fails)

Trigger: step 15 budget check, or `ProviderError{class:"CONTEXT_OVERFLOW"}` at step 17.

```
1. Structured Compaction (blueprint 4.35), NOT "summarize the conversation":
   Build CompactionState { current_goal, active_plan, constraints, important_facts[], decisions[], promises[],
   completed[], pending[], artifacts[], tool_results(latest only, older→hashes), errors, blockers,
   verification_state, next_action }.
2. Replace context classes 16 (recent messages, keep last 4 turns verbatim) + 11 (memory, keep P0/P1 only)
   + 15 (tool results, keep latest per tool) with the CompactionState block.
3. Recompute context_hash. Persist a session_snapshots row with compaction=true.
4. Recompile prompt (step 16) ONCE. If still over budget → drop context priority P3 entirely, then P2 oldest-first
   until fit. Never drop P0 (policy/identity/current task/tool state) or P1 (session state/handoff/critical facts).
5. If even P0+P1+current input exceeds the smallest eligible model's window → route to a larger-context model
   (context-fit absolute filter already handles this at step 14); if none → blocked(context_irreducible) + incident.
6. Emit context.compacted with {before_tokens, after_tokens, dropped_priorities}.
```

### 14.4 Worker crash / lease expiry

Trigger: lease reaper finds `agent_jobs.lease_until < now()` in a non-terminal state; OR heartbeat UPDATE affects
0 rows (worker self-detects fence).

```
1. Lease reaper: job.state → 'retrying' (if attempts < max) else 'failed'; lease_owner/lease_until cleared;
   event job.lease_expired. host_metrics for that host inspected — if host also silent 6×15s → host.down.
2. On reclaim by a new worker:
   a. Load agent_runs + execution_plans (latest plan_version) for job.run_id.
   b. For each tool_calls row status in ('requested','running') with null result:
        - side_effect = false  → safe to re-issue.
        - side_effect = true   → check idempotency record (provider/tool ledger keyed by idempotency_key):
            * effect present  → mark tool_call completed from the record; DO NOT re-issue.
            * effect absent   → re-issue with the SAME idempotency_key.
            * indeterminate   → step 3.
   c. Rebuild session state: load latest session_snapshots; if state_version gap vs event_log →
      replayStream('session:<id>', fromSeq = snapshot.seq) to reconstruct; if replay hits a gap → blocked(state_corrupt)+incident.
   d. Re-enter Execution Loop at RETRIEVE with the reconstructed state_version.
3. Indeterminate side effect (c.indeterminate): do NOT replay. Open incident(kind=tool_ambiguous_after_crash,
   severity=warning), set the step 'blocked', notify Command Center; a human or a read-back verification job
   resolves whether the effect happened, then the step continues.
4. EXCLUSIVE jobs: on crash they do not auto-retry (maxAttempts=1). Advisory lock is released by the crashed
   connection; job → 'failed'; requires manual/owner re-queue (migration/release safety).
```

### 14.5 All providers down / all filtered

Trigger: step 14 yields zero eligible candidates (every provider circuit OPEN, or down, or EXHAUSTED, or
privacy-ineligible).

```
1. Do NOT reset the conversation. agent_jobs.state → 'waiting'; agent_sessions unchanged; handoff_safe computed.
2. Emit incident(kind=all_providers_down, severity=critical); notifications(channel='whatsapp') — escalation case 4.
3. Enter timed WAIT loop: a 'session.turn.resume_probe' job scheduled at now+30s, backoff ×2 to cap 10 min.
   Each probe re-runs step 14; the FIRST provider whose circuit reaches HALF_OPEN and passes a probe →
   route there (Emergency Handoff bootstrap if the session had a prior lock).
4. Human handoff path: if a human agent picks up the conversation in Command Center while WAITing, the session
   is marked handoff(kind='agent', to = human); the resume probe is cancelled. Agent can resume later via a new
   AgentHandoffPackage back from the human.
5. Hard ceiling: after 60 min WAIT with no provider, session.turn → 'failed(no_provider)', conversation gets a
   templated "we'll get back to you" ONLY if channel policy allows an automated holding message; otherwise silent,
   incident stays open, owner already notified.
```

### 14.6 Cross-tenant access attempt

Trigger: any query/tool call where resolved `organization_id` ≠ `app.current_org_id()`, or a tool argument
references a row in another org.

```
1. RLS denies the row (defense in depth). Runtime also asserts pre-call.
2. Abort the tool call; step → 'failed(authorization)'. No retry.
3. Evidence: write an evidence row (kind='approval_record' misuse) + incident(kind=cross_tenant_attempt,
   severity=critical, detail scrubbed of the target ids beyond a hash).
4. Guardrail counter for the agent += 1; if > 2 in 24h → agent lifecycle='disabled', notification escalation case 6.
5. event security.rejected with correlation_id; Ops Watcher independent alert path (not through the same worker).
```

## N. SEQUENCING, EFFORT, DEPENDENCIES

Engineer-days assume 1 senior full-stack (TS + Postgres) building against the existing monorepo, tests included,
no UI beyond Command Center read panels. "EX" = executed by a Codex engineering subagent on linux-home; Claude
Orchestrator owns decomposition + review.

### N.1 Module build order (maps to blueprint Waves 1–4)

| # | Module | Blueprint refs | Depends on | Eng-days | Deliverable / acceptance |
|---|---|---|---|---|---|
| 1 | **Event Store extension** (§J) | 8.5, 4.24 | existing `event_log`, `workers` | 3 | migration `0041`; per-stream `seq` gap-free under concurrency (pgTAP); monthly partitions + nightly partition job; `replayStream()` reconstructs a known session |
| 2 | **Risk Model + AuthorityEnvelope** (§D.1, §K) | 4.7, 4.57, 12.5 | — | 2 | `RiskLevel` enum shared package; `intersect()` envelope logic + property tests (child never widens parent) |
| 3 | **Job Engine** (§D.3–D.4) | 4.58, 14 (worker crash) | 1 | 6 | `agent_jobs` + claim SQL; lease reaper job; per-class policy; state-machine pgTAP (all illegal transitions rejected); crash-recovery test kills a worker mid-job and asserts no duplicate side effect |
| 4 | **Evidence + Verification Engine** (§B.1–B.2) | 4.17, 4.18 | 1, 2 | 5 | `evidence`, `evidence_condition_map`; `CompletionAssessment`; COMPLETE blocked unless every condition has passing evidence (test) |
| 5 | **Planner + Execution Loop + DAG** (§A) | 4.14–4.16 | 3, 4 | 8 | `execution_plans(_steps)`; Kahn acyclicity guard; fast/structured paths; fan-out admissibility (disjoint write-sets) test; re-plan on step failure |
| 6 | **Provider Interface + Mock/Gemini/Groq** (§C.7) | 4.50 | 2 | 6 | `ModelProvider` iface; 3 adapters; `normalizeError` → enum table tested against recorded fixtures; streaming |
| 7 | **Model Capability Registry + scores** (§C.3) | 4.43 | 6 | 3 | `model_registry`, `model_scores`, seed for gemini-2.0-flash / llama-3.3-70b / mock; per-agent-type score fallback |
| 8 | **Quota Manager + Forecaster + Drain** (§C.4) | 4.46–4.48 | 6, 7 | 5 | `provider_quotas`, `quota_ledger`, `drain_state`; forecaster job (EWMA); DRAINING excludes new sessions test |
| 9 | **Circuit Breaker** (§C.5) | 4.49 | 6 | 3 | `circuit_breaker_state`; CLOSED→OPEN→HALF_OPEN→CLOSED transitions pgTAP; exponential probe backoff cap |
| 10 | **Session-Aware Model Router + Score + Lock** (§C.1, C.2, C.6) | 4.41, 4.42, 4.44, 4.45 | 7, 8, 9 | 8 | `routing_decisions`, `model_locks`; absolute-filter-then-score; `scoreCandidate` unit tests with fixed weights; switching-penalty keeps a session put across a minor health blip |
| 11 | **ToolLoopLock + Tool Runtime idempotency** | 4.27, 4.51–4.53 | 3, 10 | 5 | `tool_calls`, idempotency records; retry matrix; side-effect replay only with proof (test) |
| 12 | **Handoff: Model (Emergency) + Continuity Validator** (§B.5, §14.1) | 4.28–4.30, 4.29 | 10, 11 | 6 | `agent_handoffs`; HandoffPack builder; Continuity Validator scoring; GOLDEN_004/005 pass on MockProvider |
| 13 | **Agent Handoff Package** (§B.5) | 4.21 | 2, 12 | 3 | `AgentHandoffPackage` type + persistence; envelope-narrowing enforced; Sales→Booking golden |
| 14 | **Approval Engine** (§D.2) | 4.56 | 2, 3 | 5 | `approvals`, `approval_grants`; oneShot consume; argsHash binding; expiry worker; R3/R4 always per-action test |
| 15 | **Policy Engine foundation** | 4.5, 4.54, 12.x | 2, 14 | 5 | instruction hierarchy enforcement; guardrail sets (Input/Runtime/Tool/Output/Authorization/Context); prompt-injection suite (blueprint 15.6) |
| 16 | **Communication Contract** (§B.3) | 4.19 | 4, 5 | 3 | `CommFrame` emitter; cadence throttling; self-contained COMPLETE frame; WhatsApp no-markdown rendering |
| 17 | **Subagents (manager + handoff modes)** (§B.4) | 4.20 | 5, 13 | 4 | `agent_runs` parent/child; budget carve; child cannot write parent session (test) |
| 18 | **Shift OS** (§E.2–E.3, §H) | 4.59, 7.3 | 3 | 6 | `agent_shifts`, `agent_runtime_state`, `agent_work_sessions`; 60s tick; band factors; concurrency governor math; stagger cron seeding |
| 19 | **Resource Router** (§E.4) | 4.60, 11 | 3, 18 | 6 | `host_nodes`, `host_metrics`, `job_placements`; `placeJob()`; HEAVY→linux-home, burst→hetzner within €15/mo; vps-prod never HEAVY (test); reroute on host.down |
| 20 | **Router separation wiring + Agent Router** (§E.1) | 4.61 | 10, 18, 19 | 4 | one entrypoint per router; no router makes another's decision (architecture test / import lint) |
| 21 | **Runtime Flow orchestrator** (§F) | 7.1 | 5, 10, 11, 15, 16 | 8 | the 30-step driver; each step's failure branch has a test; end-to-end GOLDEN_001 (booking) + 15.5 central E2E |
| 22 | **Observability / Tracing** (§L) | 13 | 1, 21 | 5 | `trace_spans` + partitions; span emitted at every runtime step (test asserts span tree shape); 7 Command Center dashboard queries behind RLS |
| 23 | **Reliability runbooks wiring** (§M) | 14 | 8, 9, 12, 19 | 4 | each runbook 14.1–14.6 as an integration test with explicit row-transition assertions |
| 24 | **Business OS rollups + notifications** (§I) | 8.2 | 1, 21, 22 | 4 | `agent_usage`, `agent_session_usage`, `agent_interactions`, `incidents`, `notifications`; 6 WhatsApp escalation cases wired to WAHA; rollup job |

**Total: ~130 engineer-days** for the orchestration plane (Waves 1–4 slice). Parallelizable across 2–3 Codex
builders + 1 reviewer per blueprint §6.3 → ~7–9 calendar weeks.

### N.2 Critical path

```
1 Event Store ─┬─> 3 Job Engine ─┬─> 5 Planner/Loop/DAG ─┐
2 Risk Model ──┘                 ├─> 11 Tool Runtime ─────┤
                                 ├─> 14 Approval ─────────┤
6 Provider Iface ─> 7 Capability Reg ─> 8 Quota ─┐        │
                                     └> 9 Circuit ┴> 10 Model Router ─> 12 Model Handoff ─> 13 Agent Handoff
                                                                                    │
18 Shift OS ─> 19 Resource Router ─> 20 Router Separation ──────────────────────────┤
                                                                                    v
15 Policy ─> 16 Comm Contract ─> 17 Subagents ────────────────> 21 Runtime Flow ─> 22 Observability ─> 23 Runbooks ─> 24 Rollups
```

Longest chain: `1 → 3 → 5 → 21 → 22 → 23 → 24` and `6 → 7 → 8/9 → 10 → 12 → 21`. Modules 6–9 can start on day 1
in parallel with 1–3. Module 21 is the integration gate; nothing after it starts until GOLDEN_001 + 15.5 pass.

### N.3 Decisions locked by this document (no open "consider")

1. **No second event bus.** `event_log` extended + monthly partitions. (§0.1, §J)
2. **No Redis.** Leases, locks, circuit state, quota counters are Postgres rows with `FOR UPDATE SKIP LOCKED` /
   advisory locks. (§0.1, §D.4)
3. **Per-stream `seq`** assigned by trigger with `SELECT ... FOR UPDATE` — gap-free, needed for `replayStream`. (§J)
4. **RiskLevel is one enum** R0–R4, defined once (§D.1), consumed everywhere (§K).
5. **Model lock scope default = `session`**; `run` scope only for engineering runs; `turn` never as default.
   ToolLoopLock is a boolean on `model_locks`, strictly stronger than the router. (§C.3)
6. **Free-first is a weight, not a rule** — `cost` term weight 2.5 + absolute privacy/capability/health filters
   first. Switching penalty 6.0 dominates minor score differences. (§C.6)
7. **Circuit trip** = 5 consecutive failures OR ≥50% error rate over 60s with ≥8 samples. Probe backoff 20s→×2→300s cap.
8. **JobClass policy table** (§D.4) is authoritative for lease TTL / retries / concurrency / backoff.
9. **HEAVY builds**: linux-home first, hetzner-cx53 burst only when linux-home `loadPerCpu > 0.85` and within the
   €15/mo CI ceiling; over ceiling → R3 owner approval. **vps-prod never runs HEAVY/EXCLUSIVE.** (§E.4)
10. **Emergency Handoff always checkpoints and waits for any in-flight side effect's idempotency record** before
    switching models — no exceptions, even for a hard provider outage. (§14.1)
11. **Structured Compaction** replaces classes 11/15/16 with a `CompactionState` block; never drops P0/P1. (§14.3)
12. **6 WhatsApp escalation cases only** (§I); everything else stays in Command Center.
13. **Owner 2FA required only for R4 + irreversible.** (§K)
14. **`trace_spans` + `event_log`** are both partitioned monthly; 30-day hot for spans, 13-month for events, then
    archive to Supabase storage as JSONL. Partition drop is the only delete path.

---

## O. TYPE INDEX (every requested contract, one place)

| Type | File | Section |
|---|---|---|
| `RoutingDecision` | `packages/model-router/types.ts` | C.1 |
| `ScoreBreakdown` | `packages/model-router/types.ts` | C.1 |
| `ModelCapabilityRecord` | `packages/model-router/types.ts` | C.1 |
| `QuotaState` | `packages/model-router/types.ts` | C.1 |
| `QuotaForecast` | `packages/model-router/types.ts` | C.1 |
| `ProviderHealth` | `packages/model-router/types.ts` | C.1 |
| `ProviderError` / `ProviderErrorClass` | `packages/model-router/types.ts` | C.1 |
| `CircuitBreakerState` / `CircuitState` | `packages/model-router/types.ts` | C.1 |
| `ModelProvider` (+ `GenerateRequest/Result`, `StreamChunk`) | `packages/model-router/providers/provider.ts` | C.7 |
| `GeminiProvider` / `GroqProvider` skeletons | `packages/model-router/providers/{gemini,groq}.ts` | C.7 |
| `Job` / `JobClass` / `JobState` | `packages/agent-runtime/jobs/types.ts` | D.3 |
| `AuthorityEnvelope` / `RiskLevel` | `packages/policy-engine/types.ts` | D.1 |
| `ApprovalRequest` | `packages/approval-engine/types.ts` | D.2 |
| `ExecutionPlan` / `PlanStep` / `VerificationSpec` | `packages/agent-runtime/planner/types.ts` | A.2 |
| `EvidenceItem` / `TaskStatus` / `CompletionAssessment` | `packages/agent-runtime/evidence/types.ts` | B.2 |
| `VerificationRun` / `VerificationDepth` | `packages/agent-runtime/verification/types.ts` | B.1 |
| `CommFrame` | `packages/agent-runtime/comm/types.ts` | B.3 |
| `AgentHandoffPackage` | `packages/agent-runtime/handoff/agent-handoff.ts` | B.5 |
| `TraceSpan` / `SpanKind` | `packages/agent-runtime/observability/types.ts` | L.1 |
| `HostSnapshot` / `PlacementInput` / `Placement` | `packages/shift-os/resource-router/place.ts` | E.4 |
| Routing `WEIGHTS` / penalties / `scoreCandidate` | `packages/model-router/scoring/score.ts` | C.6 |

## P. MIGRATION FILE MANIFEST

```
supabase/migrations/
  0001_orch_helpers.sql            app schema, app.current_org_id(), RLS macro doc
  0002_orch_planner.sql            execution_plans, execution_plan_steps
  0003_orch_evidence.sql           evidence, evidence_condition_map
  0004_orch_subagents.sql          agent_runs
  0005_orch_agent_handoffs.sql     agent_handoffs
  0010_orch_model_registry.sql     model_registry, model_scores, routing_decisions, model_locks
  0011_orch_quota.sql              provider_quotas, quota_ledger, drain_state
  0012_orch_circuit_breaker.sql    circuit_breaker_state, provider_health
  0020_orch_approvals.sql          approvals, approval_grants
  0021_orch_jobs.sql               agent_jobs, agent_job_events
  0030_orch_shift_os.sql           agent_shifts, agent_runtime_state, agent_work_sessions
  0031_orch_resource_router.sql    host_nodes, host_metrics, job_placements
  0040_orch_business_os_remainder.sql  agent_interactions, agent_usage, agent_session_usage, incidents, notifications
  0041_orch_event_log_ext.sql      event_log columns, seq trigger, append-only rules, partitioning
  0050_orch_tracing.sql            trace_spans
  0060_orch_seed.sql               host_nodes seed (mac/linux-home/hetzner-cx53/vps-prod), model_registry seed,
                                   policy_bands seed, agent_shifts seed for initial roster
```

Every file ends with the `RLS(<table>)` expansion for its tables and a matching `supabase/tests/<file>.sql`
pgTAP suite: (a) an insert as org A is invisible to org B, (b) every illegal state-machine transition raises,
(c) the module's one golden happy path.

## Q. WHAT THIS DOCUMENT DID NOT TOUCH (owned by other improve tracks)

Agent Birth pipeline internals (4.2–4.13), Prompt Compiler module contents, Memory architecture beyond the
read/write gate hooks in the runtime flow, Studio / Product Factory / Asset Engine, BrowserMesh adapter
internals (only its job/placement contract is specified here), Integrations OS channel adapters beyond
normalize/send hooks. All cross-references above name the seam; the deep design is in the sibling improve docs.
