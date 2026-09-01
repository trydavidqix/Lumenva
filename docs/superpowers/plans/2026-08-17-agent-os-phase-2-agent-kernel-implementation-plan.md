# Agent OS Phase 2 — Agent Kernel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement one canonical, provider-agnostic `AgentKernel.run()` that composes the Phase 1 Agent OS primitives into a bounded, policy-controlled, observable and resumable execution path.

**Architecture:** Build a thin orchestration kernel inside `lib/agent-engine` rather than a second runtime. The kernel composes existing resolvers, execution guards, skill governance, tool policy, model certification, run recording, memory and event infrastructure through internal ports; Vercel AI SDK 7 remains an adapter behind the public boundary. Every behavior change follows TDD and every side effect remains policy/idempotency guarded.

**Tech Stack:** TypeScript, Next.js, existing `lib/agent-engine`, Supabase/PostgreSQL contracts, Vercel AI SDK 7 adapter, Vitest via `vitest.agent-os.config.ts`, existing execution/observability/model/policy/skill primitives.

## Global Constraints

- Do not create a second Agent Engine beside `lib/agent-engine`.
- Supabase/Postgres remains authoritative business state.
- Do not merge business events and queued work into one abstraction.
- No unrestricted `service_role` exposure to product-agent execution paths.
- Every side-effecting tool must retain stable idempotency identity.
- Security and autonomy decisions are deterministic code outside model output.
- All new autonomy remains OFF/SHADOW; no customer-facing autonomous side effects are enabled.
- Public kernel types must not expose Vercel AI SDK-specific types.
- R4 destructive/admin actions are never autonomously executable.
- SHADOW must have zero side effects by construction.
- Do not write to `main`, deploy production, alter billing/secrets, send real external communications, or apply remote/production migrations.
- Intermediate Vercel previews are intentionally avoided; use one final preview only if required by the final integration gate.
- TDD, small reviewable commits, root-cause debugging before fixes, fresh verification before completion.

---

## File Structure Map

The exact implementation must reuse equivalent existing files when discovered. Preferred ownership is:

```text
lib/agent-engine/kernel/
  contracts.ts              # public/internal kernel input/result contracts
  ports.ts                  # provider-agnostic dependencies consumed by kernel
  agent-kernel.ts           # orchestration only
  composition.ts            # wires existing Phase 1 implementations to ports
  resolution.ts             # tenant/agent/version/execution-context resolution
  context-loader.ts         # authoritative CRM + bounded derived context
  runtime-adapter.ts        # provider-agnostic runtime port + AI SDK adapter wrapper
  verification.ts           # outcome verification orchestration

lib/agent-engine/contracts/
  agent-kernel-contract.test.ts
  agent-kernel-resolution.test.ts
  agent-kernel-context.test.ts
  agent-kernel-policy.test.ts
  agent-kernel-model.test.ts
  agent-kernel-loop.test.ts
  agent-kernel-resume.test.ts
  agent-kernel-evidence.test.ts
  agent-kernel-integration.test.ts
```

Existing Phase 1 modules remain authoritative for loop guards, execution state, skill governance, policy/risk, model certification, trace/run recording and memory. If an equivalent module already exists, modify/adapt it instead of adding the preferred file above.

---

### Task 1: Inventory Current Runtime and Lock Kernel Contracts

**Files:**
- Inspect: `lib/agent-engine/**`
- Create or modify: `lib/agent-engine/kernel/contracts.ts`
- Create or modify: `lib/agent-engine/kernel/ports.ts`
- Test: `lib/agent-engine/contracts/agent-kernel-contract.test.ts`
- Update evidence: `docs/architecture/agent-os/README.md` only if ownership wording needs clarification

**Interfaces:**
- Produces: `AgentKernel`, `AgentKernelInput`, `AgentKernelResult`, `AgentKernelDependencies`
- Public contract: `run(input: AgentKernelInput): Promise<AgentKernelResult>`
- `AgentKernelResult` must always expose an explicit terminal/non-terminal status and stop reason; it must not expose AI SDK types.

- [ ] **Step 1: Inventory equivalent symbols before creating files**

