# Deskcomm Agent OS — Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the existing Deskcomm CRM AI infrastructure into one governed, provider-agnostic Agent Operating System without replacing the CRM source of truth or creating a parallel architecture.

**Architecture:** Supabase/Postgres remains the source of truth. The existing `event_log`, `job_queue`, workers and `lib/agent-engine` are evolved rather than replaced. Agents decide; Skills encode procedures; Tools expose controlled capabilities; Policies enforce permissions; durable execution owns retries/checkpoints; observability/evals make every run explainable and promotable.

**Tech Stack:** Next.js, TypeScript, Supabase/PostgreSQL, existing Agent Engine, Vercel AI SDK 7 as initial inner-loop runtime, MCP, n8n at the integration edge, existing workers/event infrastructure. LangGraph is reserved for genuinely complex durable workflows. Inngest and Vercel Workflow remain future benchmark candidates, not Phase 1 dependencies.

## Global Constraints

- Do not create a second Agent Engine beside `lib/agent-engine`.
- Postgres/Supabase remains authoritative business state.
- `event_log` records business events; queues represent work to execute. Do not merge those concepts.
- No unrestricted `service_role` exposure to agents.
- Every side-effecting tool must support idempotency before autonomous use.
- Security is enforced by capabilities/policies, never by prompt text alone.
- All new autonomous behavior starts OFF/SHADOW; no customer-facing autonomy is enabled by this plan.
- Existing CRM, Inbox, WhatsApp, n8n and tenant behavior must remain backwards compatible unless a later approved plan explicitly changes it.
- Prefer adapters/ports over provider lock-in.
- Maker and checker remain separate for engineering governance.
- TDD, small reviewable tasks, evidence before completion, frequent commits.

---

# Delivery Map

```text
PHASE 1 — AGENT OS FOUNDATION
  1.1 Architecture Contracts
  1.2 Security Foundation
  1.3 Execution + Loop Safety
  1.4 Tool + Policy Foundation
  1.5 Observability + Model Certification
  1.6 Skill Foundation + Evals

PHASE 2 — AGENT KERNEL
PHASE 3 — FIRST PRODUCT AGENTS
PHASE 4 — SHADOW + EVALS
PHASE 5 — ASSISTED AUTONOMY
PHASE 6 — LEARNING FLYWHEEL
PHASE 7 — DURABLE EXECUTION BENCHMARK
PHASE 8 — CONTENT OS AGENTS
PHASE 9 — ENGINEERING AGENTS
```

Each sub-plan must receive an explicit GO before the next dependent plan is executed.

---

# PLAN 1.1 — Architecture Contracts

**Goal:** Freeze the canonical Agent OS vocabulary, boundaries and TypeScript contracts without changing production behavior.

## Target structure

```text
docs/architecture/agent-os/
  README.md
  agents.md
  execution.md
  tools.md
  skills.md
  policies.md
  memory.md
  models.md
  observability.md
```

The docs must define these canonical meanings:

- **Agent:** decides what should happen.
- **Skill:** procedural knowledge describing how to perform a class of task.
- **Tool:** executable capability with a typed input/output contract.
- **Policy:** deterministic authorization/risk decision outside the model.
- **Workflow:** durable sequence/state machine when a task needs persistence, waits or resumability.
- **Event:** immutable fact that something happened.
- **Job:** work that needs processing.
- **Memory:** derived persistent context, never a replacement for authoritative CRM data.
- **Run:** auditable execution instance of an agent/version.

## Contracts to introduce/evolve

