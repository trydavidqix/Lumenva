# Agent OS Phase 7 — Durable Benchmark Execution Status

Status date: 2026-08-18

## Safety/runtime constraints

- Work is confined to `agent-os-phase-7-durable-benchmark`.
- `main`, production, billing, secrets, real external communications, authoritative CRM state and remote migrations are out of scope.
- GitHub Actions are prohibited.
- Vercel Preview deployments are prohibited.
- The user is not a terminal/test runner.
- Any test/typecheck/build result is `UNVERIFIED` unless produced by an approved non-Preview, non-GitHub-Actions executable runner.
- Missing real-provider evidence must result in `INCOMPLETE`, never a simulated provider claim.

## Current implementation state

### Task 1 — contracts

Implementation exists in `lib/agent-engine/durable-benchmark/contracts.ts` with unit contract coverage. Historical runner evidence predates the stricter no-Preview rule; do not reuse it as final Phase 7 evidence.

### Task 2 — scenarios/fault plan

Eight versioned synthetic scenarios and deterministic fault injection exist in `scenarios.ts` / `fault-plan.ts`. Current code-level state is present; executable status under the approved workflow is `UNVERIFIED`.

### Task 3 — current Deskcomm adapter

Added an isolated synthetic effect store and current-engine adapter. The adapter reuses `DeskcommExecutionAdapter`, its checkpoint/pause/resume persistence contract, `shouldExecuteSideEffect`, and the canonical Agent OS idempotency-key derivation. Synthetic effects reject non-`bench-org-*` organizations and never route to CRM/channel tools. Tests are written but `UNVERIFIED`.

### Task 4 — Inngest

Added the provider invocation boundary and normalization adapter. Official Inngest v4 semantics were rechecked: retriable/checkpointed work uses `step.run()` and approval-style durable pauses use `step.waitForEvent()`. No SDK dependency or native function is claimed as verified because no approved executable runner / isolated real provider execution is currently available. Real-provider status: `INCOMPLETE`.

### Task 5 — Workflow SDK

Added the provider invocation boundary and normalization adapter. Official Workflow SDK architecture was rechecked around `"use workflow"` orchestration and `"use step"` effectful steps. No Vercel Preview is permitted and no approved alternative executable Workflow environment is currently connected. Real-provider status: `INCOMPLETE`.

### Task 6 — orchestration harness

Added bounded `small` / `medium` / `stress` concurrency profiles and deterministic scenario/repetition identities. Adapter failures are normalized per run rather than mutating or skipping competitor scenarios. Tests are written but `UNVERIFIED`.

### Task 7 — hard gates

Added deterministic fail-closed gates for tenant isolation, exactly-once effects, crash recovery, resume position, approval, approval rejection/expiry, retry limits, terminal truth and reconstructable evidence. Tests are written but `UNVERIFIED`.

### Task 8 — scoring

Added fixed weighted scoring and the 10-point material-improvement rule. Missing real-provider evidence returns `INCOMPLETE`; external engines cannot be recommended without evidence and hard-gate eligibility. Tests are written but `UNVERIFIED`.

## Remaining work

- Task 9 evidence serializer / CLI / regression coverage.
- Task 10 architecture + verification evidence and final decision.
- Native Inngest function and real isolated Inngest execution, if an approved connected execution path becomes available.
- Native Workflow SDK workflow and real execution through a permitted non-Preview path, if available.
- Approved executable typecheck/tests/build gate.

Until those execution requirements are satisfied, Phase 7 must not claim `KEEP_CURRENT` or any `ADOPT_*` result from code inspection alone. The safe terminal decision remains `INCOMPLETE` if no permitted executable evidence path becomes available.
