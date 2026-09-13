# Hermes Unified Learning OS — Inline Implementation Plan

> **For agentic execution:** REQUIRED SUB-SKILL: use `superpowers:executing-plans` only. **Subagents, agent teams and delegated implementation are forbidden.** The owner selected single-implementer inline execution.

**Goal:** Consolidate Lumenva's existing Phase 6 Learning Flywheel with the useful learning patterns already built in Helixforge V3, Adaptive Expert, EINVIRKI and Alfred into one tenant-safe, evidence-driven Hermes Learning OS.

**Architecture:** `apps/crm/lib/agent-engine/flywheel/` remains the canonical low-level learning mechanism. New `hermes/` modules add scientific memory, controlled retrieval, capability trust, routing metrics, generic outcomes, meta-research and a stable runtime-observation boundary. Lumenva/Postgres remains authoritative; Hermes learns, evaluates and proposes but never activates itself.

**Tech Stack:** Next.js 16, React 19, TypeScript strict, Node >=22, Supabase/Postgres/RLS, Zod, Vitest, existing `event_log`/workers and Agent OS/Flywheel contracts.

**Spec:** `docs/superpowers/specs/2026-09-13-hermes-unified-learning-os-design.md`

## Global Constraints

- Work only on `design/hermes-unified-learning-os-2026-09-13`.
- Never commit, merge, rebase, fast-forward, force-push or update `main`.
- Before each write batch, verify `git branch --show-current` equals the authorized branch.
- Inline implementation only: no subagents, teams, delegated coding or delegated review.
- The owner authorizes branch-local implementation decisions, required refactors, tests, docs and commits without per-task confirmation.
- Branch-local authorization does not include production deploys, remote/production migration application, real-secret mutation, destructive external operations or merging to `main`.
- `CLAUDE.md` remains sovereign repository doctrine.
- Postgres/Supabase remains the business/governance source of truth. No JSONL/SQLite parallel production authority.
- Every new tenant-aware durable entity has trusted `organization_id`, RLS and explicit tenant filtering for service-role access.
- Models/Hermes cannot self-promote, broaden autonomy/capabilities, bypass policy or activate candidates.
- Existing Phase 6 records and states remain readable and backward compatible.
- `NOT_EXECUTED`, `NOT_PROVEN` and `BLOCKED` never become PASS by inference.
- Schema changes ship as migration + idempotent baseline append + manifest row; generated DB types are never hand-edited.
- No raw secret/token/cookie/customer transcript in learning artifacts, fixtures, logs or docs.
- TDD for every behavior change: RED → minimal GREEN → regression → commit.
- GitHub Actions is not a release gate. Use repository-local verification.
- Migration `0163` is tested locally/disposably only; never applied remotely in this plan.
- All shell commands below assume repository root unless the command itself uses `pnpm --dir apps/crm`.

---

## Locked File Map

Extend, do not replace:

```text
apps/crm/lib/agent-engine/flywheel/
├── candidates.ts
├── clustering.ts
├── contracts.ts
├── eval-candidates.ts
├── live-phase6.ts
├── live.ts
├── monitoring.ts
├── orchestrator.ts
├── outcome-collector.ts
├── promotion-queue.ts
├── proposals.ts
├── rollout.ts
├── signals.ts
├── store.ts
└── validator.ts
```

Create:

```text
apps/crm/lib/agent-engine/hermes/
├── index.ts
├── contracts.ts
├── service.ts
├── sanitization.ts
├── research-memory.ts
├── fingerprint.ts
├── retrieval.ts
├── capability-trust.ts
├── routing-metrics.ts
├── outcome-ledger.ts
├── candidate-manifest.ts
├── meta-research.ts
└── runtime-events.ts
```

Schema:

```text
supabase/migrations/20260913130000_0163_hermes_learning_os.sql
supabase/baseline.sql
supabase/migrations/MANIFEST.md
apps/crm/lib/database.types.ts
apps/crm/tests/invariants/rls-isolation.test.ts
apps/crm/tests/unit/hermes-learning-migration-contract.test.ts
```

Core contract tests:

```text
apps/crm/lib/agent-engine/contracts/hermes-facade.test.ts
apps/crm/lib/agent-engine/contracts/hermes-sanitization.test.ts
apps/crm/lib/agent-engine/contracts/hermes-research-memory.test.ts
apps/crm/lib/agent-engine/contracts/hermes-fingerprint-retrieval.test.ts
apps/crm/lib/agent-engine/contracts/hermes-capability-trust.test.ts
apps/crm/lib/agent-engine/contracts/hermes-routing-metrics.test.ts
apps/crm/lib/agent-engine/contracts/hermes-outcome-ledger.test.ts
apps/crm/lib/agent-engine/contracts/hermes-candidate-manifest.test.ts
apps/crm/lib/agent-engine/contracts/hermes-evidence-states.test.ts
apps/crm/lib/agent-engine/contracts/hermes-meta-research.test.ts
apps/crm/lib/agent-engine/contracts/hermes-runtime-events.test.ts
apps/crm/lib/agent-engine/contracts/hermes-promotion-safety.test.ts
apps/crm/lib/agent-engine/contracts/hermes-end-to-end.test.ts
apps/crm/lib/agent-engine/contracts/hermes-cross-tenant.test.ts
```

