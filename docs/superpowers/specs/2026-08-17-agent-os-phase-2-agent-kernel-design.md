# Agent OS Phase 2 — Agent Kernel Design

Status: APPROVED DESIGN
Date: 2026-08-17
Branch: `agent-os-implementation-plan`

## Purpose

Implement one canonical `AgentKernel.run()` on top of the Phase 1 Agent OS primitives. The kernel is an orchestration layer, not a second agent engine. It composes existing execution, policy, tool, skill, model, observability and memory capabilities from `lib/agent-engine` and preserves Supabase/Postgres as authoritative business state.

## Design decision

Use a thin orchestration kernel over internal ports. Do not create a monolithic runtime and do not create a parallel engine that would later require migration. The public kernel boundary must remain provider-agnostic; Vercel AI SDK 7 is the first inner-loop adapter only.

## Canonical flow

`AgentKernel.run()` performs this ordered flow:

1. resolve organization, agent and version;
2. resolve execution identity and trace context;
3. load authoritative CRM context;
4. load bounded skills through the Phase 1 skill registry;
5. resolve allowed tools through Tool Gateway;
6. select a certified model/provider compatible with required capabilities;
7. start or resume the durable execution record;
8. execute a bounded model/tool loop;
9. evaluate deterministic policy before every tool invocation;
10. checkpoint after material progress and side-effect boundaries;
11. pause durably when approval is required;
12. resume without replaying completed side effects;
13. verify the outcome before successful completion;
14. record evidence and telemetry;
15. write only permitted derived memory;
16. emit business events separately from queued work;
17. terminate with an explicit terminal state and stop reason.

## Public boundary

The intended public API is conceptually:

```ts
interface AgentKernel {
  run(input: AgentKernelInput): Promise<AgentKernelResult>;
}
```

Exact symbols and paths must reuse repository conventions discovered during implementation. Public input/result types must not expose Vercel AI SDK-specific types.

The kernel receives dependencies through internal ports/adapters. At minimum, composition requires resolvers for agent/version, CRM context, skills, tools, policies, certified models, durable execution, runtime loop, verification, run recording, memory and business events.

## Phase 2 delivery slices

### 2.1 Kernel Contracts and Composition Root

Inventory current `lib/agent-engine` orchestration paths and equivalent contracts before adding symbols. Add contract tests first. Introduce only missing kernel-facing contracts and one composition root. No customer-visible behavior change.

### 2.2 Agent, Version and Execution Context Resolution

Resolve organization, agent, effective version, trigger, run identity and trace context. Reject cross-tenant references, disabled/invalid versions and incompatible execution context before any model request or tool resolution.

### 2.3 Authoritative Context and Skills

Load CRM state from authoritative data sources. Derived memory may enrich context but cannot replace CRM truth. Skills are selected from the Phase 1 registry, respect lifecycle/promotion rules and progressive disclosure, and are bounded by context limits.

### 2.4 Tool Gateway and Policy

Only tools allowed by tenant, agent, version and autonomy level enter the runtime toolset. Every invocation is re-checked by deterministic policy. R3 can require durable approval. R4 is never autonomously executable. SHADOW records decisions/traces but cannot perform side effects.

### 2.5 Certified Model Router and AI SDK Adapter

Model selection filters by capability and certification before quality/price preference. The AI SDK adapter lives behind an internal runtime port so provider/runtime-specific types do not leak into the kernel boundary. Provider fallback must remain observable and correlated to the same run.

### 2.6 Bounded Agent Loop

Enforce Phase 1 limits outside model reasoning: maximum steps, tool calls, tokens, cost, runtime, repeated tools, no-progress and tool failures. Every stop path yields a deterministic terminal state/reason. Infinite/repetitive execution is impossible by construction within configured budgets.

### 2.7 Durable Checkpoint, Approval and Resume

Checkpoint after material progress and before/after side-effect boundaries according to existing execution doctrine. Approval pauses are durable. Resume continues the same execution identity and does not replay completed effects. Simulate worker interruption after a checkpoint and prove safe continuation.

### 2.8 Verification, Evidence, Memory and Events

A run may only become `completed` after outcome verification appropriate to the task. RunRecorder captures the full execution evidence. Only policy-permitted derived memory may be written. Business events remain immutable facts; jobs remain units of work and are not conflated.

### 2.9 Integration Gate

The kernel must pass integration contracts covering: happy path, tenant denial, policy denial, approval pause/resume, SHADOW, certified model selection, provider fallback, retryable tool failure, idempotent replay protection, budget exhaustion, no-progress termination, crash/resume, evidence completeness and explicit terminal states.

## Error handling

Errors are classified rather than collapsed into generic failure. Expected terminal classes include policy denial, budget exhaustion, retryable failure, permanent failure, waiting approval, blocked, cancelled and completed. Provider/runtime faults must preserve whether they are retryable. Tool failures must not bypass policy or idempotency on retry. Unknown/unclassified errors fail closed and are recorded with trace identity.

## Data and security boundaries

- Supabase/Postgres remains authoritative business state.
- No product-agent path receives unrestricted database credentials.
- Tenant isolation is validated before context/model/tool resolution.
- Security decisions are deterministic code outside the model.
- Side-effecting tools require stable idempotency identity.
- No autonomous R4 execution.
- SHADOW cannot cause external or business side effects.
- No production autonomy is enabled by Phase 2.

## Testing strategy

Use TDD for every behavior change. Each slice starts with targeted RED contract/unit/integration tests and reaches GREEN with the minimum implementation. Prefer existing Agent OS Vitest configuration and repository test patterns. Add end-to-end kernel contract tests without using destructive real-world tools.

Final verification must include, where applicable:

- targeted Phase 2 tests;
- complete Agent OS contract suite;
- typecheck;
- affected repository regression suites;
- Next.js production build;
- one final Vercel Preview gate only if necessary for runtime/deployment verification.

Intermediate previews are intentionally avoided to reduce deployment-rate pressure.

## Autonomous execution policy for this phase

Within `agent-os-implementation-plan`, implementation may proceed without further user permission for code/tests/docs/refactors directly required by Phase 2, including fixing defects discovered during the work. Technical failures such as test regressions, merge conflicts, transient GitHub/Vercel errors, type errors and mismatches between historical docs and current code are to be investigated and resolved as part of the work rather than escalated immediately.

The work must stop for user action only when continuation would require crossing a protected boundary that is not already authorized, including:

- merging or writing to `main`;
- production deployment or enabling customer-facing autonomy;
- billing/spend decisions beyond existing test-safe usage;
- creating/rotating/exposing secrets or credentials;
- applying migrations to a remote/production Supabase project;
- sending real external communications or executing destructive external actions.

Migrations may be authored and verified in safe/local/disposable environments, but not applied remotely without separate authorization.

## Completion criteria

Phase 2 is GO only when one canonical `AgentKernel.run()` composes Phase 1 primitives and proves, with fresh verification evidence:

- no second Agent Engine exists;
- tenant boundaries are enforced before execution;
- only allowed tools can be invoked;
- policy cannot be overridden by model output;
- SHADOW has zero side effects;
- R4 cannot execute autonomously;
- approved pauses resume durably;
- retries do not duplicate supported side effects;
- budgets and no-progress guards terminate deterministically;
- uncertified/incompatible models are rejected;
- provider fallback remains observable;
- crash/resume preserves completed work;
- every terminal path records an explicit stop reason and evidence;
- typecheck, Agent OS tests, affected regressions and build are green.

Only after this gate may Phase 3 begin.
