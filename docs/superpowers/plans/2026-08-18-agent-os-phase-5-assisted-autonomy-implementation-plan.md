# Agent OS Phase 5 — Assisted Autonomy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a governed promotion layer that safely moves selected capabilities from `SHADOW -> DRAFT -> ASSISTED` using deterministic eval gates, scoped autonomy state, canonical risk classification, durable approvals, runtime rollback and auditable evidence.

**Architecture:** Extend the existing Agent OS policy/approval/Kernel primitives; do not create a second autonomy platform. Promotion state is represented through an internal store port keyed by `organizationId + agentId + capabilityId`, the most restrictive runtime control wins, and every side effect re-checks current autonomy/risk/policy immediately before execution. Persistence adapters may be added behind the port, but no remote migration is applied by this plan.

**Tech Stack:** TypeScript, Vitest, existing `lib/agent-engine`, existing Tool Gateway/Policy Engine/AgentKernel, Postgres/Supabase ports where already available, Vercel Preview gate.

**Spec:** `docs/superpowers/specs/2026-08-18-agent-os-phase-5-assisted-autonomy-design.md`

## Global Constraints

- Reuse `AgentKernel.run()` as canonical execution owner.
- Reuse the existing Policy Engine, Tool Gateway, approval flow and run/evidence contracts.
- No prompt may grant authority that deterministic policy denies.
- Promotion is always scoped by `organizationId + agentId + capabilityId`.
- Promotion never changes a capability risk tier.
- Missing/stale/incomplete eval evidence fails closed.
- SHADOW and DRAFT execute zero side effects.
- R4 remains non-autonomous.
- `autopilot_low_risk` may be exercised only synthetically in this phase; customer-facing activation stays OFF.
- Do not create a second Agent Engine, policy engine, approval engine or autonomy platform.
- Do not apply remote migrations, touch `main`, production, billing, secrets, or real external communications.
- GitHub Actions are not part of this phase's verification path; final technical verification uses a controlled Lumenva Vercel Preview.

---

## File Structure

Create or evolve these focused units:

```text
lib/agent-engine/autonomy/
  promotion.ts              # eval-backed promotion decision
  store.ts                  # scoped autonomy state port + memory test adapter
  risk-registry.ts          # canonical capability -> risk mapping
  decision.ts               # runtime effective-level resolution
  evidence.ts               # autonomy decision evidence envelope

lib/agent-engine/contracts/
  autonomy-promotion.test.ts
  autonomy-scoping.test.ts
  autonomy-draft.test.ts
  autonomy-assisted.test.ts
  autonomy-approval-hardening.test.ts
  autonomy-risk-registry.test.ts
  autonomy-runtime-rollback.test.ts
  autonomy-adversarial.test.ts
  autonomy-phase-5-integration.test.ts
```

Existing files expected to change:

```text
lib/agent-engine/policies/autonomy.ts
lib/agent-engine/policies/engine.ts
lib/agent-engine/policies/approval.ts
lib/agent-engine/tools/gateway.ts
lib/agent-engine/kernel/agent-kernel.ts
lib/agent-engine/kernel/ports.ts
vitest.agent-os.config.ts
docs/architecture/agent-os/policies.md
docs/architecture/agent-os/execution.md
docs/superpowers/plans/2026-08-17-agent-os-master-implementation-plan.md
```

---

### Task 1: Autonomy Promotion Gate

**Files:**
- Create: `lib/agent-engine/autonomy/promotion.ts`
- Test: `lib/agent-engine/contracts/autonomy-promotion.test.ts`

**Interfaces:**
- Consumes: Phase 4 evaluation evidence supplied as a typed value.
- Produces:

```ts
export interface AutonomyEvalEvidence {
  ref: string;
  observedAt: string;
  policyCompliance: number;
  failureRate: number;
  loopStopRate: number;
  factualAccuracy?: number;
  routingAccuracy?: number;
  toolSelectionAccuracy?: number;
  escalationAccuracy?: number;
  p95LatencyMs: number;
  avgCostCents: number;
}

export interface PromotionThresholds {
  maxEvidenceAgeMs: number;
  minPolicyCompliance: number;
  maxFailureRate: number;
  maxLoopStopRate: number;
}

export type PromotionDecision =
  | { kind: 'allow'; evidenceRef: string }
  | { kind: 'deny'; reason: 'missing_evidence' | 'stale_evidence' | 'policy_compliance_below_threshold' | 'failure_rate_above_threshold' | 'loop_stop_rate_above_threshold' };

export function evaluateAutonomyPromotion(input: {
  evidence: AutonomyEvalEvidence | null;
  nowMs: number;
  thresholds: PromotionThresholds;
}): PromotionDecision;
```

- [ ] **Step 1: Write RED tests** for missing evidence, stale evidence, low policy compliance, high failure rate, high loop-stop rate and a passing case.
- [ ] **Step 2: Run** `pnpm exec vitest run lib/agent-engine/contracts/autonomy-promotion.test.ts` and verify failures are caused by the missing module/behavior.
- [ ] **Step 3: Implement** `evaluateAutonomyPromotion()` as deterministic threshold logic; do not call a model.
- [ ] **Step 4: Re-run** the focused suite and `pnpm typecheck`.
- [ ] **Step 5: Commit** `feat(agent-os): add eval-backed autonomy promotion gate`.

---

### Task 2: Scoped Autonomy State

**Files:**
- Create: `lib/agent-engine/autonomy/store.ts`
- Create: `lib/agent-engine/autonomy/decision.ts`
- Test: `lib/agent-engine/contracts/autonomy-scoping.test.ts`

**Interfaces:**

```ts
export interface CapabilityAutonomyKey {
  organizationId: string;
  agentId: string;
  capabilityId: string;
}

export interface CapabilityAutonomyRecord extends CapabilityAutonomyKey {
  currentLevel: AgentAutonomyLevel;
  desiredLevel: AgentAutonomyLevel;
  evidenceRef: string;
  evidenceObservedAt: string;
  requestedBy: string;
  approvedBy: string;
  reason: string;
  rollbackLevel: AgentAutonomyLevel;
  status: 'active' | 'rolled_back' | 'disabled';
}

export interface AutonomyStateStore {
  load(key: CapabilityAutonomyKey): Promise<CapabilityAutonomyRecord | null>;
  save(record: CapabilityAutonomyRecord): Promise<void>;
}

export function resolveEffectiveAutonomy(input: {
  requestedLevel: AgentAutonomyLevel;
  globalEnabled: boolean;
  tenantEnabled: boolean;
  agentEnabled: boolean;
  capability: CapabilityAutonomyRecord | null;
}): { level: AgentAutonomyLevel; enabled: boolean; reason?: string };
```

- [ ] **Step 1: Write RED tests** proving tenant/agent/capability records do not bleed across keys and that the most restrictive applicable control wins.
- [ ] **Step 2: Run** the focused suite and confirm expected RED.
- [ ] **Step 3: Implement** the port, a deterministic in-memory adapter for tests, and effective-level resolution.
- [ ] **Step 4: Re-run** tests and typecheck.
- [ ] **Step 5: Commit** `feat(agent-os): scope autonomy by tenant agent capability`.

---

### Task 3: Canonical Capability Risk Registry

**Files:**
- Create: `lib/agent-engine/autonomy/risk-registry.ts`
- Test: `lib/agent-engine/contracts/autonomy-risk-registry.test.ts`
- Modify: `lib/agent-engine/policies/engine.ts`

**Interfaces:**

