# Hermes Unified Learning OS — Design

**Date:** 2026-09-13  
**Status:** architecture approved in chat; written spec awaiting final review before implementation planning  
**Target repository:** `trydavidqix/Lumenva`  
**Base:** `main@17411bba65e737ce2ec6cc4bb4f338ebe92d29c9`

## 1. Decision

Lumenva will not create a second autonomous learning stack beside the existing Agent OS.

The existing **Phase 6 Learning Flywheel** in `apps/crm/lib/agent-engine/flywheel/` becomes the canonical governed core of a unified subsystem named **Hermes Learning OS**.

Hermes consolidates useful, already-built patterns from other owned repositories without importing their storage or authority models blindly:

- **Lumenva `main`** — canonical learning proposal lifecycle, evals, SHADOW/DRAFT rollout, monitoring, rollback, tenant scope and policy boundaries.
- **Helixforge `implementation/v3`** — scientific experiment memory, project fingerprints, controlled knowledge transfer, cross-project retrieval and meta-research.
- **lumenva-social-brain `codex/adaptive-expert-v1`** — task/risk/execution classification, capability fingerprints, stale-trust invalidation, evidence states, adversarial review and routing/context efficiency.
- **EINVIRKI `v1-ai-saas-factory` and `v5-autonomous-ai-company-os`** — outcome ledger, action-to-KPI learning and strategy feedback loops.
- **Alfred `feat/alfred-v0.1-mvp`** — evidence-only improvement proposals for model/runtime/infrastructure changes.
- **Agent-Os- `main`** — constitutional lifecycle: `observe -> hypothesis -> shadow -> eval -> proposal -> approval/policy -> promotion -> rollback capability`.

Hermes is a **learning and proposal system**, not a sovereign runtime and not a self-modifying agent.

## 2. System boundary

The final ownership model is:

```text
Maestri = ORCHESTRATE
Lumenva = GOVERN
Mastra/runtime adapter = EXECUTE
Hermes = LEARN
Models/workers = THINK / BUILD / ACT
```

Hermes observes execution and business outcomes, discovers patterns, proposes bounded changes, evaluates candidates and manages learning evidence. Lumenva remains the authority for tenant identity, business state, policy, risk, approvals, evidence, autonomy and promotion.

### Non-negotiable rule

```text
Hermes may propose a change.
Hermes may evaluate a change.
Hermes may recommend promotion.
Hermes may never grant itself authority to activate a change.
```

The current rule that models cannot promote autonomy remains intact.

## 3. Source of truth

Postgres/Supabase remains the authoritative business and governance store.

External or local learning stores are not allowed to become a second transactional truth.

```text
L0 Postgres/Lumenva     authoritative truth
L1 CRM context          business projection
L2 graph/long memory    rebuildable projection
L3 runtime memory       execution projection
L4 Hermes research      learning evidence/proposals
```

L1-L4 can inform decisions but cannot silently overwrite L0.

## 4. Existing Lumenva core to preserve

The following existing code remains canonical and must be extended rather than replaced by a parallel implementation:

```text
apps/crm/lib/agent-engine/flywheel/
├── contracts.ts
├── signals.ts
├── clustering.ts
├── proposals.ts
├── eval-candidates.ts
├── validator.ts
├── rollout.ts
├── monitoring.ts
├── orchestrator.ts
└── store.ts
```

The existing proposal lifecycle is preserved:

```text
detected
  ↓
clustered
  ↓
candidate_created
  ↓
validating
  ↓
ready_for_human_review
  ↓
approved
  ↓
rolling_out_shadow
  ↓
rolling_out_draft
  ↓
monitoring
  ↓
closed
```

Failure paths remain first-class:

```text
rejected_by_validation
rejected
revision_requested
rollback_recommended
rolled_back
```

No implementation may collapse those states into a generic `done`/`failed` model.

## 5. Hermes architecture

Hermes is composed from eight bounded capabilities.