Search `lib/agent-engine`, current runtime files, Phase 1 contracts and tests for existing kernel-like orchestration, run input/output, execution context and dependency interfaces. Record the mapping in the implementation commit message or a short code comment where reuse is non-obvious. Do not duplicate an equivalent type.

- [ ] **Step 2: Write the failing kernel contract test**

Add a test shaped like:

```ts
import { describe, expect, it } from "vitest";
import type { AgentKernel, AgentKernelInput, AgentKernelResult } from "../kernel/contracts";

describe("AgentKernel contract", () => {
  it("keeps the public boundary provider-agnostic and returns an explicit stop reason", async () => {
    const input: AgentKernelInput = {
      organizationId: "org-a",
      agentId: "agent-a",
      trigger: { kind: "test", sourceId: "source-a" },
      goal: "classify the lead",
    };

    const kernel: AgentKernel = {
      run: async (): Promise<AgentKernelResult> => ({
        status: "completed",
        stopReason: "goal_completed",
        runId: "run-a",
        traceId: "trace-a",
      }),
    };

    await expect(kernel.run(input)).resolves.toMatchObject({
      status: "completed",
      stopReason: "goal_completed",
    });
  });
});
```

The exact trigger shape may be adapted to an existing canonical type, but the test must prove the public boundary does not depend on AI SDK objects.

- [ ] **Step 3: Run the test and confirm RED**

Run:

```bash
pnpm exec vitest run --config vitest.agent-os.config.ts lib/agent-engine/contracts/agent-kernel-contract.test.ts
```

Expected: FAIL because the kernel contract/module does not yet exist or lacks the required explicit result semantics.

- [ ] **Step 4: Implement the minimal provider-agnostic contracts**

Define only the types needed by the contract. Reuse existing `AgentRunStatus`, trace identifiers and stop-reason types where present. Do not introduce a parallel status enum.

- [ ] **Step 5: Re-run targeted test and typecheck**

```bash
pnpm exec vitest run --config vitest.agent-os.config.ts lib/agent-engine/contracts/agent-kernel-contract.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/agent-engine/kernel lib/agent-engine/contracts/agent-kernel-contract.test.ts docs/architecture/agent-os/README.md
git commit -m "feat(agent-os): define Agent Kernel contracts"
```

---

### Task 2: Resolve Tenant, Agent, Version and Execution Identity Before Runtime

**Files:**
- Create or modify: `lib/agent-engine/kernel/resolution.ts`
- Modify/reuse: existing agent/version repository or resolver under `lib/agent-engine/agent/**` and `lib/agent-engine/db/**`
- Modify/reuse: `lib/agent-engine/obs/trace-context.ts`
- Test: `lib/agent-engine/contracts/agent-kernel-resolution.test.ts`

**Interfaces:**
- Consumes: `AgentKernelInput`
- Produces: `ResolvedKernelExecution` containing authoritative `organizationId`, `agentId`, effective version, `runId`, `traceId`, `correlationId`, trigger identity and autonomy state.
- Failure must occur before model/tool resolution for cross-tenant, disabled or invalid versions.

- [ ] **Step 1: Write RED tests for invalid resolution paths**

Cover at minimum:

```ts
it("rejects an agent that belongs to another tenant before model resolution", ...)
it("rejects a disabled or invalid effective version", ...)
it("creates or preserves run/trace/correlation identity for a valid execution", ...)
```

Use injected fake repositories/ports rather than network or production data.

- [ ] **Step 2: Run targeted resolution tests and verify RED**

```bash
pnpm exec vitest run --config vitest.agent-os.config.ts lib/agent-engine/contracts/agent-kernel-resolution.test.ts
```

Expected: FAIL for missing resolution orchestration.

- [ ] **Step 3: Implement the minimum resolver**

Resolve tenant ownership first, then effective agent version, then execution identity. Do not call model selection, skill loading or tool resolution until this function succeeds.

- [ ] **Step 4: Prove fail-closed ordering**

Add spies/counters in the test fakes and assert model/tool/context ports were called `0` times on tenant/version rejection.

- [ ] **Step 5: Re-run tests and typecheck**

