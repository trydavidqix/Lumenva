# Agent OS Phase 7 Durable Execution Benchmark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and run a fair, deterministic benchmark of the current Deskcomm durable execution stack, Inngest and Vercel Workflow without migrating production behavior, then produce an evidence-backed KEEP/ADOPT/NO-GO decision.

**Architecture:** Add an isolated provider-neutral benchmark subsystem under `lib/agent-engine/durable-benchmark/`. All three engines consume the same versioned synthetic scenarios and deterministic fault plan, emit a normalized result contract, pass hard safety/correctness gates, and only then receive weighted scores. External providers remain benchmark-only adapters; no winning engine is migrated by Phase 7.

**Tech Stack:** TypeScript, Vitest, existing Agent OS execution/idempotency/approval/observability primitives, current Postgres/Supabase job/event/worker path, Inngest TypeScript SDK, Vercel Workflow TypeScript runtime, controlled Vercel Preview runner, synthetic benchmark storage/effects only.

**Spec:** `docs/superpowers/specs/2026-08-18-agent-os-phase-7-durable-execution-benchmark-design.md`

## Global Constraints

- Never modify or merge to `main` as part of Phase 7 execution.
- Phase 7 is benchmark-only; no runtime migration is authorized.
- All benchmark data, organizations, approvals and effects are synthetic.
- No customer-visible WhatsApp/email/webhook/campaign action.
- No authoritative CRM mutation.
- No production deployment.
- No remote database migration is required or permitted by this plan.
- No real credentials committed to the repository.
- Benchmark feature is OFF by default and fail-closed.
- Tenant isolation, idempotency, approval boundaries and recovery correctness are hard gates.
- GitHub Actions is not required and must not be introduced as the execution dependency.
- The user must not be required to run PowerShell, VS Code or local terminal tests.
- Focused tests/typecheck/build run through autonomous controlled runners; Vercel Preview is the preferred final code gate when quota is available.
- If a real external-engine test environment is unavailable, record `INCOMPLETE`; never replace it with a fake and claim a real provider benchmark.
- Final adoption recommendation is non-binding and cannot trigger migration automatically.
- A final authoritative technology recommendation is gated by the Agent OS master-plan prerequisite that real SHADOW/ASSISTED workload context exists.

---

## File Structure

```text
lib/agent-engine/durable-benchmark/
  contracts.ts
  scenarios.ts
  fault-plan.ts
  effect-store.ts
  runner.ts
  hard-gates.ts
  scoring.ts
  evidence.ts
  index.ts
  adapters/
    current.ts
    inngest/
      adapter.ts
      functions.ts
    vercel-workflow/
      adapter.ts
      workflow.ts

tests/unit/
  durable-benchmark-contracts.test.ts
  durable-benchmark-scenarios.test.ts
  durable-benchmark-current.test.ts
  durable-benchmark-inngest.test.ts
  durable-benchmark-vercel-workflow.test.ts
  durable-benchmark-faults.test.ts
  durable-benchmark-hard-gates.test.ts
  durable-benchmark-scoring.test.ts
  durable-benchmark-runner.test.ts
  durable-benchmark-regression.test.ts
scripts/
  durable-benchmark-run.ts
artifacts/agent-os/phase-7/
  .gitkeep

docs/architecture/agent-os/
  phase-7-durable-benchmark.md
  phase-7-verification.md
```

Keep generated raw machine artifacts out of source-control when they contain provider request metadata; commit only sanitized JSON/Markdown evidence required by the final gate.

---

### Task 1: Freeze provider-neutral benchmark contracts

**Files:**
- Create: `lib/agent-engine/durable-benchmark/contracts.ts`
- Create: `tests/unit/durable-benchmark-contracts.test.ts`

**Interfaces:**

