# Agent OS Phase 5 — Assisted Autonomy Design

**Status:** APPROVED DESIGN
**Date:** 2026-08-18

## Goal

Promote selected Agent OS capabilities safely from `SHADOW -> DRAFT -> ASSISTED` using deterministic policy, fresh evaluation evidence, tenant/agent/capability scoping, durable approvals, runtime kill switches and rollback without deploy. This phase does not enable customer-facing autonomy merely by merging code.

## Existing primitives to reuse

Phase 5 extends the existing Agent OS rather than creating a second autonomy system. Reuse:

- `AgentKernel.run()` as the canonical execution owner;
- existing autonomy levels and `evaluateAutonomyControls()`;
- global, tenant, agent and capability kill-switch semantics;
- Tool Gateway and deterministic policy enforcement before side effects;
- durable approval request/decision/enforcement with idempotent replay protection;
- Phase 1/2 observability, run identity, evidence and checkpoint/resume contracts;
- Phase 4 eval evidence as the input to promotion decisions.

No prompt may grant authority that deterministic policy denies.

## Risk model

Capabilities use the canonical risk tiers:

- `R0`: read-only / no side effect;
- `R1`: low-risk, bounded, reversible mutation;
- `R2`: meaningful business mutation requiring policy control;
- `R3`: sensitive/external/high-impact action requiring explicit approval;
- `R4`: destructive, privileged or otherwise non-autonomous action.

Promotion never changes a capability's risk tier. Risk classification is owned by a deterministic registry.

## Promotion model

Promotion is scoped by the tuple:

```text
organizationId + agentId + capabilityId
```

A promotion record contains at minimum:

```text
currentLevel
desiredLevel
capabilityRiskTier
evidenceRef
evidenceObservedAt
requestedBy
approvedBy
reason
rollbackLevel
status
```

Promotion fails closed when evidence is missing, stale, incomplete or below deterministic thresholds. An LLM judge score alone is never sufficient authorization.

## Level semantics

### OFF

No model execution and no side effect.

### SHADOW

Model reasoning, trace and evaluation are allowed. Read-only capabilities may execute when policy permits. Side effects never execute.

### DRAFT

The agent may produce a proposed response, decision or action and persist its evidence. It may not execute side effects. Human final action can be compared against the draft for evaluation.

### ASSISTED

The agent may execute only capabilities permitted by deterministic risk/policy rules:

```text
R0 -> allowed when policy permits
R1 -> allowed when policy permits and promotion evidence is valid
R2 -> approval/policy controlled
R3 -> explicit durable approval required
R4 -> autonomous execution denied
```

`autopilot_low_risk` may be technically exercised by synthetic tests but remains OFF for customer-facing activation at Phase 5 GO. `autopilot_expanded` is not a Phase 5 promotion target.

## 5.1 Promotion Preconditions

Introduce an `AutonomyPromotionGate` that consumes Phase 4 evaluation evidence and deterministic thresholds. Evidence includes at least factual/routing/tool-selection accuracy where applicable, policy compliance, escalation correctness, failure rate, loop-stop rate, latency and cost. The gate records why a promotion was allowed or denied.

## 5.2 Scoped Autonomy Configuration

Store/evaluate autonomy configuration at global, organization, agent and capability scope. The most restrictive applicable control wins. Configuration changes must be observable without requiring an application deploy.

## 5.3 SHADOW to DRAFT

DRAFT persists proposed output/action plus run/evidence identity, never performs a side effect, and supports later comparison to the human-selected outcome.

## 5.4 DRAFT to ASSISTED

ASSISTED uses the existing Tool Gateway. There is no Kernel bypass. Every tool request is checked against current autonomy controls, capability risk and policy immediately before execution.

## 5.5 Approval hardening

The durable flow is:

```text
proposal -> approval request -> approve/deny -> resume -> execute exactly once
```

Required failure cases include expired approval, cancelled request, concurrent decisions, replay, approval for a terminal run and cross-tenant approval access. Approved execution retains the stable idempotency identity established before the pause.

## 5.6 Capability Risk Registry

Create one canonical deterministic registry mapping capability identifiers to R0-R4 and metadata needed by policy. Unknown capabilities fail closed for side effects. Promotion records reference the registry classification but cannot override it.

## 5.7 Runtime rollback and kill switches

Global, organization, agent and capability controls can downgrade/disable autonomy without deploy. Before every side effect, the runtime re-evaluates current controls. A kill switch or downgrade occurring during a run prevents subsequent side effects even if an earlier model step proposed them.

## 5.8 Observability

Every assisted-autonomy decision records enough evidence to explain execution or denial:

```text
organizationId
agentId
runId
capabilityId
autonomyLevel
riskTier
promotionEvidenceRef
policyOutcome
approvalId/status when applicable
execution outcome
rollback/kill-switch state
trace/correlation identity
```

Business events remain separate from work queues.

## 5.9 Adversarial matrix

Tests cover at minimum:

- tenant mismatch;
- forged/cross-tenant approval;
- stale/missing eval evidence;
- disabled capability;
- policy downgrade between proposal and execution;
- R4 request;
- approval replay;
- worker/process interruption after approval;
- repeated side-effect attempt;
- global kill switch during a run;
- malformed promotion configuration;
- model output attempting to request or self-promote autonomy;
- unknown capability fail-closed behavior.

## 5.10 Release gate

Use synthetic/safe capabilities to prove `SHADOW`, `DRAFT` and `ASSISTED` end-to-end. The final gate must prove:

- promotion requires valid recent eval evidence;
- scope is organization/agent/capability specific;
- SHADOW side effects = zero;
- DRAFT side effects = zero;
- ASSISTED obeys risk tiers;
- R2/R3 approval rules are enforced;
- R4 autonomous execution is impossible;
- approval/resume is idempotent;
- kill switch and rollback work without deploy;
- a model cannot mutate its autonomy level;
- decisions are auditable;
- customer-facing autonomy is not activated by merge.

Verification uses the repository's technical gate: targeted RED/GREEN tests during implementation and a controlled final Lumenva Vercel Preview with typecheck, Agent OS Vitest and Next production build. GitHub Actions are not part of this phase's verification path.

## Boundaries

Do not:

- create a second Agent Engine, policy engine, approval engine or autonomy platform;
- move authorization into prompts;
- use LLM judge output as the sole promotion gate;
- change CRM/Postgres source-of-truth ownership;
- activate real customer communications or destructive external actions;
- expose unrestricted database credentials to product agents;
- apply remote migrations as an implicit part of implementation;
- touch `main`, production, billing or secrets without separate explicit authorization.

## Relationship to historical AI Platform Phase 5

The historical AI Platform Phase 5 evaluated external guardrails and concluded `GO WITHOUT EXTERNAL ACTIVATION`. Agent OS Phase 5 does not reopen that decision. Native deterministic controls remain authoritative; the existing external guardrail seam stays optional and unwired unless future evidence identifies a concrete gap.

## GO decision

Phase 5 may be marked GO when the release gate above is freshly verified and evidence is recorded. GO means the assisted-autonomy architecture is safe and promotable; it does not itself authorize customer-facing autonomy.