---

### Task 0: Branch Lock and Baseline

**Files:** read only.

**Consumes:** current branch, existing Flywheel behavior.  
**Produces:** baseline evidence.

- [ ] Verify branch/worktrees:

```bash
test "$(git branch --show-current)" = "design/hermes-unified-learning-os-2026-09-13"
git status --short --branch
git worktree list
```

- [ ] Read current doctrine before editing:

```text
CLAUDE.md
.claude/rules/git-workflow.md
.claude/rules/testing-verification.md
.claude/rules/multi-tenancy.md
.claude/rules/database-migrations.md
docs/superpowers/specs/2026-09-13-hermes-unified-learning-os-design.md
```

- [ ] Record relation to `origin/main` without changing `main`:

```bash
git fetch origin main
git merge-base HEAD origin/main
git rev-list --left-right --count origin/main...HEAD
```

- [ ] Run existing Flywheel tests:

```bash
pnpm --dir apps/crm exec vitest run lib/agent-engine/contracts/flywheel-*.test.ts
```

- [ ] Run baseline static gates:

```bash
pnpm --dir apps/crm typecheck
pnpm --dir apps/crm lint
```

Any pre-existing failure is recorded, not silently repaired as Hermes scope.

---

### Task 1: Hermes Facade Over the Existing Flywheel

**Files:**
- Create `apps/crm/lib/agent-engine/hermes/index.ts`
- Create `apps/crm/lib/agent-engine/hermes/contracts.ts`
- Create `apps/crm/lib/agent-engine/hermes/service.ts`
- Create `apps/crm/lib/agent-engine/contracts/hermes-facade.test.ts`

**Produces:** `HermesLearningService` delegating to the existing Flywheel.

- [ ] RED test:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createHermesLearningService } from '../hermes/service';

describe('Hermes facade', () => {
  it('delegates to the canonical flywheel iteration', async () => {
    const runIteration = vi.fn().mockResolvedValue({ createdProposals: 1 });
    const service = createHermesLearningService({ runIteration: runIteration as never });
    const result = await service.runIteration({ rawSignals: [] } as never);
    expect(runIteration).toHaveBeenCalledOnce();
    expect(result.createdProposals).toBe(1);
  });
});
```

- [ ] Prove RED:

```bash
pnpm --dir apps/crm exec vitest run lib/agent-engine/contracts/hermes-facade.test.ts
```

- [ ] Minimal implementation in `service.ts`:

```ts
import type { Phase6IterationResult, RunLearningFlywheelInput } from '../flywheel/orchestrator';
import { runLearningFlywheelIteration } from '../flywheel/orchestrator';

export interface HermesLearningService {
  runIteration(input: RunLearningFlywheelInput): Promise<Phase6IterationResult>;
}