```ts
export type DurableBenchmarkEngineId = 'current' | 'inngest' | 'vercel_workflow';
export type DurableBenchmarkTerminalState = 'completed' | 'failed' | 'rejected' | 'expired';
export type DurableBenchmarkScenarioId =
  | 'happy_path'
  | 'transient_retry'
  | 'retry_exhausted'
  | 'approval_pause_resume'
  | 'process_crash_recovery'
  | 'duplicate_delivery_idempotency'
  | 'approval_denied_or_expired'
  | 'tenant_isolation';

export interface DurableBenchmarkLifecycleEvent {
  seq: number;
  kind: string;
  stepId?: string;
  attempt?: number;
  atMs: number;
  evidence: string;
}

export interface DurableBenchmarkRunResult {
  engineId: DurableBenchmarkEngineId;
  scenarioId: DurableBenchmarkScenarioId;
  scenarioVersion: string;
  organizationId: string;
  runId: string;
  terminalState: DurableBenchmarkTerminalState;
  lifecycle: readonly DurableBenchmarkLifecycleEvent[];
  retryCount: number;
  approvalRequired: boolean;
  approvalSatisfied: boolean;
  resumedFromExpectedStep: boolean;
  effectAttempts: number;
  committedEffects: number;
  recoveredAfterCrash: boolean;
  crossTenantViolation: boolean;
  durationMs: number;
  estimatedCostUsd?: number;
  engineVersion?: string;
}

export interface DurableBenchmarkAdapter {
  readonly engineId: DurableBenchmarkEngineId;
  run(input: DurableBenchmarkRunInput): Promise<DurableBenchmarkRunResult>;
}
```

- [ ] **Step 1: Add RED runtime-validation tests**

Test that unknown engine/scenario IDs, blank run/organization identity, negative counts, non-monotonic lifecycle sequence and impossible effect counts are rejected.

- [ ] **Step 2: Execute RED autonomously**

Run the focused Vitest file through the controlled technical runner. Expected failure: missing contracts module.

- [ ] **Step 3: Implement minimal contracts and validation helpers**

Add `validateDurableBenchmarkRunResult(value: unknown): value is DurableBenchmarkRunResult` and fail closed on malformed evidence.

- [ ] **Step 4: Execute GREEN autonomously**

Run targeted test + typecheck through the controlled runner.

- [ ] **Step 5: Commit**

```bash
git add lib/agent-engine/durable-benchmark/contracts.ts tests/unit/durable-benchmark-contracts.test.ts
git commit -m "feat(agent-os): add durable benchmark contracts"
```

---

### Task 2: Build the versioned synthetic scenario suite

**Files:**
- Create: `lib/agent-engine/durable-benchmark/scenarios.ts`
- Create: `lib/agent-engine/durable-benchmark/fault-plan.ts`
- Create: `tests/unit/durable-benchmark-scenarios.test.ts`
- Create: `tests/unit/durable-benchmark-faults.test.ts`

**Interfaces:**

```ts
export const PHASE_7_SCENARIO_VERSION = '7.0.0';

export interface DurableBenchmarkFault {
  kind: 'transient_failure' | 'permanent_failure' | 'crash' | 'duplicate_delivery' | 'cross_tenant_attempt';
  stepId: string;
  occurrence: number;
}

export interface DurableBenchmarkScenario {
  id: DurableBenchmarkScenarioId;
  version: string;
  expectedTerminalState: DurableBenchmarkTerminalState;
  maxRetries: number;
  requiresApproval: boolean;
  approvalOutcome?: 'approve' | 'reject' | 'expire';
  expectedCommittedEffects: number;
  faults: readonly DurableBenchmarkFault[];
}

export function getPhase7Scenarios(): readonly DurableBenchmarkScenario[];
```

- [ ] **Step 1: Add RED coverage tests for all eight scenarios**

Assert unique IDs, stable version, deterministic faults, explicit terminal expectations and exactly one committed effect only where the scenario reaches the effect step.

- [ ] **Step 2: Add RED deterministic fault-resolution tests**

`shouldInjectFault({ scenario, stepId, occurrence })` must return the same answer on every run; no unseeded randomness.

- [ ] **Step 3: Execute RED autonomously**

- [ ] **Step 4: Implement the minimal scenario/fault catalog**

Synthetic organization IDs use fixed safe values such as `bench-org-a` and `bench-org-b`; never production UUIDs.

- [ ] **Step 5: Execute GREEN autonomously**

- [ ] **Step 6: Commit**

```bash
git add lib/agent-engine/durable-benchmark/scenarios.ts lib/agent-engine/durable-benchmark/fault-plan.ts tests/unit/durable-benchmark-scenarios.test.ts tests/unit/durable-benchmark-faults.test.ts
git commit -m "test(agent-os): add Phase 7 synthetic scenarios"
```

---

### Task 3: Add isolated synthetic effect store and current-engine adapter

**Files:**
- Create: `lib/agent-engine/durable-benchmark/effect-store.ts`
- Create: `lib/agent-engine/durable-benchmark/adapters/current.ts`
- Create: `tests/unit/durable-benchmark-current.test.ts`