```bash
pnpm exec vitest run --config vitest.agent-os.config.ts lib/agent-engine/contracts/agent-kernel-resolution.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/agent-engine/kernel/resolution.ts lib/agent-engine/contracts/agent-kernel-resolution.test.ts lib/agent-engine/agent lib/agent-engine/db lib/agent-engine/obs/trace-context.ts
git commit -m "feat(agent-os): resolve Agent Kernel execution identity"
```

---

### Task 3: Load Authoritative CRM Context and Bounded Skills

**Files:**
- Create or modify: `lib/agent-engine/kernel/context-loader.ts`
- Modify/reuse: `lib/agent-engine/context/**`
- Modify/reuse: `lib/agent-engine/agent/skill-governance.ts`
- Modify/reuse: `lib/agent-engine/agent/skills.ts`
- Test: `lib/agent-engine/contracts/agent-kernel-context.test.ts`

**Interfaces:**
- Consumes: `ResolvedKernelExecution`, goal/trigger data
- Produces: `KernelContextBundle` with authoritative CRM snapshot identifiers, bounded derived memory and activated skill versions/content.
- Memory may enrich but never override authoritative CRM fields.

- [ ] **Step 1: Write RED tests for truth precedence and skill bounds**

Cover:

```ts
it("keeps authoritative CRM values when derived memory disagrees", ...)
it("loads only promoted/eligible skill versions", ...)
it("applies progressive disclosure and context budget limits", ...)
it("never loads another tenant's memory or skill state", ...)
```

- [ ] **Step 2: Run targeted context tests and verify RED**

```bash
pnpm exec vitest run --config vitest.agent-os.config.ts lib/agent-engine/contracts/agent-kernel-context.test.ts
```

- [ ] **Step 3: Implement authoritative merge semantics**

Keep CRM data in a distinct authoritative section or precedence layer. Derived memory cannot replace identifiers, lifecycle state, permissions or business values read from the CRM source of truth.

- [ ] **Step 4: Integrate Phase 1 skill governance**

Select skills through the existing registry/lifecycle/promotion rules and include only the progressively disclosed content required by the request and configured context budget.

- [ ] **Step 5: Re-run Phase 1 skill contracts plus new context tests**

```bash
pnpm exec vitest run --config vitest.agent-os.config.ts \
  lib/agent-engine/contracts/agent-kernel-context.test.ts \
  lib/agent-engine/contracts/skill-lifecycle.test.ts \
  lib/agent-engine/contracts/skill-progressive-disclosure.test.ts \
  lib/agent-engine/contracts/skill-promotion-gate.test.ts \
  lib/agent-engine/contracts/skill-registry-governance.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/agent-engine/kernel/context-loader.ts lib/agent-engine/context lib/agent-engine/agent/skill-governance.ts lib/agent-engine/agent/skills.ts lib/agent-engine/contracts/agent-kernel-context.test.ts
git commit -m "feat(agent-os): load bounded Agent Kernel context"
```

---

### Task 4: Route All Runtime Tools Through Tool Gateway and Deterministic Policy

**Files:**
- Modify/reuse: existing tool registry/gateway under `lib/agent-engine/**`
- Modify/reuse: `lib/agent-engine/policies/runtime-controls.ts`
- Create or modify: kernel tool-resolution helper if no existing owner exists
- Test: `lib/agent-engine/contracts/agent-kernel-policy.test.ts`

**Interfaces:**
- Consumes: resolved tenant/agent/version/autonomy, tool registry metadata and tool call request
- Produces: allowed runtime toolset plus per-call policy result
- Guarantees: R4 never executes autonomously; R3 may pause; SHADOW never invokes side-effect handler.

- [ ] **Step 1: Write RED policy-path tests**

Include:

```ts
it("does not expose tools outside the agent/tenant capability set", ...)
it("rechecks policy immediately before tool execution", ...)
it("pauses instead of executing when policy requires approval", ...)
it("never executes R4 autonomously", ...)
it("records SHADOW decisions without invoking side effects", ...)
```

Each fake side-effect handler must increment a counter so the test can assert exactly zero invocations on denied/approval/shadow paths.

- [ ] **Step 2: Run policy tests and verify RED**