```ts
export type CapabilityRiskTier =
  | 'r0_read'
  | 'r1_reversible_write'
  | 'r2_external_communication'
  | 'r3_sensitive_commercial'
  | 'r4_destructive_admin';

export interface CapabilityRiskDefinition {
  capabilityId: string;
  risk: CapabilityRiskTier;
  hasSideEffect: boolean;
}

export interface CapabilityRiskRegistry {
  get(capabilityId: string): CapabilityRiskDefinition | null;
}
```

- [ ] **Step 1: Write RED tests** for canonical lookup, unknown capability, and an attempted promotion payload that claims a different risk than the registry.
- [ ] **Step 2: Run** focused tests and verify RED.
- [ ] **Step 3: Implement** the registry abstraction and update policy inputs to consume registry-owned risk rather than caller-overridable promotion metadata.
- [ ] **Step 4: Verify** unknown side-effecting capability fails closed.
- [ ] **Step 5: Commit** `feat(agent-os): add canonical capability risk registry`.

---

### Task 4: SHADOW and DRAFT Semantics

**Files:**
- Modify: `lib/agent-engine/policies/autonomy.ts`
- Modify: `lib/agent-engine/policies/engine.ts`
- Test: `lib/agent-engine/contracts/autonomy-draft.test.ts`

**Interfaces:**
- SHADOW: model allowed; read-only tools allowed when policy permits; side effects denied.
- DRAFT: model allowed; read-only tools allowed; any side-effecting tool returns a draft/proposal outcome and does not reach the executor.

- [ ] **Step 1: Write RED tests** proving SHADOW and DRAFT produce zero side effects, including R1/R2/R3 proposals.
- [ ] **Step 2: Run** focused tests and verify RED against current `draft` behavior, which currently routes side effects to approval rather than guaranteeing draft-only semantics.
- [ ] **Step 3: Update** autonomy/policy decisions with an explicit draft outcome at the Tool Gateway boundary rather than executing or creating approval.
- [ ] **Step 4: Re-run** focused tests plus existing `autonomy-controls.test.ts` and `policy-engine.test.ts`.
- [ ] **Step 5: Commit** `feat(agent-os): enforce side-effect-free draft autonomy`.

---

### Task 5: ASSISTED Risk Semantics

**Files:**
- Modify: `lib/agent-engine/policies/engine.ts`
- Modify: `lib/agent-engine/tools/gateway.ts`
- Test: `lib/agent-engine/contracts/autonomy-assisted.test.ts`

**Required behavior:**

```text
R0 -> allow when policy permits
R1 -> allow when promotion evidence is valid and no stronger policy denies
R2 -> policy/approval controlled
R3 -> explicit durable approval
R4 -> deny
```

- [ ] **Step 1: Write RED tests** for each R0-R4 outcome under `assisted`.
- [ ] **Step 2: Run** the focused suite; confirm current R1 behavior fails because it always requires approval.
- [ ] **Step 3: Implement** promotion-aware assisted policy input and minimal Tool Gateway wiring.
- [ ] **Step 4: Re-run** new and existing policy/tool-gateway suites.
- [ ] **Step 5: Commit** `feat(agent-os): enforce assisted autonomy risk tiers`.

---

### Task 6: Approval Hardening and Exactly-Once Resume

**Files:**
- Modify: `lib/agent-engine/policies/approval.ts`
- Modify: `lib/agent-engine/kernel/agent-kernel.ts`
- Modify: `lib/agent-engine/kernel/ports.ts`
- Test: `lib/agent-engine/contracts/autonomy-approval-hardening.test.ts`

**Interfaces:**
- Existing approval IDs and idempotency keys remain stable across pause/resume.
- Add explicit approval terminal states if not already present: `expired`, `cancelled`.
- Cross-tenant lookup must fail closed.

- [ ] **Step 1: Write RED tests** for expired approval, cancelled approval, two concurrent decisions, replay after approval, approval against a terminal run, cross-tenant approval access and crash-after-approval-before-checkpoint.
- [ ] **Step 2: Run** focused tests and record exact failures.
- [ ] **Step 3: Implement** deterministic transition checks and tenant binding without changing the stable idempotency identity.
- [ ] **Step 4: Re-run** both the new suite and existing `approval-contract.test.ts` / `agent-kernel-resume.test.ts`.
- [ ] **Step 5: Commit** `fix(agent-os): harden assisted approval resume`.