export function createHermesLearningService(deps: {
  runIteration?: typeof runLearningFlywheelIteration;
} = {}): HermesLearningService {
  const runIteration = deps.runIteration ?? runLearningFlywheelIteration;
  return { runIteration };
}
```

`index.ts` exports only the public facade/contracts; no wildcard export of stores.

- [ ] GREEN + legacy regression:

```bash
pnpm --dir apps/crm exec vitest run lib/agent-engine/contracts/hermes-facade.test.ts lib/agent-engine/contracts/flywheel-*.test.ts
```

- [ ] Commit:

```bash
git add apps/crm/lib/agent-engine/hermes/index.ts apps/crm/lib/agent-engine/hermes/contracts.ts apps/crm/lib/agent-engine/hermes/service.ts apps/crm/lib/agent-engine/contracts/hermes-facade.test.ts
git commit -m "feat(ai): add Hermes facade over learning flywheel"
```

---

### Task 2: Sanitized Learning Signals and Provenance

**Files:**
- Create `apps/crm/lib/agent-engine/hermes/sanitization.ts`
- Modify `apps/crm/lib/agent-engine/flywheel/signals.ts`
- Create `apps/crm/lib/agent-engine/contracts/hermes-sanitization.test.ts`
- Modify `apps/crm/lib/agent-engine/contracts/flywheel-signals.test.ts`

**Produces:** safe summaries, extra signal kinds, optional trace provenance.

- [ ] RED tests must prove:

```ts
expect(sanitizeLearningSummary('Authorization: Bearer abc.def.ghi')).not.toContain('abc.def.ghi');
expect(sanitizeLearningSummary('alice@example.com +351 912 345 678')).not.toContain('alice@example.com');
expect(sanitizeLearningSummary('x'.repeat(2000))?.length).toBeLessThanOrEqual(500);
```

- [ ] Add these signal kinds only:

```ts
'run_success'
'business_outcome'
'reviewer_finding'
'capability_changed'
'resource_regression'
```

- [ ] Add optional provenance:

```ts
export interface HermesProvenance {
  missionId?: string;
  runId?: string;
  workflowId?: string;
  sessionId?: string;
  traceId?: string;
  agentVersion?: string;
}
```

Tenant identity remains exclusively `LearningScope.organizationId`; provenance can never override it.

- [ ] Run:

```bash
pnpm --dir apps/crm exec vitest run lib/agent-engine/contracts/hermes-sanitization.test.ts lib/agent-engine/contracts/flywheel-signals.test.ts lib/agent-engine/contracts/flywheel-clustering.test.ts
```

- [ ] Commit exact four files.

---

### Task 3: Migration 0163 — Durable Hermes Stores

**Files:**
- Create `supabase/migrations/20260913130000_0163_hermes_learning_os.sql`
- Modify `supabase/baseline.sql`
- Modify `supabase/migrations/MANIFEST.md`
- Regenerate `apps/crm/lib/database.types.ts`
- Modify `apps/crm/tests/invariants/rls-isolation.test.ts`
- Create `apps/crm/tests/unit/hermes-learning-migration-contract.test.ts`

**Produces:** tenant-aware research experiments, generic outcomes and capability identities; expanded proposal allowlist.

- [ ] RED migration-contract test reads `0163` and asserts the three tables, RLS enablement, `organization_id`, required checks, and all old/new proposal types.

- [ ] Extend the existing `TABLES` list in `apps/crm/tests/invariants/rls-isolation.test.ts` with:

```ts
'hermes_research_experiments',
'hermes_outcomes',
'hermes_capability_identities',
```

- [ ] Create `0163` with these table contracts:

```sql
create table if not exists public.hermes_research_experiments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subject_kind text not null,
  subject_id text not null,
  context_fingerprint text not null,
  goal text not null,
  strategy text not null,
  metric_name text,
  baseline_value double precision,
  observed_value double precision,
  score double precision,
  status text not null check (status in ('keep','discard','crash','inconclusive')),
  evidence_refs jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  source_version text,
  supersedes_id uuid references public.hermes_research_experiments(id),
  created_at timestamptz not null default now()
);

create table if not exists public.hermes_outcomes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  run_id text not null,
  mission_id text,
  candidate_id uuid,
  subject_kind text not null,
  subject_id text not null,
  technical_quality double precision check (technical_quality is null or (technical_quality >= 0 and technical_quality <= 1)),
  cost_cents integer check (cost_cents is null or cost_cents >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  kpi_name text,
  kpi_baseline double precision,
  kpi_observed double precision,
  evidence_refs jsonb not null default '[]'::jsonb,
  observed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.hermes_capability_identities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  capability_kind text not null,
  canonical_identity text not null,
  immutable_revision text,
  content_fingerprint text not null,
  permission_fingerprint text not null,
  trust_status text not null check (trust_status in ('unknown','inspected','trusted','rejected','stale')),
  evidence_refs jsonb not null default '[]'::jsonb,
  inspected_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, capability_kind, canonical_identity, content_fingerprint, permission_fingerprint)
);
```

- [ ] Add composite indexes beginning with `organization_id` for subject/run/identity lookup paths.

- [ ] Enable RLS and use the repository's existing `fn_user_org_ids()` pattern; do not create a new tenancy helper.

- [ ] Replace the `flywheel_distiller_proposals_type_check` allowlist while retaining every historical value:

```text
playbook_bullet
golden_case
reentry_trigger
org_memory_entry
skill_change
routing_change
eval_case
operational_threshold
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

- [ ] Append the same idempotent schema to `supabase/baseline.sql`.

- [ ] Add manifest row:

```text
| `20260913130000` | `0163_hermes_learning_os` | Additive Hermes research experiments, generic outcomes, capability identity/trust records, tenant RLS and expanded governed learning proposal types. |
```

- [ ] Validate locally:

```bash
pnpm --dir apps/crm test:db
```

- [ ] Generate types from a local Supabase database containing the new baseline/schema, never from production:

```bash
pnpm --dir apps/crm db:reset
cd apps/crm && supabase gen types typescript --local > lib/database.types.ts
```

If the local Supabase CLI/runtime itself is unavailable, record `database.types.ts` generation as a precise blocker; do not hand-edit generated types and do not apply the migration remotely merely to generate them.