```text
EXECUTION + BUSINESS STATE
          │
          ▼
   1. Signal Ingestion
          │
          ▼
   2. Research Memory
          │
          ▼
 3. Retrieval/Fingerprints
          │
          ▼
   4. Meta-Research
          │
          ▼
 5. Candidate Synthesis
          │
          ▼
 6. Validation / Evals
          │
          ▼
 7. SHADOW / DRAFT rollout
          │
          ▼
 8. Monitoring / Outcome
          │
      ┌───┴────┐
      ▼        ▼
   promote   rollback
      │
      └──────→ Research Memory
```

### 5.1 Signal Ingestion

Hermes receives normalized signals from sources such as:

- agent run success/failure;
- tool errors and repeated-tool breaker events;
- human correction;
- handoff/escalation;
- policy denial;
- timeout/circuit breaker;
- model/provider failure;
- eval failure;
- latency/cost anomalies;
- customer outcome;
- conversion/KPI delta;
- deployment/build/test evidence;
- reviewer findings.

Raw customer content is not a learning artifact by default. Signal records should prefer references, fingerprints and sanitized structured facts over copying transcripts.

Existing tenant scope remains mandatory:

```text
organizationId
agentId
capabilityId
```

Additional source identity may be attached only when useful:

```text
missionId?
runId?
workflowId?
sessionId?
traceId?
agentVersion?
```

### 5.2 Scientific Research Memory

Helixforge V3 contributes the scientific method, not its JSONL persistence model.

Hermes stores normalized experiment evidence in Postgres using append-only semantics where history matters.

A research experiment contains conceptually:

```text
experiment id
organization id
subject kind + subject id
project/agent fingerprint
hypothesis
strategy
baseline metrics
candidate metrics
status: keep | discard | crash | inconclusive
evidence refs
files/capabilities/categories touched
model/researcher metadata
timestamps
source version/commit when applicable
```

Past evidence is never treated as authority for a new environment. Reused knowledge carries `must_retest = true`.

### 5.3 Fingerprint + Controlled Knowledge Transfer

Hermes adopts Helixforge's controlled retrieval principle.

A non-secret fingerprint may include:

- product/domain tags;
- language/runtime;
- package manager;
- selected dependency identities;
- agent definition/version;
- capability set;
- workflow family;
- model policy class;
- optional operator tags.

Retrieval ranks prior evidence using a bounded score combining:

```text
context/project similarity
+ goal overlap
+ metric compatibility
+ prior outcome quality
+ freshness
```

Retrieved evidence is surfaced as a hypothesis to re-test, never as a direct patch to apply.

### 5.4 Meta-Research

Hermes aggregates historical experiments to learn which methods work.

Initial dimensions:

- keep rate;
- crash rate;
- mean quality score;
- mean KPI improvement;
- cost delta;
- latency delta;
- strategy performance;
- model/provider performance;
- reviewer/researcher performance;
- repeated failure signatures;
- useful number of rounds by task class;
- routing correctness by task class.

Meta-research creates recommendations only. It does not rewrite policy or runtime configuration directly.

### 5.5 Adaptive Expert layer

The useful parts of `adaptive-expert` become an Agent Optimization capability inside Hermes.

Hermes may classify learning/eval cases using:

```text
Domain: software | security | database | infrastructure | AI | research | product | data | business | general
Complexity: QUICK | STANDARD | DEEP | CRITICAL
Risk: LOW | MEDIUM | HIGH
Execution: MAIN | SKILL | SUBAGENT | TEAM | WORKFLOW
```

The optimization target is not "maximum number of agents". It is the **smallest sufficient execution shape** that meets quality, evidence and risk requirements.

Hermes must track routing outcomes including:

- correct route;
- unnecessary worker count;
- missing specialist;
- excessive context;
- token/cost overhead;
- reviewer value;
- false PASS count.

Capability trust is identity-bound. If a Skill/tool/provider definition changes version, immutable revision, content fingerprint, permissions, scripts or network behavior, prior trust becomes stale and requires reinspection/re-evaluation.

### 5.6 Outcome Ledger

EINVIRKI contributes outcome-oriented learning.

A successful technical run is not automatically a successful business outcome.

Hermes links, where available:

```text
mission/action
→ evidence
→ cost
→ latency
→ quality
→ business KPI
→ outcome window
```

Examples:

- lower response latency but worse conversion;
- better accuracy but materially higher cost;
- cheaper model with unchanged customer outcome;
- workflow change that reduces handoffs;
- new prompt that improves conversion but increases policy violations — therefore rejected.

Outcome learning must distinguish correlation from promotion evidence. A KPI improvement alone cannot bypass safety/eval gates.

### 5.7 Improvement Candidate Registry

Existing proposal types are expanded carefully.

Current types remain valid:

```text
skill_change
routing_change
eval_case
operational_threshold
```

Target additional types:

```text
prompt_change
workflow_change
agent_definition_change
model_policy_change
resource_route_change
memory_policy_change
context_policy_change
infra_change
strategy_change
```

Each candidate requires:

```text
scope
current state ref
proposed state ref or bounded patch
hypothesis
expected benefit
known regressions
risk class
cost estimate when relevant
evidence refs
rollback target
required eval suite
promotion policy
```

Candidates are immutable/versioned once entering validation. A revision creates a new version/fingerprint.

### 5.8 Validation, rollout and monitoring

The current Lumenva validator remains the base contract.

Required evidence classes:

```text
regression
GOLDEN
safety
SHADOW
business/KPI when relevant
cost/latency when relevant
```

Evidence states adopted from Adaptive Expert:

```text
PASS
FAIL
NOT_EXECUTED
NOT_PROVEN
BLOCKED
```

`NOT_EXECUTED`, remembered success, worker confidence or a previous project's PASS can never be silently converted to PASS.

Promotion remains bounded:

```text
candidate
→ offline eval
→ SHADOW
→ human/system approval under policy
→ DRAFT/CANARY where applicable
→ monitoring
→ active/restore
```

Critical safety regression triggers safe rollback. Non-critical regression recommends rollback and requires policy/operator decision according to current autonomy rules.

## 6. Improvement domains

Hermes V1 unification supports learning across six domains.

### Agent quality

- prompt;
- agent definition;
- routing;
- capability selection;
- tool selection;
- context construction;
- escalation.

### Skills/tools

- new Skill proposal;
- Skill improvement;
- tool policy/timeout/retry recommendation;
- tool deprecation candidate;
- capability trust/fingerprint change.

### Models

- provider/model recommendation;
- model-policy tier recommendation;
- quality/cost/latency comparison;
- fallback ordering recommendation.

Hermes recommends model changes; it does not install/download/activate a model without the existing authority path.

### Workflows

- sequencing;
- fan-out/fan-in;
- bounded retries;
- repair-loop thresholds;
- handoff conditions;
- workflow candidate variants.

### Resources/infrastructure

- resource class recommendation;
- host routing;
- saturation/failure evidence;
- sandbox/runtime recommendation;
- browser provider recommendation.

### Business strategy

- follow-up strategy;
- sales/support behavior;
- channel strategy;
- content/marketing workflows;
- operational threshold.

Business strategy candidates still pass business policy and approval gates.

## 7. Maestri, Mastra/runtime and Hermes separation

Hermes does not absorb Maestri or the execution runtime.

```text
Maestri
  decides workforce / priority / strategic budget
        │
        ▼
Lumenva
  validates tenant / policy / approval / budget
        │
        ▼
Execution Runtime (native during migration, Mastra target)
  executes agents/workflows/tools
        │
        ▼
Evidence + outcomes
        │
        ▼
Hermes
  learns and proposes
        │
        ▼
Lumenva promotion gates
```

Per-turn model/tool choices belong to the execution boundary and model/tool policies, not Maestri.

Hermes may propose a routing/model policy change after evidence, but it never bypasses Lumenva to apply it.

## 8. Storage design principles

Implementation must follow existing Lumenva schema doctrine.

Do not create a parallel SQLite/JSONL production database.

The existing `flywheel_distiller_proposals` table remains the proposal compatibility store during migration. New durable research/outcome entities may be introduced only when DIRC analysis proves they cannot cleanly live in an existing canonical structure.

