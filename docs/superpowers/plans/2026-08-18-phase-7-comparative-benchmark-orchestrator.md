# Phase 7 Comparative Benchmark Orchestrator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one fail-closed `pnpm phase7:benchmark:all` command that runs the canonical Phase 7 benchmark across the current Deskcomm engine, the real local Inngest path, and the Vercel Workflow candidate when a real safe runtime is available, then writes sanitized comparative evidence and the canonical Phase 7 decision.

**Architecture:** Introduce a small provider-report/orchestration boundary around the existing canonical Phase 7 adapters and evidence logic. Reuse `current.ts`, the Inngest local dispatcher/command, canonical `runner.ts`, `hard-gates.ts`, `scoring.ts`, and `evidence.ts`; never duplicate scoring/decision semantics. The Vercel Workflow provider must fail closed as `BLOCKED` when only contract/mock wiring exists or a real isolated runtime cannot be invoked safely.

**Tech Stack:** TypeScript 6, Node 22+, pnpm 9, Vitest 4, existing Deskcomm durable benchmark harness, Inngest SDK 4.18.x, existing Vercel Workflow candidate adapter, filesystem evidence output.

**Spec:** `docs/superpowers/specs/2026-08-18-phase-7-comparative-benchmark-orchestrator-design.md`

## Global Constraints

- The comparative benchmark targets exactly `current`, `inngest`, and `vercel_workflow`.
- Canonical workload is 8 `small`, 40 `medium`, and 160 `stress` runs per engine; 208 per engine and 624 total only when all three providers are available.
- No provider may silently reduce, substitute, or reinterpret the canonical scenario matrix.
- `BLOCKED` is evidence, never success; missing real provider evidence must not be converted to `PASS`.
- No production deployment, remote migration, real customer data, billing mutation, or real external communication is allowed.
- Evidence must include the exact code SHA and must exclude secrets, authorization headers, API keys, provider raw payloads, customer PII, and non-synthetic organization IDs.
- Final decision must flow through existing Phase 7 evidence/scoring/decision logic.
- Existing Inngest-specific tests remain green.

---

### Task 1: Provider report contract and canonical matrix runner

**Files:**
- Create: `lib/agent-engine/durable-benchmark/provider-report.ts`
- Test: `tests/unit/durable-benchmark-provider-report.test.ts`
- Modify only if needed for exports: `lib/agent-engine/durable-benchmark/index.ts`

**Interfaces:**
- Consumes: `DurableBenchmarkEngineId`, `DurableBenchmarkRunResult`, `DurableBenchmarkProfile`, `evaluateDurableBenchmarkHardGates`, `scoreDurableBenchmarkEngine`.
- Produces: `Phase7ProviderStatus = 'PASS' | 'FAIL' | 'BLOCKED'`; `Phase7ProviderReport`; `buildPhase7ProviderReport(input)`; `blockedPhase7ProviderReport(input)`.

- [ ] **Step 1: Write the failing contract tests**