- [ ] Re-run:

```bash
pnpm --dir apps/crm test:db
pnpm --dir apps/crm lint:tenant-filter
```

- [ ] Commit schema triplet, generated types and the two DB tests together.

---

### Task 4: Scientific Research Memory

**Files:**
- Create `apps/crm/lib/agent-engine/hermes/research-memory.ts`
- Extend `apps/crm/lib/agent-engine/hermes/contracts.ts`
- Create `apps/crm/lib/agent-engine/contracts/hermes-research-memory.test.ts`

**Produces:**

```ts
export type HermesExperimentStatus = 'keep' | 'discard' | 'crash' | 'inconclusive';

export interface HermesResearchExperiment {
  id: string;
  organizationId: string;
  subjectKind: string;
  subjectId: string;
  contextFingerprint: string;
  goal: string;
  strategy: string;
  metricName: string | null;
  baselineValue: number | null;
  observedValue: number | null;
  score: number | null;
  status: HermesExperimentStatus;
  evidenceRefs: string[];
  sourceVersion: string | null;
  supersedesId: string | null;
  createdAt: string;
}
```

- [ ] RED tests: append-only behavior, supersede-by-reference, exact `organization_id` filter, duplicate ID rejection.
- [ ] Implement injected Supabase repository methods `append`, `listForOrganization`, `listBySubject`.
- [ ] Every admin-client query explicitly filters trusted organization ID.
- [ ] GREEN + `test:db` targeted proof.
- [ ] Commit `feat(ai): add Hermes scientific research memory`.

---

### Task 5: Fingerprints and Controlled Knowledge Transfer

**Files:**
- Create `apps/crm/lib/agent-engine/hermes/fingerprint.ts`
- Create `apps/crm/lib/agent-engine/hermes/retrieval.ts`
- Create `apps/crm/lib/agent-engine/contracts/hermes-fingerprint-retrieval.test.ts`

**Produces:** deterministic non-secret fingerprint and `PriorHermesEvidence` with `mustRetest: true`.

```ts
export interface PriorHermesEvidence {
  experiment: HermesResearchExperiment;
  score: number;
  mustRetest: true;
  warning: boolean;
}
```

- [ ] RED tests prove ordering-insensitive SHA-256, same-tenant-only retrieval, freshness ranking and unconditional `mustRetest: true`.
- [ ] Normalize arrays by trim/lowercase/dedupe/sort; hash canonical JSON only.
- [ ] V1 retrieval weights:

```text
0.40 context similarity
0.25 goal overlap
0.15 metric compatibility
0.10 outcome quality
0.10 freshness
```

- [ ] Use deterministic token/Jaccard overlap; no embeddings/vector DB.
- [ ] Filter tenant before scoring.
- [ ] GREEN and commit.

---

### Task 6: Identity-Bound Capability Trust

**Files:**
- Create `apps/crm/lib/agent-engine/hermes/capability-trust.ts`
- Create `apps/crm/lib/agent-engine/contracts/hermes-capability-trust.test.ts`

**Produces:**

```ts
export interface CapabilityIdentity {
  capabilityKind: 'skill' | 'tool' | 'provider' | 'runtime' | 'workflow';
  canonicalIdentity: string;
  immutableRevision: string | null;
  contentFingerprint: string;
  permissionFingerprint: string;
}

export type CapabilityTrustDecision =
  | { kind: 'reuse'; evidenceRefs: string[] }
  | { kind: 'reinspect'; reason: 'identity_changed' | 'permissions_changed' | 'revision_unknown' | 'not_trusted' };
```

- [ ] RED tests: content/revision/permissions change invalidates reuse; unknown immutable revision cannot bypass inspection; cross-tenant identity cannot be reused.
- [ ] Implement deterministic comparison and persistence in `hermes_capability_identities`.
- [ ] GREEN + tenant test.
- [ ] Commit.

---

### Task 7: Adaptive Expert Routing/Context Metrics

**Files:**
- Create `apps/crm/lib/agent-engine/hermes/routing-metrics.ts`
- Create `apps/crm/lib/agent-engine/contracts/hermes-routing-metrics.test.ts`

**Produces:** closed classification types:

```ts
export type HermesDomain = 'software' | 'security' | 'database' | 'infrastructure' | 'AI' | 'research' | 'product' | 'data' | 'business' | 'general';
export type HermesComplexity = 'QUICK' | 'STANDARD' | 'DEEP' | 'CRITICAL';
export type HermesRisk = 'LOW' | 'MEDIUM' | 'HIGH';
export type HermesExecutionShape = 'MAIN' | 'SKILL' | 'SUBAGENT' | 'TEAM' | 'WORKFLOW';
```

Metrics include route correctness, worker count, unnecessary workers, missing specialist, context words, token overhead when known, reviewer findings and false PASS count.