Any new tenant-aware table must include `organization_id`, RLS, baseline append, migration manifest entry, generated types and cross-tenant tests.

Research memory is append-oriented. Corrections supersede prior records via references/status rather than deleting historical evidence.

## 9. Privacy and security

Hermes is a high-value aggregation surface and must be stricter than ordinary logs.

Rules:

- no secrets/tokens/cookies in learning records;
- no raw `.env` or credential artifacts;
- no unrestricted `service_role` access for agents;
- tenant identity only from trusted server context;
- no cross-tenant retrieval;
- customer transcripts are not committed to fixtures;
- learning datasets use sanitized/synthetic fixtures;
- direct email/phone/PII is removed from replay/eval artifacts where the existing privacy contract requires;
- side effects remain behind policy/idempotency/approval;
- high-risk actions remain human-gated according to canonical policy;
- Hermes cannot broaden an agent's capability set or autonomy by itself.

## 10. Night learning loop

Hermes may run periodically, but scheduling is an operational policy, not a hard-coded product rule.

A default deployment may choose a night window such as:

```text
collect
→ normalize
→ cluster
→ retrieve prior evidence
→ synthesize bounded candidates
→ run offline evals
→ rank recommendations
→ publish review queue
```

The loop must have explicit budgets for:

- max signals;
- max clusters;
- max candidates;
- tokens;
- cost;
- runtime;
- no-progress stop;
- concurrency.

The existing `FlywheelLoopBudget` is the baseline contract to extend.

## 11. Command Center surface

Hermes remains observable through Lumenva.

Target views:

```text
/command/learning
/command/learning/candidates
/command/learning/experiments
/command/learning/outcomes
/command/learning/meta
```

The UI is not the first implementation milestone. Contracts, storage, evals and security come first.

Useful metrics:

- signals processed;
- clusters detected;
- candidates created;
- candidates rejected;
- candidates promoted;
- rollback rate;
- average measured improvement;
- cost saved/added;
- false PASS count;
- policy/safety regressions;
- knowledge transfers re-tested;
- top recurring failure patterns.

## 12. Migration strategy

The migration must consolidate, not duplicate.

### Phase H0 — Freeze current truth

Record current Flywheel contracts and tests as baseline.

### Phase H1 — Hermes naming and façade

Introduce a canonical Hermes service/interface that delegates to existing Flywheel primitives. Do not rename the entire `flywheel/` directory yet.

### Phase H2 — Research Memory

Port Helixforge scientific record/fingerprint/retrieval concepts into tenant-aware Lumenva contracts and Postgres storage.

### Phase H3 — Outcome Ledger

Add governed action/run → evidence → cost/quality/KPI outcome records.

### Phase H4 — Adaptive Expert metrics

Add routing/capability/context/reviewer metrics and capability identity fingerprints.

### Phase H5 — Candidate expansion

Extend proposal types and candidate manifests without breaking existing Phase 6 records.

### Phase H6 — Meta-Research

Aggregate strategy/model/routing/failure performance and produce recommendations.

### Phase H7 — Cross-project transfer

Allow prior evidence retrieval with `must_retest=true`; never promote from transferred evidence alone.

### Phase H8 — Runtime integration

Consume traces/evidence from the current execution runtime and later Mastra through stable adapters.

### Phase H9 — Command Center

Expose experiments, candidates, outcomes, monitoring and meta-research.

### Phase H10 — Cleanup

Only after production evidence proves parity, remove duplicated learning code from external/legacy locations or mark those repositories as reference-only. Do not delete source history required for audit.

## 13. What is deliberately not copied

### From Helixforge

Do not copy production JSONL as Lumenva's durable store. Keep its scientific-memory semantics and deterministic fingerprints.

### From Adaptive Expert

Do not create a second trust database or permanent specialist fleet. Bring the identity/freshness/evidence/routing principles into canonical Lumenva contracts.

### From EINVIRKI

Do not create another Company Brain or strategic authority. Import Outcome Ledger and measurable strategy-learning patterns only.

### From Alfred