**Interfaces:**

```ts
export interface BenchmarkEffectStore {
  commitOnce(input: {
    organizationId: string;
    idempotencyKey: string;
  }): Promise<{ committed: boolean; committedCount: number }>;
}

export function createCurrentDurableBenchmarkAdapter(dependencies: {
  effectStore: BenchmarkEffectStore;
  // existing execution/checkpoint/approval/idempotency seams discovered in repo
}): DurableBenchmarkAdapter;
```

- [ ] **Step 1: Inventory exact existing execution seams before implementation**

Map current `event_log`, `job_queue`, worker execution, Agent OS checkpoint/resume, approval and idempotency symbols. Reuse them; do not build a parallel production scheduler.

- [ ] **Step 2: Write RED adapter tests**

Prove transient retry, retry exhaustion, pause/resume, crash/recovery, duplicate suppression and tenant scoping use the common scenario contract.

- [ ] **Step 3: Execute RED autonomously**

- [ ] **Step 4: Implement current adapter against existing boundaries**

Synthetic benchmark effects must never route to CRM/channel tools.

- [ ] **Step 5: Execute GREEN + directly related Agent OS regressions**

Run current-adapter tests plus existing execution/idempotency/approval tests only; do not run the entire CRM suite yet.

- [ ] **Step 6: Commit**

```bash
git add lib/agent-engine/durable-benchmark/effect-store.ts lib/agent-engine/durable-benchmark/adapters/current.ts tests/unit/durable-benchmark-current.test.ts
git commit -m "feat(agent-os): benchmark current durable engine"
```

---

### Task 4: Add the Inngest benchmark adapter

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `lib/agent-engine/durable-benchmark/adapters/inngest/adapter.ts`
- Create: `lib/agent-engine/durable-benchmark/adapters/inngest/functions.ts`
- Create: `tests/unit/durable-benchmark-inngest.test.ts`

**Interfaces:**

```ts
export function createInngestDurableBenchmarkAdapter(dependencies: {
  effectStore: BenchmarkEffectStore;
  invoke: InngestBenchmarkInvocationPort;
}): DurableBenchmarkAdapter;
```

- [ ] **Step 1: Inspect current official Inngest TypeScript package/runtime requirements**

Use official package/docs at implementation time and pin versions according to repository dependency policy. Do not rely on remembered package versions.

- [ ] **Step 2: Add dependency-only commit if required**

Keep Inngest imports inside the adapter/function boundary.

- [ ] **Step 3: Write RED contract tests using a fake invocation port**

Prove the adapter normalizes retries, waits, resume, duplicate delivery and failure states into the shared result contract.

- [ ] **Step 4: Execute RED autonomously**

- [ ] **Step 5: Implement benchmark-only Inngest function**

Function consumes synthetic scenario/run IDs only. It must use provider-native durable wait/retry primitives where appropriate while calling the shared synthetic effect store boundary for the effect step.

- [ ] **Step 6: Add real-engine smoke/integration gate**

Run against an isolated test/dev Inngest environment if credentials/environment are already available to the autonomous runner. If unavailable, mark provider integration `INCOMPLETE`; never ask the user to run local terminal tests and never claim a real Inngest result from mocks.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml lib/agent-engine/durable-benchmark/adapters/inngest tests/unit/durable-benchmark-inngest.test.ts
git commit -m "feat(agent-os): add Inngest benchmark adapter"
```

---

### Task 5: Add the Vercel Workflow benchmark adapter

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `lib/agent-engine/durable-benchmark/adapters/vercel-workflow/adapter.ts`
- Create: `lib/agent-engine/durable-benchmark/adapters/vercel-workflow/workflow.ts`
- Create: `tests/unit/durable-benchmark-vercel-workflow.test.ts`

**Interfaces:**

```ts
export function createVercelWorkflowDurableBenchmarkAdapter(dependencies: {
  effectStore: BenchmarkEffectStore;
  invoke: VercelWorkflowBenchmarkInvocationPort;
}): DurableBenchmarkAdapter;
```

- [ ] **Step 1: Inspect current official Vercel Workflow package/runtime requirements**

Use official Vercel documentation at implementation time; pin compatible versions rather than assuming an API from memory.

- [ ] **Step 2: Write RED adapter normalization tests**

Use an injected invocation port so unit tests remain deterministic.

- [ ] **Step 3: Execute RED autonomously**

- [ ] **Step 4: Implement benchmark-only workflow**

No production route or Agent Kernel execution is switched to Vercel Workflow.

- [ ] **Step 5: Execute real controlled Preview smoke gate**

Use the designated non-production Vercel project/Preview environment. Capture deployment/workflow execution identifiers and normalized result. If provider/runtime access is unavailable, record `INCOMPLETE` rather than involving the user terminal.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml lib/agent-engine/durable-benchmark/adapters/vercel-workflow tests/unit/durable-benchmark-vercel-workflow.test.ts
git commit -m "feat(agent-os): add Vercel Workflow benchmark adapter"
```