- [ ] RED tests: trivial QUICK remains MAIN; TEAM requires at least two independent workstreams/collaboration; HIGH risk does not automatically mean TEAM; false PASS cannot be hidden by aggregate score.
- [ ] Implement pure deterministic metric helpers only; no new orchestration engine.
- [ ] GREEN and commit.

---

### Task 8: Generic Outcome Ledger

**Files:**
- Create `apps/crm/lib/agent-engine/hermes/outcome-ledger.ts`
- Modify `apps/crm/lib/agent-engine/flywheel/outcome-collector.ts`
- Create `apps/crm/lib/agent-engine/contracts/hermes-outcome-ledger.test.ts`

**Produces:**

```ts
export interface HermesOutcomeRecord {
  id: string;
  organizationId: string;
  runId: string;
  missionId: string | null;
  candidateId: string | null;
  subjectKind: string;
  subjectId: string;
  technicalQuality: number | null;
  costCents: number | null;
  latencyMs: number | null;
  kpiName: string | null;
  kpiBaseline: number | null;
  kpiObserved: number | null;
  evidenceRefs: string[];
  observedAt: string;
}
```

- [ ] RED tests: quality 0..1, non-negative cost/latency, explicit tenant filter, KPI gain cannot itself produce promotion approval.
- [ ] Implement Supabase-backed generic ledger.
- [ ] Keep `flywheel_followup_outcomes` unchanged for compatibility; add an optional adapter that mirrors successful legacy outcomes into `hermes_outcomes` after the legacy write succeeds.
- [ ] New mirror failure must be visible but cannot corrupt the already-written legacy record.
- [ ] GREEN and commit.

---

### Task 9: Expanded Candidate Registry

**Files:**
- Modify `apps/crm/lib/agent-engine/flywheel/contracts.ts`
- Modify `apps/crm/lib/agent-engine/flywheel/candidates.ts`
- Create `apps/crm/lib/agent-engine/hermes/candidate-manifest.ts`
- Modify `apps/crm/lib/agent-engine/contracts/flywheel-contracts.test.ts`
- Modify `apps/crm/lib/agent-engine/contracts/flywheel-candidates.test.ts`
- Create `apps/crm/lib/agent-engine/contracts/hermes-candidate-manifest.test.ts`

**Produces:** old proposal kinds plus nine new kinds and one immutable generic manifest.

```ts
export interface HermesCandidateManifest {
  candidateId: string;
  organizationId: string;
  proposalType: LearningProposalType;
  subjectRef: string;
  baseRef: string;
  candidateRef: string;
  hypothesis: string;
  expectedBenefits: string[];
  knownRegressions: string[];
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
  estimatedCostCents: number | null;
  evidenceRefs: string[];
  rollbackTargetRef: string;
  requiredEvalSuites: Array<'regression' | 'golden' | 'safety' | 'shadow' | 'business' | 'cost_latency'>;
  promotionPolicyRef: string;
  fingerprint: string;
}
```

- [ ] RED tests: legacy parse remains valid, authority/security fields are forbidden, rollback/promotion policy required, manifest fingerprint changes when candidate/base bounded refs change.
- [ ] Extend `LEARNING_PROPOSAL_TYPES` with the nine `0163` values.
- [ ] Keep existing specialized builders; add one generic `buildHermesCandidateManifest()` instead of nine duplicated builders.
- [ ] GREEN legacy + Hermes tests and commit.

---

### Task 10: Explicit Evidence States and Candidate Validation

**Files:**
- Modify `apps/crm/lib/agent-engine/flywheel/contracts.ts`
- Modify `apps/crm/lib/agent-engine/flywheel/validator.ts`
- Modify `apps/crm/lib/agent-engine/contracts/flywheel-validator.test.ts`
- Create `apps/crm/lib/agent-engine/contracts/hermes-evidence-states.test.ts`

**Produces:**

```ts
export type HermesEvidenceState = 'PASS' | 'FAIL' | 'NOT_EXECUTED' | 'NOT_PROVEN' | 'BLOCKED';

export interface HermesEvalEvidence {
  suite: 'regression' | 'golden' | 'safety' | 'shadow' | 'business' | 'cost_latency';
  state: HermesEvidenceState;
  evidenceRef: string | null;
  reason: string | null;
}
```

- [ ] RED tests: PASS requires current evidence ref; transferred old PASS is NOT_PROVEN for the new candidate; BLOCKED/NOT_EXECUTED remain distinct; business/KPI evidence cannot bypass safety.
- [ ] Add evidence states through a backward-compatible adapter around current `CandidateValidationReport` rather than breaking all Phase 6 callers at once.
- [ ] Validation order: regression → golden → safety → shadow; business/cost-latency suites run only when required by the candidate manifest.
- [ ] GREEN and commit.