```bash
pnpm exec vitest run --config vitest.agent-os.config.ts lib/agent-engine/contracts/agent-kernel-policy.test.ts
```

- [ ] **Step 3: Implement the minimum gateway integration**

Resolve the runtime-visible set once, but perform deterministic policy evaluation again immediately before invocation. The model receives no mechanism to override policy outcome.

- [ ] **Step 4: Preserve idempotency metadata**

For every side-effecting tool invocation, derive/pass the existing stable idempotency identity from execution/run/step/tool/business target. Do not invent a second idempotency system.

- [ ] **Step 5: Run policy, tool-compatibility and Phase 1 runtime-control tests**

```bash
pnpm exec vitest run --config vitest.agent-os.config.ts \
  lib/agent-engine/contracts/agent-kernel-policy.test.ts \
  lib/agent-engine/contracts/skill-tool-compatibility.test.ts
```

Add the existing Phase 1 tool/policy contract file(s) discovered during inventory to this command.

- [ ] **Step 6: Commit**

```bash
git add lib/agent-engine/policies lib/agent-engine/kernel lib/agent-engine/contracts/agent-kernel-policy.test.ts
git commit -m "feat(agent-os): enforce Tool Gateway policy in Agent Kernel"
```

---

### Task 5: Add Certified Model Selection and Provider-Agnostic AI SDK Runtime Adapter

**Files:**
- Create or modify: `lib/agent-engine/kernel/runtime-adapter.ts`
- Modify/reuse: `lib/agent-engine/models/certification.ts`
- Modify/reuse: `lib/agent-engine/models/provider-certification.ts`
- Modify/reuse: existing router/provider adapter under `lib/agent-engine/**`
- Test: `lib/agent-engine/contracts/agent-kernel-model.test.ts`

**Interfaces:**
- Produces: `KernelRuntimePort` with a provider-agnostic method for one bounded model step/loop interaction.
- Model selection must filter incompatible or uncertified models before ranking/fallback.
- Provider fallback remains correlated to the same run/trace.

- [ ] **Step 1: Write RED model-selection tests**

Cover:

```ts
it("rejects an uncertified model before runtime invocation", ...)
it("rejects a certified model missing a required capability", ...)
it("selects a compatible certified model", ...)
it("records fallback start/success/failure under the same trace", ...)
```

- [ ] **Step 2: Run targeted model tests and verify RED**

```bash
pnpm exec vitest run --config vitest.agent-os.config.ts lib/agent-engine/contracts/agent-kernel-model.test.ts
```

- [ ] **Step 3: Implement certified filtering before ranking**

Reuse the Phase 1 capability/certification types and status values. Do not create a duplicate model registry.

- [ ] **Step 4: Wrap AI SDK 7 behind `KernelRuntimePort`**

Translate internal prompt/context/tool definitions into AI SDK-specific shapes inside the adapter only. Translate provider responses back into internal step results before returning to the kernel.

- [ ] **Step 5: Run model-certification and provider-event contracts**

```bash
pnpm exec vitest run --config vitest.agent-os.config.ts \
  lib/agent-engine/contracts/agent-kernel-model.test.ts
```

Also run all existing Phase 1 model/provider certification contract files discovered in Task 1.

- [ ] **Step 6: Commit**

```bash
git add lib/agent-engine/kernel/runtime-adapter.ts lib/agent-engine/models lib/agent-engine/obs lib/agent-engine/contracts/agent-kernel-model.test.ts
git commit -m "feat(agent-os): add certified model runtime adapter"
```

---

### Task 6: Implement the Canonical Bounded `AgentKernel.run()` Loop

**Files:**
- Create or modify: `lib/agent-engine/kernel/agent-kernel.ts`
- Modify/reuse: `lib/agent-engine/execution/**`
- Test: `lib/agent-engine/contracts/agent-kernel-loop.test.ts`

**Interfaces:**
- Consumes: resolved execution, context bundle, allowed tools, certified runtime port and Phase 1 loop guards
- Produces: explicit `AgentKernelResult`
- Every iteration/checkpoint must use Phase 1 guard accounting rather than model self-policing.

- [ ] **Step 1: Write one RED test per stop class**

At minimum:

```ts
it("completes a bounded happy path", ...)
it("stops at max steps", ...)
it("stops at max tool calls", ...)
it("stops at token budget", ...)
it("stops at cost budget", ...)
it("stops at runtime budget", ...)
it("stops repeated identical tool calls", ...)
it("stops deterministic no-progress loops", ...)
it("classifies retryable and permanent tool failures", ...)
```

Each test must assert both terminal status and exact stop reason.

- [ ] **Step 2: Run loop tests and confirm RED**

```bash
pnpm exec vitest run --config vitest.agent-os.config.ts lib/agent-engine/contracts/agent-kernel-loop.test.ts
```

- [ ] **Step 3: Implement orchestration using existing guard pipeline**

Do not reimplement guard logic inside `agent-kernel.ts`. The kernel should call the Phase 1 guard/evaluation primitives at deterministic boundaries and terminate on their structured decision.

- [ ] **Step 4: Ensure unknown errors fail closed**

Map unclassified runtime/tool errors to a recorded permanent/retryable failure according to existing classifier rules; never silently continue and never return a success-like result without explicit verification.

- [ ] **Step 5: Run loop tests plus Phase 1 execution contracts**

```bash
pnpm exec vitest run --config vitest.agent-os.config.ts \
  lib/agent-engine/contracts/agent-kernel-loop.test.ts \
  lib/agent-engine/contracts/phase-1-5-runtime-integration.test.ts
```

Also run the existing Phase 1 execution/loop contract files found during Task 1.

- [ ] **Step 6: Commit**

```bash
git add lib/agent-engine/kernel/agent-kernel.ts lib/agent-engine/execution lib/agent-engine/contracts/agent-kernel-loop.test.ts
git commit -m "feat(agent-os): implement bounded Agent Kernel loop"
```

---

### Task 7: Add Durable Checkpoint, Approval Pause and Safe Resume

**Files:**
- Modify/reuse: `lib/agent-engine/execution/**`
- Modify/reuse: approval contract/handler under `lib/agent-engine/**`
- Modify: `lib/agent-engine/kernel/agent-kernel.ts`
- Test: `lib/agent-engine/contracts/agent-kernel-resume.test.ts`

**Interfaces:**
- Paused result: same run/trace identity, status `waiting_approval`, approval reference and stop reason.
- Resume input: rehydrates the same durable execution and completed-step/idempotency state.

- [ ] **Step 1: Write RED approval/resume tests**

Cover:

```ts
it("checkpoints before pausing for required approval", ...)
it("resumes the same run after approval", ...)
it("does not replay a completed side effect after resume", ...)
it("recovers after simulated worker interruption after checkpoint", ...)
it("preserves trace/correlation identity across resume", ...)
```

Use a fake side-effect counter and a forced crash after checkpoint to prove the handler runs exactly once across initial execution + resume.

- [ ] **Step 2: Run resume tests and verify RED**

```bash
pnpm exec vitest run --config vitest.agent-os.config.ts lib/agent-engine/contracts/agent-kernel-resume.test.ts
```

- [ ] **Step 3: Implement pause/resume orchestration with existing `ExecutionPort` semantics**

Use start/checkpoint/pause/resume/complete/fail behavior from Phase 1. Do not invent an in-memory-only approval state.

- [ ] **Step 4: Couple resume to existing idempotency evidence**

On resume, rehydrate completed step/effect state and skip already committed side effects. The test must fail if the tool handler is invoked twice.

- [ ] **Step 5: Re-run targeted tests**

```bash
pnpm exec vitest run --config vitest.agent-os.config.ts lib/agent-engine/contracts/agent-kernel-resume.test.ts
pnpm typecheck
```

- [ ] **Step 6: Commit**

```bash
git add lib/agent-engine/execution lib/agent-engine/kernel/agent-kernel.ts lib/agent-engine/contracts/agent-kernel-resume.test.ts
git commit -m "feat(agent-os): add durable Agent Kernel resume"
```

---

### Task 8: Verify Outcomes, Record Complete Evidence, Write Permitted Memory and Emit Events