---

### Task 6: Build fault-injection, recovery and orchestration harness

**Files:**
- Create: `lib/agent-engine/durable-benchmark/runner.ts`
- Create: `tests/unit/durable-benchmark-runner.test.ts`
- Modify: `tests/unit/durable-benchmark-faults.test.ts`

**Interfaces:**

```ts
export interface DurableBenchmarkSuiteResult {
  engineId: DurableBenchmarkEngineId;
  profile: 'small' | 'medium' | 'stress';
  repetitions: number;
  results: readonly DurableBenchmarkRunResult[];
}

export function createDurableBenchmarkRunner(input: {
  adapters: ReadonlyMap<DurableBenchmarkEngineId, DurableBenchmarkAdapter>;
}): {
  runSuite(input: {
    engineId: DurableBenchmarkEngineId;
    profile: 'small' | 'medium' | 'stress';
    repetitions: number;
  }): Promise<DurableBenchmarkSuiteResult>;
};
```

- [ ] **Step 1: Freeze load profiles and repetitions**

Use:

```text
small:  1 concurrent run per scenario, 3 repetitions
medium: 5 concurrent runs per scenario, 5 repetitions
stress: 20 concurrent runs per scenario, 3 repetitions
```

Stress remains bounded and synthetic; this is correctness/recovery pressure, not capacity certification.

- [ ] **Step 2: Write RED fairness tests**

Assert each engine receives identical scenario versions, repetition counts, organization identities and fault schedules.

- [ ] **Step 3: Write RED crash/duplicate orchestration tests**

- [ ] **Step 4: Execute RED autonomously**

- [ ] **Step 5: Implement minimal runner**

Failures in one engine must not mutate scenario definitions or skip remaining competitors.

- [ ] **Step 6: Execute GREEN autonomously**

- [ ] **Step 7: Commit**

```bash
git add lib/agent-engine/durable-benchmark/runner.ts tests/unit/durable-benchmark-runner.test.ts tests/unit/durable-benchmark-faults.test.ts
git commit -m "feat(agent-os): add durable benchmark harness"
```

---

### Task 7: Implement hard gates and disqualification logic

**Files:**
- Create: `lib/agent-engine/durable-benchmark/hard-gates.ts`
- Create: `tests/unit/durable-benchmark-hard-gates.test.ts`

**Interfaces:**

```ts
export type DurableBenchmarkHardGate =
  | 'tenant_isolation'
  | 'exactly_once_effect'
  | 'crash_recovery'
  | 'resume_position'
  | 'approval_required'
  | 'approval_rejection_expiry'
  | 'retry_limit'
  | 'terminal_state_truth'
  | 'reconstructable_evidence';

export interface DurableBenchmarkHardGateDecision {
  passed: boolean;
  failures: readonly {
    gate: DurableBenchmarkHardGate;
    runId: string;
    evidence: string;
  }[];
}

export function evaluateDurableBenchmarkHardGates(
  results: readonly DurableBenchmarkRunResult[],
): DurableBenchmarkHardGateDecision;
```

- [ ] **Step 1: Write a RED truth table for every hard gate**

One failing run must fail the engine; global averages cannot hide it.

- [ ] **Step 2: Execute RED autonomously**

- [ ] **Step 3: Implement pure deterministic evaluator**

- [ ] **Step 4: Execute GREEN autonomously**

- [ ] **Step 5: Commit**

```bash
git add lib/agent-engine/durable-benchmark/hard-gates.ts tests/unit/durable-benchmark-hard-gates.test.ts
git commit -m "test(agent-os): enforce durable benchmark hard gates"
```

---

### Task 8: Implement metrics, operational rubric and scoring