---

### Task 11: Meta-Research

**Files:**
- Create `apps/crm/lib/agent-engine/hermes/meta-research.ts`
- Create `apps/crm/lib/agent-engine/contracts/hermes-meta-research.test.ts`

**Produces recommendation-only aggregates:**

```ts
export interface HermesPerformanceStats {
  samples: number;
  keepRate: number;
  crashRate: number;
  meanScore: number;
  meanImprovement: number;
  meanCostDeltaCents: number;
  meanLatencyDeltaMs: number;
}
```

Report groups by strategy/provider/execution shape and lists repeated failure signatures.

- [ ] RED fixtures compare at least two strategies/providers and repeated failures.
- [ ] Implement pure deterministic aggregation; no model call and no config mutation.
- [ ] Recommendations may say “route X outperformed route Y by measured metrics”; they may never apply route X.
- [ ] GREEN and commit.

---

### Task 12: Provider-Neutral Runtime Observation Boundary

**Files:**
- Create `apps/crm/lib/agent-engine/hermes/runtime-events.ts`
- Create `apps/crm/lib/agent-engine/contracts/hermes-runtime-events.test.ts`
- Modify exactly one canonical native run-completion/error boundary after locating it in current code.

**Produces:**

```ts
export interface HermesRuntimeObservation {
  organizationId: string;
  agentId: string;
  capabilityId: string;
  runtime: 'native' | 'mastra' | 'external';
  runId: string;
  missionId: string | null;
  workflowId: string | null;
  sessionId: string | null;
  traceId: string | null;
  agentVersion: string | null;
  status: 'succeeded' | 'failed' | 'blocked' | 'cancelled';
  costCents: number | null;
  latencyMs: number | null;
  evidenceRefs: string[];
  sanitizedFailureClass: string | null;
}
```

- [ ] Search current Agent OS for the single completion/error boundary and record the chosen file in the execution log before editing it.
- [ ] RED tests normalize native and Mastra-shaped fixtures to the same contract and reject payload-derived tenant authority.
- [ ] Implement pure adapter and one integration call at the canonical boundary.
- [ ] Never run the whole Hermes learning cycle synchronously inside a customer request; emit/store bounded observation input instead.
- [ ] GREEN plus affected existing runtime tests; commit.

---

### Task 13: Unified Hermes Cycle

**Files:**
- Modify `apps/crm/lib/agent-engine/hermes/service.ts`
- Modify `apps/crm/lib/agent-engine/hermes/index.ts`
- Create `apps/crm/lib/agent-engine/contracts/hermes-end-to-end.test.ts`

**Produces:** `HermesLearningService.runCycle()`.

Canonical flow:

```text
normalize/sanitize signals
→ existing clustering
→ same-tenant research retrieval
→ transferred evidence marked mustRetest
→ bounded candidate synthesis/enrichment
→ requested eval suites
→ existing approval/promotion queue
→ experiment/outcome persistence
→ meta-research read model
```

- [ ] RED end-to-end fake-port test: tool failure → cluster → retrieve prior evidence → no direct reuse → candidate → NOT_PROVEN → fresh eval PASS → ready for existing approval path.
- [ ] Implement orchestration entirely through injected stores/ports; no admin client inside orchestration logic.
- [ ] Extend `FlywheelLoopBudget` additively with `maxRetrievals` and `maxEvalCases`; current callers get safe defaults.
- [ ] Preserve token/cost/runtime/no-progress enforcement from existing orchestrator.
- [ ] GREEN:

```bash
pnpm --dir apps/crm exec vitest run lib/agent-engine/contracts/flywheel-*.test.ts lib/agent-engine/contracts/hermes-*.test.ts
```

- [ ] Commit.

---

### Task 14: Promotion/Autonomy Adversarial Gate

**Files:**
- Create `apps/crm/lib/agent-engine/contracts/hermes-promotion-safety.test.ts`
- Modify `apps/crm/lib/agent-engine/flywheel/promotion-queue.ts`, `rollout.ts`, `monitoring.ts` or `apps/crm/lib/agent-engine/autonomy/promotion.ts` only if a new adversarial test reveals a genuine gap.

- [ ] RED/adversarial cases attempt: model self-promotion, skipped eval, stale evidence, direct ACTIVE jump, foreign rollback target, safety-regressed continuation and KPI-only promotion.
- [ ] Preserve `model_cannot_promote`; never weaken it.
- [ ] Critical safety regression must still choose immediate safe rollback.
- [ ] If existing code already passes a case, keep the test and make no gratuitous production change.
- [ ] Run:

```bash
pnpm --dir apps/crm exec vitest run lib/agent-engine/contracts/flywheel-adversarial.test.ts lib/agent-engine/contracts/flywheel-promotion-queue.test.ts lib/agent-engine/contracts/flywheel-rollout.test.ts lib/agent-engine/contracts/flywheel-monitoring.test.ts lib/agent-engine/contracts/flywheel-monitoring-lifecycle.test.ts lib/agent-engine/contracts/hermes-promotion-safety.test.ts
```

- [ ] Commit tests/hardening.

---

### Task 15: Cross-Tenant Proof

**Files:**
- Create `apps/crm/lib/agent-engine/contracts/hermes-cross-tenant.test.ts`
- Use/extend `apps/crm/tests/invariants/rls-isolation.test.ts` from Task 3.

- [ ] Build org A/org B fixtures with intentionally identical subject IDs and context fingerprints.
- [ ] Prove org B cannot retrieve org A research/outcomes/capability trust even when similarity is maximal.
- [ ] Prove admin/service-role repositories include explicit `organization_id` filtering.
- [ ] Run unit tenant tests and `pnpm --dir apps/crm test:db`.
- [ ] Commit.

---

### Task 16: Read-Only Hermes API

**Files:**
- Create `apps/crm/app/api/v1/ai/hermes/summary/route.ts`
- Create `apps/crm/app/api/v1/ai/hermes/candidates/route.ts`
- Create `apps/crm/app/api/v1/ai/hermes/experiments/route.ts`
- Create `apps/crm/app/api/v1/ai/hermes/outcomes/route.ts`
- Create `apps/crm/app/api/v1/ai/hermes/meta/route.ts`
- Create `apps/crm/tests/unit/hermes-api.test.ts`

- [ ] Inspect `/api/v1/ai/evolution/route.ts`, auth wrappers and `ok()/fail()` helpers first.
- [ ] RED tests prove server-derived tenant, RBAC, snake_case API JSON, bounded list limits and no body/query tenancy authority.
- [ ] Implement read-only routes through Hermes repositories/services. Do not add an activation endpoint.
- [ ] Run:

```bash
pnpm --dir apps/crm exec vitest run tests/unit/hermes-api.test.ts
pnpm --dir apps/crm lint:tenant-filter
```

- [ ] Commit.

---

### Task 17: Scheduled Learning Through the Existing Flywheel Boundary

**Files:**
- Inspect and then modify the existing Flywheel scheduled path centered on `apps/crm/app/api/v1/cron/flywheel-judge-loop/route.ts` rather than adding a second scheduler.
- Create `apps/crm/lib/agent-engine/contracts/hermes-scheduled-cycle.test.ts`.

- [ ] RED tests prove all budgets: signals, clusters, candidates, tokens, cost, runtime, no-progress, retrievals and eval cases.
- [ ] Wire `HermesLearningService.runCycle()` into the existing scheduled learning path behind the current feature/capability boundary.
- [ ] Preserve the documented `maxDuration <= 300` constraint; do not raise it.
- [ ] Replay of the same scope/fingerprint must enrich/reuse an open candidate rather than create uncontrolled duplicates.
- [ ] Run targeted cron/Flywheel/Hermes tests; commit.

---

### Task 18: Command Center Learning Observability

**Files:**
- Create `apps/crm/components/ai/HermesLearningPanel.tsx`
- Create `apps/crm/tests/unit/hermes-learning-panel.test.tsx`
- Integrate the panel into the existing AI evolution/Command surface only after inspecting that surface; use its existing navigation/ownership rather than creating a parallel app section.

- [ ] RED component tests for loading, error, empty and populated states.
- [ ] Render summary metrics, candidate queue, experiments, generic outcomes/KPI, repeated failures and rollback/safety counts.
- [ ] Never render raw transcript/evidence payload by default; render refs and sanitized summaries.
- [ ] Run component tests + `pnpm --dir apps/crm typecheck`.
- [ ] If a visible route changed, run one focused Playwright/browser journey according to the current repository convention; Preview is optional and only at the final UI task, never per subtask.
- [ ] Commit.

---

### Task 19: Architecture Documentation

**Files:**
- Create `docs/architecture/agent-os/hermes-learning-os.md`
- Modify `docs/architecture/agent-os/README.md`
- Modify `docs/index.md` only to add the canonical Hermes architecture entry if it is not already indexed.

- [ ] Document exactly:

```text
Maestri orchestrates; Lumenva governs; the execution runtime executes; Hermes learns and proposes.
```

- [ ] Document Postgres authority, `mustRetest`, candidate gates, explicit evidence states and rollback.
- [ ] Record Helixforge/Adaptive Expert/EINVIRKI/Alfred as design lineage/reference patterns, not production runtime dependencies.
- [ ] Do not rename the existing `flywheel/` directory in this implementation.
- [ ] Run:

```bash
pnpm --dir apps/crm harness:check
```

- [ ] Commit documentation.