```ts
type AgentRunStatus =
  | 'running'
  | 'waiting_approval'
  | 'completed'
  | 'blocked'
  | 'retryable_failure'
  | 'permanent_failure'
  | 'budget_exhausted'
  | 'policy_denied'
  | 'cancelled';

interface AgentLoopSpec {
  goal: string;
  maxSteps: number;
  maxToolCalls: number;
  maxTokens: number;
  maxCostCents: number;
  maxRuntimeMs: number;
  repeatedToolLimit: number;
  noProgressLimit: number;
}

interface ExecutionPort {
  start(input: unknown): Promise<unknown>;
  checkpoint(input: unknown): Promise<unknown>;
  pause(input: unknown): Promise<unknown>;
  resume(input: unknown): Promise<unknown>;
  complete(input: unknown): Promise<unknown>;
  fail(input: unknown): Promise<unknown>;
}
```

Exact final paths/signatures must follow existing repository conventions discovered during implementation; do not duplicate an equivalent existing type.

### Task 1: Inventory existing Agent Engine contracts

- [ ] Inspect `lib/agent-engine`, AI platform types, database types and existing specs for equivalent concepts.
- [ ] Produce a mapping of existing symbol -> canonical Agent OS concept.
- [ ] Identify conflicts/duplicates before creating files.
- [ ] Verify no runtime changes were made.
- [ ] Commit inventory/spec changes.

### Task 2: Add canonical architecture docs

- [ ] Write the nine architecture documents above.
- [ ] Explicitly document source-of-truth rules and ownership boundaries.
- [ ] Document which external technologies are core, optional adapters, or deferred benchmarks.
- [ ] Add diagrams for run lifecycle and tool authorization.
- [ ] Run documentation/link checks available in the repo.
- [ ] Commit.

### Task 3: Add/evolve shared contracts

- [ ] Write failing type/unit tests for terminal states and loop limits where runtime validation exists.
- [ ] Run tests and confirm expected failure.
- [ ] Add the minimal shared contracts, reusing existing types where possible.
- [ ] Run targeted tests/typecheck.
- [ ] Commit.

### Plan 1.1 GO gate

- [ ] No duplicate Agent Engine created.
- [ ] All canonical concepts have one documented owner.
- [ ] Existing production behavior unchanged.
- [ ] Typecheck/tests pass.
- [ ] Architecture docs and code contracts agree.

---

# PLAN 1.2 — Security Foundation

**Goal:** Remove privilege paths that would become dangerous once agents gain more autonomy.

## Scope

- Supabase `SECURITY DEFINER` review.
- `anon` / `authenticated` grants review.
- Stable `search_path` for privileged functions.
- RLS coverage and tenant isolation.
- OAuth/credential and cryptographic function exposure.
- Knowledge/LGPD privileged functions.
- Agent execution credentials and service-role boundaries.

### Task 1: Re-run and snapshot security baseline

- [ ] Run current Supabase security advisors against production project metadata.
- [ ] Record every finding relevant to agent autonomy.
- [ ] Classify each as exploitable, hardening, false positive or deferred with evidence.
- [ ] Commit the security baseline document only.

### Task 2: Privileged function hardening

- [ ] Write regression tests proving unauthorized roles cannot invoke targeted privileged functions.
- [ ] Verify tests fail before migration.
- [ ] Create minimal migration revoking inappropriate grants and fixing privileged `search_path` behavior.
- [ ] Run migration in safe/test environment according to repo doctrine.
- [ ] Re-run regression tests.
- [ ] Commit migration + tests.

### Task 3: Tenant isolation adversarial suite

Test at minimum:

```text
Tenant A -> Tenant B CRM row       DENY
Tenant A -> Tenant B agent run     DENY
Tenant A -> Tenant B skill state   DENY
Anonymous -> privileged function   DENY
Normal agent -> credentials        DENY
Normal agent -> admin mutation     DENY
```

- [ ] Add failing adversarial tests for uncovered paths.
- [ ] Implement minimum RLS/policy/grant corrections.
- [ ] Re-run complete isolation suite.
- [ ] Commit.

### Task 4: Agent credential boundary

- [ ] Inventory every place agent/worker code receives Supabase credentials.
- [ ] Define allowed capability boundary for agents.
- [ ] Add tests preventing direct unrestricted privileged database access from product-agent execution paths.
- [ ] Route privileged actions through controlled server capabilities where required.
- [ ] Commit.