**Files:**
- Create or modify: `lib/agent-engine/kernel/verification.ts`
- Modify/reuse: `lib/agent-engine/obs/run-recorder.ts`
- Modify/reuse: `lib/agent-engine/obs/provider-events.ts`
- Modify/reuse: memory writer under `lib/agent-engine/**`
- Modify/reuse: business event emitter under `lib/agent-engine/**`
- Test: `lib/agent-engine/contracts/agent-kernel-evidence.test.ts`

**Interfaces:**
- Completion requires a verification result; failed verification cannot return `completed`.
- Evidence must include agent/version, trigger, context source IDs, skills, model/provider, steps, tool calls, policy decisions, approvals, retries, tokens, cost, latency, verification and stop reason.
- Memory write receives only derived/policy-permitted data.

- [ ] **Step 1: Write RED evidence/completion tests**

Cover:

```ts
it("does not mark completed when verification fails", ...)
it("records the complete run evidence envelope", ...)
it("writes only policy-permitted derived memory", ...)
it("emits business events separately from queued work", ...)
it("records explicit stop reason on failed and completed runs", ...)
```

- [ ] **Step 2: Run evidence tests and verify RED**

```bash
pnpm exec vitest run --config vitest.agent-os.config.ts lib/agent-engine/contracts/agent-kernel-evidence.test.ts
```

- [ ] **Step 3: Implement minimum verification orchestration**

Verification should be task-appropriate and injected/ported. The default kernel path must require a deterministic verifier outcome before calling execution complete.

- [ ] **Step 4: Complete RunRecorder integration**

Reuse existing `ai_agent_runs`/invocation evidence model through `RunRecorder`; do not create a parallel persistence path.

- [ ] **Step 5: Re-run evidence, trace and provider contracts**

```bash
pnpm exec vitest run --config vitest.agent-os.config.ts lib/agent-engine/contracts/agent-kernel-evidence.test.ts
```

Also run existing Phase 1 trace/run-recorder/provider event contracts discovered in Task 1.

- [ ] **Step 6: Commit**

```bash
git add lib/agent-engine/kernel/verification.ts lib/agent-engine/kernel/agent-kernel.ts lib/agent-engine/obs lib/agent-engine/contracts/agent-kernel-evidence.test.ts
git commit -m "feat(agent-os): record verified Agent Kernel outcomes"
```

---

### Task 9: Wire the Composition Root Without Changing Existing Product Autonomy

**Files:**
- Create or modify: `lib/agent-engine/kernel/composition.ts`
- Modify/reuse: the safest existing internal Agent Engine entrypoint discovered in Task 1
- Test: `lib/agent-engine/contracts/agent-kernel-integration.test.ts`
- Docs: `docs/architecture/agent-os/execution.md`, `docs/architecture/agent-os/agents.md`

**Interfaces:**
- Produces: one canonical construction path for `AgentKernel` using existing Phase 1 implementations.
- Existing customer-facing paths must remain behaviorally unchanged unless they already run in a test-safe/shadow/internal path selected for integration.

- [ ] **Step 1: Write RED composition/integration tests**

Cover at minimum one in-memory end-to-end path for each:

```text
happy path
cross-tenant deny
policy deny
approval pause/resume
SHADOW zero side effects
uncertified model rejection
provider fallback
retryable tool failure
idempotent replay protection
budget exhaustion
no-progress termination
crash/resume
verification failure
evidence completeness
```

- [ ] **Step 2: Run integration test and verify RED**

```bash
pnpm exec vitest run --config vitest.agent-os.config.ts lib/agent-engine/contracts/agent-kernel-integration.test.ts
```

- [ ] **Step 3: Implement the composition root**

Wire the already-tested ports/adapters into a single kernel factory/construction path. Do not enable `AUTOPILOT_*` or customer-facing side effects. If an existing runtime entrypoint is adapted, preserve OFF/SHADOW defaults and backwards-compatible behavior.

- [ ] **Step 4: Update architecture docs to name the canonical owner**

Document that `AgentKernel.run()` is the orchestration entrypoint and that individual Phase 1 modules continue owning policy, skills, execution, models, observability and memory semantics.

- [ ] **Step 5: Run the full Agent OS contract suite**

```bash
pnpm exec vitest run --config vitest.agent-os.config.ts
```