---

### Task 20: Full Verification — Branch Only

**Files:** no new production file unless a failing gate identifies a Hermes-scoped defect.

- [ ] Verify branch:

```bash
test "$(git branch --show-current)" = "design/hermes-unified-learning-os-2026-09-13"
git status --short --branch
```

- [ ] Flywheel + Hermes tests:

```bash
pnpm --dir apps/crm exec vitest run lib/agent-engine/contracts/flywheel-*.test.ts lib/agent-engine/contracts/hermes-*.test.ts tests/unit/hermes-*.test.ts tests/unit/hermes-*.test.tsx
```

- [ ] Canonical gates:

```bash
pnpm --dir apps/crm typecheck
pnpm --dir apps/crm lint
pnpm --dir apps/crm lint:channels
pnpm --dir apps/crm lint:tenant-filter
pnpm --dir apps/crm test:unit
pnpm --dir apps/crm test:db
pnpm --dir apps/crm build
pnpm --dir apps/crm harness:check
pnpm --dir apps/crm gov:verify
```

- [ ] Adversarial manual diff review must confirm:

```text
model cannot self-promote
retrieved evidence always requires retest
no cross-tenant retrieval
no raw secret/PII learning artifact path
no unrestricted service_role path
no candidate bypasses policy/approval
legacy Phase 6 records still parse
critical safety regression still rolls back
NOT_PROVEN/BLOCKED are not PASS
KPI gain cannot bypass safety
```

- [ ] Inspect branch diff only:

```bash
git diff --stat origin/main...HEAD
git diff origin/main...HEAD -- apps/crm/lib/agent-engine apps/crm/app/api/v1/ai/hermes apps/crm/components/ai supabase docs/architecture docs/superpowers
```

- [ ] If verification required a Hermes-scoped correction, commit only the exact corrected files plus their tests with message:

```text
test(ai): verify Hermes unified learning OS
```

- [ ] Final report must include branch, HEAD SHA, commits, changed files, exact tests/results, DB/RLS proof, build result, genuine blockers and explicit confirmation that production deploy, remote migration and `main` mutation were not performed.

---

## Execution Order

```text
0 baseline
→ 1 facade
→ 2 sanitized signals
→ 3 schema/RLS
→ 4 scientific memory
→ 5 controlled retrieval
→ 6 capability trust
→ 7 routing metrics
→ 8 outcome ledger
→ 9 candidate registry
→ 10 evidence states
→ 11 meta-research
→ 12 runtime observations
→ 13 unified cycle
→ 14 promotion safety
→ 15 tenant proof
→ 16 read APIs
→ 17 governed schedule
→ 18 Command Center
→ 19 docs
→ 20 full verification
```

## Commit Policy

Use one coherent commit per task whenever code changed. Use only the exact file paths listed in that task's **Files** section when staging. If a task discovers that one additional file is strictly required, document why in the execution log before staging it. Never use `git add -A`, never force-push, and never merge/rebase `main` as an automatic cleanup step.

## Definition of Done

Hermes is complete on this branch only when current evidence proves all of the following:

1. Existing Flywheel behavior remains backward compatible.
2. Runtime outcomes become sanitized tenant-scoped learning signals.
3. Scientific research persists and retrieves only within the same tenant.
4. Transferred evidence is always `mustRetest` and cannot directly promote.
5. Capability identity/permission/revision changes invalidate stale trust.
6. Routing/context/reviewer efficiency is measurable without permanent specialist fleets.
7. Technical + business outcomes are linked while KPI gains remain subordinate to safety/policy.
8. Expanded candidates are immutable/versioned and retain rollback/eval/promotion requirements.
9. Eval evidence distinguishes PASS/FAIL/NOT_EXECUTED/NOT_PROVEN/BLOCKED.
10. Critical safety regressions still trigger safe rollback.
11. Models/Hermes cannot self-promote or broaden authority.
12. Unit + real disposable DB tests prove no cross-tenant learning leakage.
13. Meta-research compares strategies/routes/providers and only recommends.
14. Read-only API/UI expose learning state without leaking raw evidence/secrets.
15. Periodic learning obeys explicit budgets and no-progress limits.
16. Typecheck, lint gates, unit tests, DB/RLS tests, build and harness verification pass, or any genuine environmental blocker is reported precisely rather than converted into PASS.
17. No production deployment, remote migration application or mutation of `main` occurred.

## Selected Execution Mode

**INLINE EXECUTION is already selected and authorized.** Do not ask again between tasks. When implementation begins, use `superpowers:executing-plans` and proceed task-by-task on `design/hermes-unified-learning-os-2026-09-13`, stopping only for a genuine blocker that cannot be resolved within the branch, an irreversible/external action outside the authorization boundary, or a contradiction with canonical repository doctrine.