Test exact behavior: a complete 208-run provider report is `PASS` only when hard gates pass and a score can be produced; malformed suite counts fail closed; a blocked report has `realEvidence: false`, no score, no fabricated runs, and a sanitized blocker reason.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm exec vitest run tests/unit/durable-benchmark-provider-report.test.ts`

Expected: FAIL because `provider-report.ts` does not exist.

- [ ] **Step 3: Implement the minimal provider-report boundary**

Use exact canonical counts:

```ts
export const PHASE_7_PROFILE_COUNTS = { small: 8, medium: 40, stress: 160 } as const;
export type Phase7ProviderStatus = 'PASS' | 'FAIL' | 'BLOCKED';
```

`buildPhase7ProviderReport` must reject incomplete counts rather than relabel them as success. It must derive hard gates and score from canonical functions.

- [ ] **Step 4: Run focused test and existing benchmark contract tests**

Run: `pnpm exec vitest run tests/unit/durable-benchmark-provider-report.test.ts tests/unit/durable-benchmark-contracts.test.ts tests/unit/durable-benchmark-hard-gates.test.ts tests/unit/durable-benchmark-scoring.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/agent-engine/durable-benchmark/provider-report.ts lib/agent-engine/durable-benchmark/index.ts tests/unit/durable-benchmark-provider-report.test.ts
git commit -m "feat(agent-os): add Phase 7 provider report boundary"
```

### Task 2: Current-engine provider runner

**Files:**
- Create: `lib/agent-engine/durable-benchmark/providers/current-provider.ts`
- Test: `tests/unit/durable-benchmark-current-provider.test.ts`

**Interfaces:**
- Consumes: `createCurrentDurableBenchmarkAdapter`, `createInMemoryBenchmarkEffectStore`, canonical scenarios/profile expansion.
- Produces: `runCurrentPhase7Provider(input): Promise<Phase7ProviderReport>`.

- [ ] **Step 1: Write RED tests for exact 208-run matrix**

Assert `small=8`, `medium=40`, `stress=160`, engine ID `current`, synthetic organizations only, canonical scenario version, and no raw external state.

- [ ] **Step 2: Run RED**

Run: `pnpm exec vitest run tests/unit/durable-benchmark-current-provider.test.ts`

Expected: FAIL because provider file does not exist.

- [ ] **Step 3: Implement current provider with existing adapter**

Construct a fresh isolated effect store and current adapter, execute the same canonical matrix used by the benchmark runner, collect 208 `DurableBenchmarkRunResult` records, then call `buildPhase7ProviderReport`.

- [ ] **Step 4: Verify current provider**

Run: `pnpm exec vitest run tests/unit/durable-benchmark-current-provider.test.ts tests/unit/durable-benchmark-current-adapter.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/agent-engine/durable-benchmark/providers/current-provider.ts tests/unit/durable-benchmark-current-provider.test.ts
git commit -m "feat(agent-os): add current engine benchmark provider"
```

### Task 3: Inngest provider wrapper over the real local command

**Files:**
- Create: `lib/agent-engine/durable-benchmark/providers/inngest-provider.ts`
- Test: `tests/unit/durable-benchmark-inngest-provider.test.ts`
- Reuse: `lib/agent-engine/durable-benchmark/adapters/inngest/local-command.ts`
- Reuse: `lib/agent-engine/durable-benchmark/adapters/inngest/local-dispatcher.ts`

**Interfaces:**
- Consumes: a dispatcher factory or injected dispatcher plus `runPhase7InngestLocalCommand`.
- Produces: `runInngestPhase7Provider(input): Promise<Phase7ProviderReport>`.

- [ ] **Step 1: Write RED tests**

Assert the provider executes all three profiles, combines 208 results, returns `PASS` only with canonical counts/hard gates, and returns `BLOCKED` with sanitized reason if localhost preflight/dispatcher is unavailable.

- [ ] **Step 2: Run RED**

Run: `pnpm exec vitest run tests/unit/durable-benchmark-inngest-provider.test.ts`

Expected: FAIL because provider file does not exist.

- [ ] **Step 3: Implement thin wrapper**

Do not duplicate local-dispatcher behavior. Reuse `runPhase7InngestLocalCommand` three times and normalize into the provider-report boundary.

- [ ] **Step 4: Verify Inngest provider plus all existing Inngest tests**

Run all `tests/unit/durable-benchmark-inngest-*.test.ts`.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/agent-engine/durable-benchmark/providers/inngest-provider.ts tests/unit/durable-benchmark-inngest-provider.test.ts
git commit -m "feat(agent-os): wrap real Inngest benchmark provider"
```

### Task 4: Vercel Workflow provider availability boundary