---

### Task 7: Runtime Kill Switch and Rollback

**Files:**
- Modify: `lib/agent-engine/kernel/agent-kernel.ts`
- Modify: `lib/agent-engine/policies/autonomy.ts`
- Modify: `lib/agent-engine/tools/gateway.ts`
- Test: `lib/agent-engine/contracts/autonomy-runtime-rollback.test.ts`

**Interface:**

```ts
export interface RuntimeAutonomyResolver {
  resolve(key: CapabilityAutonomyKey): Promise<{
    level: AgentAutonomyLevel;
    globalEnabled: boolean;
    tenantEnabled: boolean;
    agentEnabled: boolean;
    capabilityEnabled: boolean;
  }>;
}
```

- [ ] **Step 1: Write RED tests** where a run starts enabled, then global/tenant/agent/capability is disabled before the next side effect.
- [ ] **Step 2: Run** and verify the current cached decision allows a side effect in the RED scenario.
- [ ] **Step 3: Re-resolve** autonomy immediately before each side-effecting Tool Gateway execution; most restrictive control wins.
- [ ] **Step 4: Prove** downgrade/rollback takes effect without a deploy and without restarting the run.
- [ ] **Step 5: Commit** `feat(agent-os): recheck autonomy before side effects`.

---

### Task 8: Assisted Autonomy Evidence Envelope

**Files:**
- Create: `lib/agent-engine/autonomy/evidence.ts`
- Modify: `lib/agent-engine/kernel/agent-kernel.ts`
- Test: `lib/agent-engine/contracts/autonomy-adversarial.test.ts`

**Interfaces:**

```ts
export interface AutonomyDecisionEvidence {
  organizationId: string;
  agentId: string;
  runId: string;
  capabilityId: string;
  autonomyLevel: AgentAutonomyLevel;
  riskTier: CapabilityRiskTier;
  promotionEvidenceRef: string | null;
  policyOutcome: string;
  approvalId: string | null;
  approvalStatus: string | null;
  executionOutcome: string;
  traceId: string;
  correlationId: string;
}
```

- [ ] **Step 1: Write RED assertions** proving allow, deny, draft, approval and rollback paths each emit a complete autonomy envelope.
- [ ] **Step 2: Run** the suite and verify missing evidence fields are the failure cause.
- [ ] **Step 3: Implement** one evidence builder and wire it into existing evidence recording; do not create a parallel telemetry system.
- [ ] **Step 4: Re-run** evidence, Kernel and observability contract suites.
- [ ] **Step 5: Commit** `feat(agent-os): record assisted autonomy decisions`.

---

### Task 9: Full Adversarial Matrix

**Files:**
- Test: `lib/agent-engine/contracts/autonomy-adversarial.test.ts`
- Modify only the smallest affected implementation files when a test exposes a real defect.

- [ ] **Step 1: Add contract cases** for tenant mismatch, forged/cross-tenant approval, stale eval, disabled capability, policy downgrade, R4 request, replay, crash after approval, repeated side effect, global kill during run, malformed promotion state, model self-promotion attempt and unknown capability.
- [ ] **Step 2: Run** the complete file and classify every failure as missing behavior vs test defect.
- [ ] **Step 3: Fix** implementation gaps one at a time using systematic-debugging; never weaken a deterministic guard to satisfy the test.
- [ ] **Step 4: Re-run** the adversarial suite plus all Agent OS contract tests.
- [ ] **Step 5: Commit** `test(agent-os): close Phase 5 autonomy adversarial matrix`.

---

### Task 10: Phase 5 End-to-End Release Gate