### Plan 1.2 GO gate

- [ ] Critical agent-relevant advisor findings resolved or explicitly accepted with evidence.
- [ ] Tenant isolation adversarial tests pass.
- [ ] No product agent requires unrestricted database credentials.
- [ ] Existing CRM behavior passes regression suite.

---

# PLAN 1.3 — Execution + Loop Safety

**Goal:** Make runs bounded, resumable and safe under retries before increasing autonomy.

## Components

```text
ExecutionPort
DeskcommExecutionAdapter
AgentLoopSpec
LoopGuard pipeline
Idempotency contract
Checkpoint/resume contract
Terminal-state model
```

### Task 1: Terminal state machine

- [ ] Write failing tests for legal/illegal run-state transitions.
- [ ] Implement deterministic transition validation.
- [ ] Reject invalid transitions such as completed -> running without an explicit new run.
- [ ] Run tests.
- [ ] Commit.

### Task 2: Loop budget guards

Implement and independently test:

```text
MaxStepsGuard
MaxToolCallsGuard
MaxTokensGuard
MaxCostGuard
MaxRuntimeGuard
```

- [ ] One failing test per guard.
- [ ] Implement minimal guard pipeline.
- [ ] Verify correct stop reason for each budget.
- [ ] Commit.

### Task 3: Repetition and no-progress guards

- [ ] Test same tool + same normalized arguments repeated to configured limit.
- [ ] Test repeated model steps that produce no material state/progress change.
- [ ] Implement `RepeatedToolGuard`.
- [ ] Implement `NoProgressGuard` using deterministic fingerprints rather than model opinion.
- [ ] Verify terminal stop reasons.
- [ ] Commit.

### Task 4: Tool failure guard

- [ ] Test repeated failures from one tool/provider.
- [ ] Implement bounded retry/failure accounting.
- [ ] Ensure retryable vs permanent failures are distinguishable.
- [ ] Commit.

### Task 5: Idempotency contract

All side-effecting operations must be able to derive or receive an idempotency key from stable execution identity, conceptually:

```text
run_id + step_id + tool + business_target
```

- [ ] Inventory side-effecting capabilities (WhatsApp/email/webhooks/orders/proposals/discounts/content publication/refunds where present).
- [ ] Write duplicate-delivery regression tests for existing supported side effects.
- [ ] Implement/adapt idempotency enforcement without changing successful single execution behavior.
- [ ] Commit.

### Task 6: Deskcomm Execution adapter

- [ ] Write tests for start/checkpoint/pause/resume/complete/fail semantics against current `event_log`, `job_queue` and worker patterns.
- [ ] Implement `DeskcommExecutionAdapter` behind `ExecutionPort` using existing infrastructure.
- [ ] Simulate worker interruption after checkpoint and prove resume does not replay completed side effects.
- [ ] Commit.

### Plan 1.3 GO gate

- [ ] Infinite/repetitive loops terminate deterministically.
- [ ] Cost/token/time/tool budgets are enforced outside model reasoning.
- [ ] Worker interruption can resume safely.
- [ ] Retried side effects do not duplicate supported operations.
- [ ] Stop reason is always recorded.

---

# PLAN 1.4 — Tool + Policy Foundation

**Goal:** Make every agent capability explicit, typed, risk-classified and policy-controlled.

## Risk model

```text
R0 READ
R1 REVERSIBLE_WRITE
R2 EXTERNAL_COMMUNICATION
R3 SENSITIVE_COMMERCIAL
R4 DESTRUCTIVE_ADMIN
```

## Policy decisions

```ts
type PolicyDecision =
  | { kind: 'allow' }
  | { kind: 'deny'; reason: string }
  | { kind: 'require_approval'; reason: string; approvalType: string };
```

### Task 1: Tool inventory and registry contract