**Files:**
- Create: `lib/agent-engine/durable-benchmark/scoring.ts`
- Create: `tests/unit/durable-benchmark-scoring.test.ts`

**Interfaces:**

```ts
export interface DurableBenchmarkScore {
  engineId: DurableBenchmarkEngineId;
  reliability: number;
  durability: number;
  observability: number;
  operationalSimplicity: number;
  performance: number;
  cost: number;
  maintainability: number;
  weightedTotal: number;
}

export type DurableBenchmarkDecision =
  | 'KEEP_CURRENT'
  | 'ADOPT_INNGEST'
  | 'ADOPT_VERCEL_WORKFLOW'
  | 'NO_GO'
  | 'INCOMPLETE';
```

Weights are fixed:

```text
reliability              0.40
durability               0.20
observability            0.15
operational simplicity   0.10
performance              0.05
cost                     0.05
lock-in / maintainability 0.05
```

- [ ] **Step 1: Write RED formula tests**

Scores are normalized to `0..100`; weighted total must equal the exact fixed formula.

- [ ] **Step 2: Add RED adoption-rule tests**

Prove:

```text
external engine hard-gate failure -> cannot ADOPT
external advantage < 10 points -> KEEP_CURRENT
tie -> KEEP_CURRENT
missing real-provider evidence -> INCOMPLETE
external >= 10 points + all hard gates + complete evidence -> matching ADOPT decision
no viable complete engine -> NO_GO
```

- [ ] **Step 3: Freeze qualitative rubric**

Operational simplicity and maintainability use explicit 0/25/50/75/100 anchors covering deployment units, required infrastructure, failure debugging, local/test reproducibility, proprietary API dependence and exit/migration difficulty.

- [ ] **Step 4: Execute RED autonomously**

- [ ] **Step 5: Implement scoring and decision**

- [ ] **Step 6: Execute GREEN autonomously**

- [ ] **Step 7: Commit**

```bash
git add lib/agent-engine/durable-benchmark/scoring.ts tests/unit/durable-benchmark-scoring.test.ts
git commit -m "feat(agent-os): score durable runtime benchmark"
```

---

### Task 9: Add machine-readable evidence and comparative benchmark runner

**Files:**
- Create: `lib/agent-engine/durable-benchmark/evidence.ts`
- Create: `lib/agent-engine/durable-benchmark/index.ts`
- Create: `scripts/durable-benchmark-run.ts`
- Create: `tests/unit/durable-benchmark-regression.test.ts`
- Create: `artifacts/agent-os/phase-7/.gitkeep`

**Interfaces:**

```ts
export interface Phase7BenchmarkEvidence {
  generatedAt: string;
  codeSha: string;
  scenarioVersion: string;
  engines: readonly {
    engineId: DurableBenchmarkEngineId;
    engineVersion?: string;
    hardGates: DurableBenchmarkHardGateDecision;
    score?: DurableBenchmarkScore;
    suiteCounts: Record<string, number>;
  }[];
  decision: DurableBenchmarkDecision;
  reasons: readonly string[];
}
```

- [ ] **Step 1: Write RED sanitization tests**

Evidence serializer rejects obvious secrets/tokens, real customer email/phone fields and unexpected production organization identifiers.

- [ ] **Step 2: Write RED deterministic-summary tests**

Given the same normalized run results, score/decision JSON is stable except timestamp/code SHA.

- [ ] **Step 3: Execute RED autonomously**

- [ ] **Step 4: Implement evidence serializer and CLI entry point**

CLI runs only when explicit benchmark enable flag is set. Default invocation without the flag must fail closed before provider calls.

- [ ] **Step 5: Add focused Phase 7 Vitest config or exact file list**

Do not force the whole CRM test suite on every iteration.

- [ ] **Step 6: Execute GREEN autonomously**

- [ ] **Step 7: Commit**

```bash
git add lib/agent-engine/durable-benchmark scripts/durable-benchmark-run.ts tests/unit/durable-benchmark-regression.test.ts artifacts/agent-os/phase-7/.gitkeep
git commit -m "feat(agent-os): add comparative durable benchmark runner"
```

---

### Task 10: Run final benchmark, document evidence and decide

**Files:**
- Create: `docs/architecture/agent-os/phase-7-durable-benchmark.md`
- Create: `docs/architecture/agent-os/phase-7-verification.md`
- Modify: `docs/superpowers/plans/2026-08-17-agent-os-master-implementation-plan.md` only when final evidence supports a Phase 7 decision.