**Files:**
- Create: `lib/agent-engine/contracts/autonomy-phase-5-integration.test.ts`
- Modify: `vitest.agent-os.config.ts` only if discovery requires it.
- Create after GREEN: `docs/architecture/agent-os/phase-5-verification.md`
- Modify after GREEN: `docs/architecture/agent-os/policies.md`
- Modify after GREEN: `docs/architecture/agent-os/execution.md`
- Modify after GREEN: `docs/superpowers/plans/2026-08-17-agent-os-master-implementation-plan.md`

**Synthetic journeys:**

```text
SHADOW read-only -> decision/evidence, zero side effect
DRAFT R1 -> proposal/evidence, zero side effect
ASSISTED R1 -> executes once with valid promotion evidence
ASSISTED R2 -> approval controlled
ASSISTED R3 -> explicit approval -> resume -> execute once
ASSISTED R4 -> denied
kill switch during run -> subsequent side effect blocked
autopilot_low_risk synthetic R1 -> technically works but activation state remains OFF
```

- [ ] **Step 1: Write the final integration tests** covering all journeys above.
- [ ] **Step 2: Run** targeted tests and fix only real Phase 5 gaps.
- [ ] **Step 3: Run full technical verification** locally/through the repository-supported runner: `pnpm typecheck` and `pnpm exec vitest run --config vitest.agent-os.config.ts`.
- [ ] **Step 4: Freeze the final code SHA**; avoid intermediate Preview churn.
- [ ] **Step 5: Run one controlled Lumenva Vercel Preview** executing `pnpm typecheck && pnpm exec vitest run --config vitest.agent-os.config.ts && pnpm build`.
- [ ] **Step 6: Require Vercel `READY`** and capture exact file/test counts, SHA and deployment ID.
- [ ] **Step 7: Write `phase-5-verification.md`** with exact evidence and explicit statement that no customer-facing autonomy was activated.
- [ ] **Step 8: Update architecture docs** to describe promotion/risk/rollback ownership and update the master plan to `PHASE 5 — GO` only if the fresh gate is GREEN.
- [ ] **Step 9: Re-run a documentation-only final verification** sufficient to ensure the recorded SHA/results are not contradicted by the closure docs; do not claim a newer code gate than was actually run.
- [ ] **Step 10: Commit** `docs(agent-os): record Phase 5 assisted autonomy GO`.

---

## Final GO Checklist

- [ ] Promotion requires valid, recent deterministic eval evidence.
- [ ] Autonomy is scoped by organization + agent + capability.
- [ ] Capability risk tier is registry-owned and non-overridable by promotion/model output.
- [ ] SHADOW side effects = 0.
- [ ] DRAFT side effects = 0.
- [ ] ASSISTED R0/R1 behavior matches deterministic policy.
- [ ] R2/R3 approval rules are enforced.
- [ ] R4 autonomous execution is impossible.
- [ ] Approval/resume is exactly-once under replay/crash.
- [ ] Kill switches and rollback take effect without deploy.
- [ ] Runtime rechecks autonomy before each side effect.
- [ ] Model output cannot self-promote autonomy.
- [ ] Every decision has auditable evidence.
- [ ] `autopilot_low_risk` remains customer-facing OFF after Phase 5 GO.
- [ ] Typecheck, Agent OS Vitest, Next build and final Lumenva Preview are GREEN/READY.

## Self-Review

- Spec coverage: Tasks 1-10 map directly to design sections 5.1-5.10.
- Placeholder scan: no TBD/TODO/"implement later" requirements remain.
- Type consistency: `CapabilityAutonomyKey`, `CapabilityAutonomyRecord`, `CapabilityRiskTier`, `AutonomyEvalEvidence`, `RuntimeAutonomyResolver` and `AutonomyDecisionEvidence` are defined once and consumed by later tasks with the same names.
- Scope: Phase 5 is one coherent autonomy-promotion subsystem layered on existing Agent OS primitives; no independent external guardrail or customer activation project is included.