**Files:**
- Create: `lib/agent-engine/durable-benchmark/providers/vercel-workflow-provider.ts`
- Test: `tests/unit/durable-benchmark-vercel-workflow-provider.test.ts`
- Inspect/reuse: `lib/agent-engine/durable-benchmark/adapters/vercel-workflow/adapter.ts`
- Inspect/reuse: `lib/agent-engine/durable-benchmark/adapters/vercel-workflow/workflow.ts`

**Interfaces:**
- Produces: `runVercelWorkflowPhase7Provider(input): Promise<Phase7ProviderReport>`.
- Optional injected real runtime boundary must be explicitly identified as real and isolated; absence returns `BLOCKED`.

- [ ] **Step 1: Write fail-closed RED tests**

Cases:

```ts
expect(await runVercelWorkflowPhase7Provider({ runtime: undefined })).toMatchObject({
  engineId: 'vercel_workflow',
  status: 'BLOCKED',
  realEvidence: false,
});
```

Also test that a supplied real runtime can produce canonical 208-run evidence and that mock-only runtime cannot set `realEvidence: true`.

- [ ] **Step 2: Run RED**

Run: `pnpm exec vitest run tests/unit/durable-benchmark-vercel-workflow-provider.test.ts`

Expected: FAIL because provider file does not exist.

- [ ] **Step 3: Implement availability boundary**

Use the existing Vercel Workflow adapter only when a safe real invocation port is available. Otherwise return a sanitized blocker such as `real_vercel_workflow_runtime_unavailable`.

- [ ] **Step 4: Verify Vercel provider and existing Vercel Workflow adapter tests**

Run: `pnpm exec vitest run tests/unit/durable-benchmark-vercel-workflow-provider.test.ts tests/unit/durable-benchmark-vercel-workflow*.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/agent-engine/durable-benchmark/providers/vercel-workflow-provider.ts tests/unit/durable-benchmark-vercel-workflow-provider.test.ts
git commit -m "feat(agent-os): add fail-closed Vercel Workflow provider"
```

### Task 5: Comparative orchestrator core

**Files:**
- Create: `lib/agent-engine/durable-benchmark/comparative-orchestrator.ts`
- Test: `tests/unit/durable-benchmark-comparative-orchestrator.test.ts`

**Interfaces:**
- Consumes provider functions returning `Phase7ProviderReport`.
- Produces `runPhase7ComparativeBenchmark(input)` returning provider reports plus `Phase7BenchmarkEvidence`.

- [ ] **Step 1: Write RED tests for provider ordering and isolation**

Assert order `current -> inngest -> vercel_workflow`; one provider throwing becomes `BLOCKED` without discarding prior reports; final evidence stays `INCOMPLETE` if any required engine lacks score/real evidence.

- [ ] **Step 2: Run RED**

Run: `pnpm exec vitest run tests/unit/durable-benchmark-comparative-orchestrator.test.ts`

Expected: FAIL because orchestrator does not exist.

- [ ] **Step 3: Implement orchestrator using canonical evidence builder**

Call `buildPhase7BenchmarkEvidence` with the three normalized engine evidence entries. Never compute a decision directly in the orchestrator.

- [ ] **Step 4: Verify orchestrator + evidence/scoring tests**

Run: `pnpm exec vitest run tests/unit/durable-benchmark-comparative-orchestrator.test.ts tests/unit/durable-benchmark-evidence.test.ts tests/unit/durable-benchmark-scoring.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/agent-engine/durable-benchmark/comparative-orchestrator.ts tests/unit/durable-benchmark-comparative-orchestrator.test.ts
git commit -m "feat(agent-os): orchestrate Phase 7 engine comparison"
```

### Task 6: Single CLI command and sanitized artifacts

**Files:**
- Create: `scripts/phase7-benchmark-all.ts`
- Create: `tests/unit/durable-benchmark-all-command.test.ts`
- Modify: `package.json`
- Output at runtime: `docs/superpowers/verification/phase-7-comparative-benchmark-evidence.json`
- Output at runtime: `docs/superpowers/verification/phase-7-comparative-benchmark-summary.md`