- [ ] **Step 1: Verify prerequisite state**

Confirm the Agent OS has the real SHADOW/ASSISTED workload context required by the master plan before treating the final technology recommendation as authoritative. If prerequisite is not satisfied, code may be verified but final decision remains `INCOMPLETE`.

- [ ] **Step 2: Freeze exact code SHA**

No runtime code change after this SHA without repeating the final technical gate and benchmark.

- [ ] **Step 3: Run focused autonomous code gate**

On the exact code SHA, use the controlled runner/Preview to execute:

```bash
pnpm typecheck
pnpm exec vitest run <all durable-benchmark test files + directly related Agent OS execution/idempotency/approval regressions>
pnpm build
```

Capture exact test-file count, test count, typecheck, build and deployment/runner identity. Do not require the user's terminal.

- [ ] **Step 4: Run real comparative suites**

Run all eight scenarios on `small`, `medium` and `stress` profiles for each available real engine. Use exactly the frozen repetition counts from Task 6.

- [ ] **Step 5: Validate hard gates before scoring**

Any cross-tenant violation, duplicate committed effect, approval bypass, wrong resume, lost recoverable run, retry-limit violation or false terminal success disqualifies that engine from adoption.

- [ ] **Step 6: Calculate raw metrics and weighted scores**

Record exact numerator/denominator and provider/runtime versions. No hand-adjusting results after seeing the winner.

- [ ] **Step 7: Apply the 10-point material-improvement rule**

Output exactly one decision:

```text
KEEP_CURRENT
ADOPT_INNGEST
ADOPT_VERCEL_WORKFLOW
NO_GO
INCOMPLETE
```

`ADOPT_*` is a recommendation only; do not migrate.

- [ ] **Step 8: Write sanitized architecture and verification evidence**

`phase-7-durable-benchmark.md` documents architecture, scenario definitions and score rubric. `phase-7-verification.md` records exact SHA, provider versions, test/build evidence, suite counts, hard gates, raw metrics, scores, decision and limitations.

- [ ] **Step 9: Update Master Plan**

Mark Phase 7 benchmark decision only when evidence is complete. Do not mark an external runtime as adopted/migrated.

- [ ] **Step 10: Prove docs-only closure**

Compare final branch against frozen code SHA. Any post-gate runtime/code change requires repeating Step 3–7.

- [ ] **Step 11: Commit closure**

```bash
git add docs/architecture/agent-os/phase-7-durable-benchmark.md docs/architecture/agent-os/phase-7-verification.md docs/superpowers/plans/2026-08-17-agent-os-master-implementation-plan.md
git commit -m "docs(agent-os): close Phase 7 durable benchmark"
```

---

## Autonomous Execution Doctrine

The user has explicitly authorized autonomous completion and does not want to be used as a local test runner.

During implementation:

1. work only on a dedicated Phase 7 branch derived from the approved Agent OS planning/base branch;
2. never push implementation to `main`;
3. use Superpowers TDD, systematic debugging and verification-before-completion;
4. run targeted tests through autonomous controlled technical runners;
5. use controlled Vercel Preview for the final code gate when available;
6. do not introduce GitHub Actions as a workaround;
7. resolve routine code/config/test failures autonomously;
8. do not ask the user to open PowerShell/VS Code or paste test output;
9. notify the user only when Phase 7 reaches final evidenced decision or a true external prerequisite requires account/credential action that cannot be resolved through available connected tools;
10. if an external provider cannot be exercised for real, retain `INCOMPLETE` rather than fabricate evidence.

## Self-Review

**Spec coverage:** All approved decisions are covered: benchmark-only scope, synthetic journey, eight golden scenarios, three competitors, deterministic faults, pause/resume/crash/idempotency/tenant gates, weighted scoring, 10-point adoption margin, KEEP_CURRENT default on ties/marginal gains, no migration, no production/customer effects, autonomous verification and sanitized evidence.

**Placeholder scan:** No `TBD`, `TODO`, `implement later`, “similar to Task N” or unspecified test steps remain.

**Type consistency:** `DurableBenchmarkEngineId`, `DurableBenchmarkScenarioId`, `DurableBenchmarkRunResult`, `DurableBenchmarkAdapter`, `DurableBenchmarkHardGateDecision`, `DurableBenchmarkScore`, `DurableBenchmarkDecision` and `Phase7BenchmarkEvidence` are introduced once and reused consistently.