Expected: all Agent OS tests PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/agent-engine/kernel lib/agent-engine/contracts/agent-kernel-integration.test.ts docs/architecture/agent-os
git commit -m "feat(agent-os): wire canonical Agent Kernel"
```

---

### Task 10: Final Phase 2 Verification and GO Evidence

**Files:**
- Create: `docs/architecture/agent-os/phase-2-verification.md`
- Update: `docs/superpowers/plans/2026-08-17-agent-os-master-implementation-plan.md` only for Phase 2 completion state/evidence links
- No production code changes unless a verification failure exposes a root cause; if so, return to the relevant prior task with RED -> fix -> GREEN.

**Interfaces:**
- Produces: auditable Phase 2 GO evidence and exact final commit SHA.

- [ ] **Step 1: Run typecheck**

```bash
pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 2: Run complete Agent OS Vitest suite**

```bash
pnpm exec vitest run --config vitest.agent-os.config.ts
```

Expected: exit 0 with all Agent OS files/tests passing.

- [ ] **Step 3: Run affected repository regressions**

Run the narrowest established repository regression commands that cover any modified non-Agent-OS integration entrypoints. If the work only adds isolated kernel code, at minimum run the repository unit test command documented by the project; if it is prohibitively broad, run all directly affected suites plus the full Agent OS suite and document the exact scope.

- [ ] **Step 4: Run Next.js production build**

```bash
pnpm build
```

Expected: exit 0.

- [ ] **Step 5: Verify no protected-boundary changes**

Inspect the branch diff and confirm:

```text
main unchanged
no production deployment performed
no remote migration applied
no secret/billing changes
no real external communication
no customer-facing autonomy enabled
```

- [ ] **Step 6: Use one final Vercel Preview only if runtime/deployment verification is necessary**

If a Preview is required, perform exactly one final preview gate for the final Phase 2 SHA. A build-rate-limit or transient Vercel error is investigated/retried without generating intermediate preview churn. Do not deploy production.

- [ ] **Step 7: Write fresh Phase 2 verification evidence**

Create `docs/architecture/agent-os/phase-2-verification.md` containing:

```text
final SHA
AgentKernel canonical path
contract/integration coverage
exact typecheck result
exact Agent OS test counts
exact affected regression result
exact build result
preview result if used
protected-boundary confirmation
Phase 2 GO / NO-GO
```

Do not copy stale counts from Phase 1.

- [ ] **Step 8: Update master plan completion state**

Mark Phase 2 as GO only if every completion criterion from the approved spec is backed by fresh evidence. Link to `phase-2-verification.md`.

- [ ] **Step 9: Commit documentation closure**

```bash
git add docs/architecture/agent-os/phase-2-verification.md docs/superpowers/plans/2026-08-17-agent-os-master-implementation-plan.md
git commit -m "docs(agent-os): record Phase 2 GO verification"
```

- [ ] **Step 10: Final verification after documentation commit**

Run at minimum:

```bash
pnpm typecheck
pnpm exec vitest run --config vitest.agent-os.config.ts
```

If documentation changes do not affect build/runtime and the prior build was on the same code SHA, record that distinction explicitly; otherwise rerun `pnpm build`.

---

## Plan Self-Review Result

- Spec coverage: all approved Phase 2 slices 2.1–2.9 are covered by Tasks 1–10.
- Provider abstraction: public kernel boundary stays provider-agnostic; AI SDK usage is isolated to an adapter.
- Security: tenant validation occurs before runtime/context/tool/model work; R4 and SHADOW constraints are explicit.
- Durability: approval, checkpoint, crash/resume and idempotent replay are explicit tests.
- Observability: trace, fallback, verification, evidence and stop reasons are explicit.
- Completion: fresh verification evidence is required before GO.
- Placeholder scan: no TBD/TODO/"implement later" steps remain.
- Type consistency: the plan consistently uses `AgentKernel`, `AgentKernelInput`, `AgentKernelResult`, `AgentKernelDependencies`, `ResolvedKernelExecution`, `KernelContextBundle` and `KernelRuntimePort`; exact reuse of existing canonical equivalents is required where discovered.