- [ ] Inventory current MCP/API/internal agent capabilities.
- [ ] Assign each existing capability an owner and risk level.
- [ ] Define typed `ToolDefinition` metadata: id, schema, risk, sideEffect, idempotencyRequired, timeout, retry policy.
- [ ] Add registry tests for duplicate IDs and invalid metadata.
- [ ] Commit.

### Task 2: Policy engine core

- [ ] Write failing tests for ALLOW, DENY and REQUIRE_APPROVAL.
- [ ] Implement deterministic policy evaluation based on tenant, agent, tool, risk and autonomy level.
- [ ] Ensure model output cannot override the decision.
- [ ] Commit.

### Task 3: Approval contract

- [ ] Define approval request/status model compatible with durable pause/resume.
- [ ] Test R3 action pauses when policy requires approval.
- [ ] Test denial terminates/returns controlled result without executing tool.
- [ ] Implement minimum approval gate, not a full UI unless existing patterns require it.
- [ ] Commit.

### Task 4: MCP through Tool Gateway

- [ ] Write tests proving MCP-exposed tools receive the same policy/risk/idempotency checks as internal tools.
- [ ] Route relevant MCP invocation path through Tool Gateway.
- [ ] Verify direct bypass is not possible through supported agent path.
- [ ] Commit.

### Task 5: Kill switches and autonomy levels

Support:

```text
OFF
SHADOW
DRAFT
ASSISTED
AUTOPILOT_LOW_RISK
AUTOPILOT_EXPANDED
```

- [ ] Reuse existing feature-flag infrastructure where possible.
- [ ] Test global, tenant, agent and capability-level disable paths.
- [ ] Test SHADOW produces decisions/traces but no side effects.
- [ ] Commit.

### Plan 1.4 GO gate

- [ ] Every agent tool has explicit risk metadata.
- [ ] R4 cannot be autonomously executed.
- [ ] Sensitive actions can require durable approval.
- [ ] MCP cannot bypass policy.
- [ ] Kill switch works without deploy.
- [ ] SHADOW is safe by construction.

---

# PLAN 1.5 — Observability + Model Certification

**Goal:** Make every run explainable end-to-end and prevent routing to models/providers that lack required capabilities.

## Trace identity

Every applicable path should preserve:

```text
organization_id
event_id
job_id
run_id
trace_id
correlation_id
```

### Task 1: Trace-context contract

- [ ] Inventory current correlation/run IDs.
- [ ] Define one trace-context type and propagation rules.
- [ ] Write tests for event -> job -> run -> tool propagation.
- [ ] Implement minimal propagation changes.
- [ ] Commit.

### Task 2: RunRecorder

Record at minimum:

```text
agent + version
trigger
context source identifiers
activated skill versions
model/provider
steps
tool calls
policy decisions
approvals
retries
tokens
cost
latency
verification
stop reason
```

- [ ] Write tests for complete and failed run recording.
- [ ] Implement using existing `ai_agent_runs` / invocation infrastructure rather than parallel storage.
- [ ] Verify tenant isolation.
- [ ] Commit.

### Task 3: Provider failure/fallback events

- [ ] Test provider failure emits explicit event.
- [ ] Test fallback start/success/failure are separately observable.
- [ ] Ensure resumed/fallback execution knows it is continuing a prior attempt.
- [ ] Commit.

### Task 4: Model capability registry

Capabilities initially include:

```text
tool_calling
structured_output
vision
reasoning
parallel_tools
long_context
streaming
```

Certification states:

```text
EXPERIMENTAL
CERTIFIED
DISABLED
```

- [ ] Extend existing model metadata rather than creating duplicate model tables.
- [ ] Write router tests rejecting incompatible/uncertified models.
- [ ] Implement capability filtering before price/quality ranking.
- [ ] Commit.

### Task 5: Provider certification suite

Test sequence:

```text
connection
structured output
tool calling
tool failure
timeout
fallback
golden agent cases
```

- [ ] Build deterministic certification harness around provider adapters.
- [ ] Never run destructive real-world tools in certification.
- [ ] Persist certification evidence/status.
- [ ] Commit.