Do not allow automatic model downloads/installation/self-update. Import evidence-only improvement proposals and hardware-fit reasoning.

### From Agent-Os-

Do not duplicate another Agent OS. Import the constitutional learning lifecycle and governance invariants.

## 14. Success criteria

Hermes V1 unification is complete when all of the following are proven with current evidence:

1. Existing Phase 6 Flywheel behavior remains compatible.
2. A failed/successful agent run can produce a tenant-scoped learning signal without raw secret leakage.
3. A learning signal can create or enrich a bounded candidate.
4. Research evidence persists and can be retrieved for a similar context without cross-tenant leakage.
5. Retrieved prior evidence is marked for re-test and cannot directly promote a candidate.
6. Candidate validation records regression, golden, safety and SHADOW states explicitly.
7. `NOT_PROVEN` and `BLOCKED` remain distinct from PASS.
8. A critical safety regression triggers the existing safe rollback path.
9. Outcome records can connect a technical candidate to measurable cost/quality/KPI evidence where available.
10. Meta-research can identify repeated failures and compare at least two strategies/routes/providers without applying a change automatically.
11. A model cannot promote its own autonomy or candidate.
12. Capability identity change invalidates previously cached trust/evidence where the identity-bound contract applies.
13. Cross-tenant tests prove no research/candidate retrieval leakage.
14. Existing relevant unit/db/harness gates pass.
15. No parallel learning source of truth is introduced.

## 15. Testing strategy

Implementation follows TDD.

Required suites by layer:

```text
contracts
  deterministic parsing/state transitions

research memory
  append/supersede/dedupe
  tenant isolation

fingerprints/retrieval
  deterministic fingerprint
  similarity ranking
  freshness
  must_retest

adaptive routing metrics
  task classification fixtures
  route/worker/context overhead
  capability identity invalidation

candidate validation
  regression/golden/safety/shadow
  PASS/FAIL/NOT_EXECUTED/NOT_PROVEN/BLOCKED

outcome ledger
  technical + business metrics
  no unsafe promotion from KPI alone

monitoring
  regression detection
  critical safety rollback

integration
  signal → candidate → eval → approval → shadow → monitoring

security/db
  cross-tenant denial
  RLS
  PII/secret sanitization
```

No success claim is accepted from model text alone. Completion is derived from current evidence.

## 16. Rollout and rollback

Hermes features ship behind bounded capability/tenant gates where needed.

The existing Flywheel path remains available while new Hermes layers are introduced.

Rollback principles:

- additive schema first;
- backward-compatible proposal parsing;
- no destructive migration of old Phase 6 evidence;
- per-feature enable/disable where practical;
- candidate rollout retains rollback target;
- critical safety regressions favor safe rollback over continued experimentation.

## 17. Final architecture

```text
                         OWNER
                           │
                           ▼
                        MAESTRI
                company/workforce orchestration
                           │
                           ▼
                   LUMENVA CONTROL PLANE
          tenant | policy | approval | budget | truth
                           │
                           ▼
                    EXECUTION RUNTIME
             agents | workflows | tools | models
                           │
                  traces + evidence + outcomes
                           │
                           ▼
                  HERMES LEARNING OS
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
 Learning Flywheel   Scientific Memory   Outcome Ledger
        │                  │                  │
        ├──── Fingerprint / Retrieval ────────┤
        │                  │                  │
        └────────── Meta-Research ────────────┘
                           │
                           ▼
                 Improvement Candidates
                           │
                           ▼
          regression + golden + safety + shadow
                           │
                           ▼
                  LUMENVA APPROVAL/POLICY
                           │
                    ┌──────┴──────┐
                    ▼             ▼
                 promote        reject
                    │             │
                    ▼             ▼
               monitoring     evidence
                    │
              ┌─────┴─────┐
              ▼           ▼
            keep        rollback
              │
              └────────→ research memory
```

## 18. Guiding sentence

> **Hermes does not teach agents by rewriting them directly. Hermes turns operational evidence into testable improvement candidates, and Lumenva decides what is allowed to become real.**