**Interfaces:**
- Package script: `phase7:benchmark:all`.

- [ ] **Step 1: Write RED tests for CLI composition**

Assert package script exists, command delegates to comparative orchestrator, exact SHA is recorded, summary never includes secret-like strings, and exit code is non-zero for `INCOMPLETE`/`NO_GO`/provider failure.

- [ ] **Step 2: Run RED**

Run: `pnpm exec vitest run tests/unit/durable-benchmark-all-command.test.ts`

Expected: FAIL before script/package entry exists.

- [ ] **Step 3: Implement CLI**

Progress markers must be concise:

```text
[phase7:all] current ...
[phase7:all] inngest ...
[phase7:all] vercel_workflow ...
[phase7:all] decision: INCOMPLETE
```

Write evidence through `serializePhase7BenchmarkEvidence`; generate Markdown summary only from normalized/sanitized provider fields.

- [ ] **Step 4: Add package script**

`phase7:benchmark:all` runs focused comparative tests, `pnpm typecheck`, then `tsx scripts/phase7-benchmark-all.ts`.

- [ ] **Step 5: Verify CLI test and package script static contract**

Run: `pnpm exec vitest run tests/unit/durable-benchmark-all-command.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/phase7-benchmark-all.ts tests/unit/durable-benchmark-all-command.test.ts package.json
git commit -m "feat(agent-os): add one-command Phase 7 benchmark"
```

### Task 7: Final focused verification and documentation closure

**Files:**
- Modify: `docs/architecture/agent-os/phase-7-verification.md`
- Modify: `docs/architecture/agent-os/phase-7-execution-status.md`
- Runtime outputs from Task 6.

- [ ] **Step 1: Run complete focused Phase 7 unit suite**

Run: `pnpm exec vitest run tests/unit/durable-benchmark*.test.ts`

Expected: all Phase 7 benchmark tests PASS.

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`

Expected: PASS.

- [ ] **Step 3: Run the single comparative command in the prepared local environment**

Run: `pnpm phase7:benchmark:all`

Expected truthful outcomes:
- `current`: 208/208 if local adapter is healthy;
- `inngest`: 208/208 only when Next.js + Inngest dev server are healthy;
- `vercel_workflow`: 208/208 only if real isolated runtime is actually available, otherwise `BLOCKED`;
- final decision produced only by canonical evidence logic.

- [ ] **Step 4: Inspect generated evidence**

Confirm exact SHA, canonical scenario version, provider statuses, hard-gate state, no secrets/PII, and no fabricated real evidence.

- [ ] **Step 5: Update Phase 7 docs from fresh evidence only**

Mark Phase 7 `GO` only if the canonical decision and all required real evidence support it. Otherwise document `INCOMPLETE`/`NO_GO` and the exact blocker.

- [ ] **Step 6: Final verification after docs closure**

Run focused tests + typecheck again to prove documentation-only closure did not alter runtime behavior.

- [ ] **Step 7: Commit documentation closure**

```bash
git add docs/architecture/agent-os/phase-7-verification.md docs/architecture/agent-os/phase-7-execution-status.md docs/superpowers/verification/phase-7-comparative-benchmark-evidence.json docs/superpowers/verification/phase-7-comparative-benchmark-summary.md
git commit -m "docs(agent-os): record Phase 7 comparative benchmark evidence"
```

## Self-Review

- Spec coverage: all three providers, canonical 624-run matrix, fail-closed provider availability, evidence, decision, CLI, sanitization, and closure documentation are mapped to tasks.
- Placeholder scan: no TBD/TODO/"implement later" steps remain.
- Type consistency: provider reports feed the comparative orchestrator; comparative orchestrator feeds existing evidence/decision logic; the CLI consumes only normalized provider reports/evidence.
- Scope: one subsystem — comparative durability benchmark orchestration — with provider-specific tasks that share one canonical contract.