### Task 6: Vercel/operational telemetry bridge

- [ ] Map internal trace IDs to available Vercel AI/agent telemetry without making Vercel the source of truth.
- [ ] Verify one test run can be correlated between internal run record and external telemetry where supported.
- [ ] Document degradation behavior when external telemetry is unavailable.
- [ ] Commit.

### Plan 1.5 GO gate

- [ ] Any run can be traced from trigger to terminal state.
- [ ] Provider fallback is never invisible.
- [ ] Router cannot choose an uncertified/incompatible model for a required capability.
- [ ] Cost/token/latency are attributable to run/model/provider.

---

# PLAN 1.6 — Skill Foundation + Evals

**Goal:** Establish governed, versioned, progressively disclosed skills and the baseline eval system before product agents depend on them.

## Skill lifecycle

```text
DRAFT
EVALUATING
APPROVED
SHADOW
CANARY
ACTIVE
DEPRECATED
```

## Canonical skill contract

```text
name
version
description
domain
owner
risk
goal
when_to_use
when_not_to_use
required_context
procedure
allowed_tools
forbidden_actions
output_schema
verification
failure_handling
escalation
examples
counterexamples
evals
```

### Task 1: Skill schema and lifecycle

- [ ] Map existing `skill_versions`, pointers and activations to canonical lifecycle.
- [ ] Write tests for legal/illegal lifecycle transitions.
- [ ] Implement minimum lifecycle enforcement without replacing existing tables unnecessarily.
- [ ] Commit.

### Task 2: Skill Registry

- [ ] Define registry APIs for lookup by ID/version/domain/status.
- [ ] Test tenant/system skill visibility boundaries.
- [ ] Implement against existing storage.
- [ ] Commit.

### Task 3: Progressive disclosure

Agent context stages:

```text
1. compact name + description
2. full skill only when selected
3. specific references/resources only when needed
```

- [ ] Write tests proving unselected full skill content is not injected.
- [ ] Implement `SkillMatcher`/`SkillLoader` boundaries.
- [ ] Add `maxSkillLoads` and `maxSkillContextTokens` limits.
- [ ] Commit.

### Task 4: Skill/tool compatibility

- [ ] Test a skill cannot activate a tool outside the agent/policy allowlist.
- [ ] Test skill-declared forbidden actions remain blocked.
- [ ] Implement intersection: agent capabilities ∩ skill needs ∩ policy decision.
- [ ] Commit.

### Task 5: Baseline golden eval dataset

Include at minimum:

```text
customer asks price
customer wants cancellation
angry customer
interested lead
lead without budget
discount request
ambiguous message
prompt injection
cross-tenant data request
credential request
destructive request
repeated tool-loop scenario
provider failure scenario
```

For each case define expected facts, allowed tools, forbidden actions, expected escalation/policy outcome and scoring criteria.

- [ ] Create versioned dataset using existing eval/flywheel infrastructure.
- [ ] Add deterministic policy/security assertions before subjective judge scoring.
- [ ] Commit.

### Task 6: Skill promotion gate

- [ ] Test DRAFT cannot jump directly to ACTIVE.
- [ ] Require eval evidence for promotion into APPROVED/SHADOW/CANARY/ACTIVE according to lifecycle rules.
- [ ] Implement rollback by pointer/version rather than destructive overwrite.
- [ ] Commit.

### Plan 1.6 GO gate

- [ ] Skills are versioned and rollbackable.
- [ ] Progressive disclosure is enforced.
- [ ] Skill cannot grant itself new tools.
- [ ] Baseline eval dataset exists and runs.
- [ ] No skill can self-promote directly into production.

---

# PHASE 1 FINAL GO / NO-GO

Phase 1 is complete only when all statements below have executable evidence:

```text
Agent cannot exceed configured budget.
Repeated/no-progress loop stops deterministically.
Unauthorized tool is blocked outside the model.
Sensitive tool can require approval.
Retry does not duplicate supported side effects.
Tenant A cannot access Tenant B through agent infrastructure.
A run is traceable end-to-end.
Incompatible/uncertified model is not selected.
Provider failure/fallback is explicit.
Global/tenant/agent/tool kill switch works.
Skill has version + governed lifecycle.
No new customer-facing autonomous behavior was enabled.
```

Only after this gate may Phase 2 implementation begin.

---

# PHASE 2 — Agent Kernel

**Status (2026-08-18): GO.** Final Phase 2 code SHA `faa57fa11ef0bd5bd29f6eec759fe92c6a488db3` passed the Lumenva Preview gate with typecheck, 30/30 Agent OS test files, 116/116 tests, Next.js production build and Vercel `READY`. Evidence: `docs/architecture/agent-os/phase-2-verification.md`. Customer-facing autonomy remains OFF/SHADOW and no production deployment was performed.

**Goal:** Implement one canonical `AgentKernel.run()` on top of Phase 1 primitives.

Target responsibilities:

```text
resolve agent/version
resolve execution context
load authoritative CRM context
match/load bounded skills
resolve allowed tools
select certified model
execute bounded AI SDK loop
apply policies before tools
checkpoint durable state
request/pause for approval when required
verify outcome
record evidence
write permitted memory
emit events
terminate explicitly
```

The first runtime adapter is Vercel AI SDK 7. The kernel must depend on internal ports, not Vercel-specific types at its public boundary.

GO gate:

- [x] one synthetic/read-only agent can run end-to-end;
- [x] all Phase 1 guards remain enforced;
- [x] runtime adapter can be replaced in tests;
- [x] no direct model/tool bypass path exists.

---

# PHASE 3 — First Product Agents

Introduce agents gradually, all initially SHADOW:

```text
Supervisor
Atendimento
Sales
Retention
Escalation
CRM Operator
Governance/Judge
```

Do not turn Memory, Analytics, Integrations or Model Router into agents; they remain deterministic services/capabilities.

Implementation order:

1. Supervisor routing in SHADOW.
2. Atendimento read-only/draft behavior.
3. Sales qualification/draft behavior.
4. Escalation decisioning.
5. CRM Operator for explicitly allowed R1 mutations.
6. Retention.
7. Governance/Judge evaluation path.

GO gate: each agent passes domain golden cases before progressing beyond SHADOW.

---

# PHASE 4 — Shadow + Evals

**Goal:** Compare agent decisions against existing/human behavior without customer-visible side effects.

Measure:

```text
routing accuracy
factual accuracy
tool-selection accuracy
policy compliance
escalation correctness
latency
tokens
cost
failure rate
loop-stop rate
```

No promotion based only on LLM judge score. Deterministic policy/security checks are hard gates.

---

# PHASE 5 — Assisted Autonomy

Progress selected capabilities:

```text
SHADOW -> DRAFT -> ASSISTED
```

Low-risk R0/R1 capabilities may become automatic only after eval evidence. R2/R3 remain policy/approval controlled. R4 remains non-autonomous.

Every promotion is tenant/agent/capability scoped and rollbackable without deploy.

---

# PHASE 6 — Learning Flywheel

**Goal:** Learn from runs without allowing uncontrolled self-modification.

```text
Run
 -> Judge
 -> Root-cause classification
 -> Candidate change
 -> Eval
 -> Regression
 -> Shadow
 -> Canary
 -> Human/policy promotion
 -> Active
```

Candidate types:

```text
prompt
skill
policy suggestion
memory correction
model-routing adjustment
```

Agents may propose candidates; they may not directly mutate ACTIVE production skills/policies.

---

# PHASE 7 — Durable Execution Benchmark

**Do not implement this benchmark before real SHADOW/ASSISTED workloads exist.**

Compare the same real CRM journey using:

```text
A. Deskcomm event_log + job_queue + workers
B. Inngest
C. Vercel Workflow
```

Scenario must include:

```text
message trigger
agent decision
CRM read
tool failure + retry
human approval wait
resume
external side effect
worker/process interruption
recovery
idempotency verification
```

Measure:

```text
correctness
recovery behavior
exactly-once/idempotent behavior
operational complexity
lines/amount of custom code
observability
latency
cost
self-hosting fit
multi-tenancy fit
vendor lock-in
migration complexity
```

Decision rule: do not adopt an external durable runtime unless it produces a material, evidenced improvement over the existing adapter.

---

# PHASE 8 — Content OS Agents

Preserve the existing Content OS architecture/plans; do not create a second agent platform.

```text
Content Supervisor
  -> Research skills
  -> Strategy skills
  -> Brand skills
  -> Copy skills
  -> Script skills
  -> Creative skills
  -> Distribution skills
```

Foundation, Intelligence, Creative Studio, Distribution and Product UI remain domain modules. Creative providers such as ComfyUI/video composition stay behind adapters/workers. Content agents consume the same Agent Kernel, Skill OS, Tool Gateway, Policies, Execution and Observability.

---

# PHASE 9 — Engineering Agents

Keep Product Agent OS and Engineering Agent OS separated by permissions and runtime environment.

Build on existing `CLAUDE.md`, `AGENTS.md`, `.claude/rules`, skills and `loop/` governance.

Target roles:

```text
Engineering Supervisor
Planner
Implementer
Test Engineer
Reviewer
Security Reviewer
Migration Reviewer
Release Agent
```

Canonical engineering loop:

```text
issue/spec
 -> plan
 -> isolated worktree
 -> implement
 -> test
 -> independent checker
 -> evidence
 -> bounded repair
 -> human gate
 -> PR/merge
```

Rules:

- maker != checker;
- sessions disposable, artifacts/state durable;
- no infinite repair loops;
- security/migration reviewers are conditional specialists, not always-on duplicate reviewers;
- coding agents receive sandboxed/restricted credentials;
- production merge remains governed until separately approved.

---

# Explicit Technology Decisions

## Core now

```text
Supabase/Postgres          source of truth
existing event_log         business events
existing job_queue/workers initial execution layer
existing Agent Engine      evolved into Agent OS foundation
Vercel AI SDK 7            initial inner agent loop
MCP / controlled APIs      tool integration
n8n                         edge/external automation
```

## Use selectively

```text
LangGraph                   complex durable stateful workflows only
Mem0                        optional memory projection only
Graphiti                    optional graph projection only
```

## Learn from, do not make core

```text
Hermes Agent                skills/memory/learning-loop patterns
OpenAI Agents SDK           runtime/sandbox/tooling reference and future adapter candidate
Claude/other agent SDKs     future adapters where evidence justifies them
```

## Deferred benchmark

```text
Inngest
Vercel Workflow
```

## Explicitly avoid

```text
one framework owning all CRM state
16+ services merely because there are 16 logical roles
free-form agent-to-agent chatter as the primary architecture
n8n as the reasoning brain
LLM memory as source of truth
agents with unrestricted service_role
skills self-promoting into production
prompt-only security
unbounded loops
all tools exposed to every agent
hidden provider fallback
```

---

# Definition of Done for the Agent OS Program

The program is not considered complete because an agent can answer a prompt. It is complete when the system can demonstrate:

- deterministic tenant and permission isolation;
- bounded cost/time/steps;
- resumable execution with safe retries;
- explicit tool risk and approval controls;
- end-to-end traceability;
- model capability certification and visible fallback;
- versioned/rollbackable skills;
- eval-driven promotion;
- safe SHADOW/CANARY/autonomy controls;
- governed learning rather than uncontrolled self-modification;
- shared Agent OS foundations reused by CRM, Content OS and future domains;
- engineering agents isolated from product agents and governed by maker/checker evidence loops.

No phase may weaken existing CRM safety guarantees to make an agent demo easier.