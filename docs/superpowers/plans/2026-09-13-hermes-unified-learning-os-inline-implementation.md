# Hermes Unified Learning OS — Inline Implementation Plan

> **For agentic execution:** REQUIRED SUB-SKILL: use `superpowers:executing-plans` only. **Subagents, agent teams and delegated implementation are forbidden for this plan.** The owner selected single-session inline execution by one implementer.

**Goal:** Consolidate Lumenva's existing Phase 6 Learning Flywheel with the best proven patterns from Helixforge V3, Adaptive Expert, EINVIRKI and Alfred into one tenant-safe, evidence-driven Hermes Learning OS without creating a second source of truth or allowing self-promotion.

**Architecture:** The existing `apps/crm/lib/agent-engine/flywheel/` remains the behavioral nucleus. New Hermes modules wrap and extend it through focused contracts for research memory, fingerprints/retrieval, outcomes, capability trust, meta-research and candidate manifests. Postgres/Supabase remains authoritative; Hermes learns and proposes, while Lumenva policy/approval/autonomy gates remain the only authority that can activate changes.

**Tech Stack:** Next.js 16, React 19, TypeScript 6 strict, Node >=22, Supabase/Postgres/RLS, Zod, Vitest, existing `event_log`/workers, existing Agent OS/Flywheel contracts.

**Spec:** `docs/superpowers/specs/2026-09-13-hermes-unified-learning-os-design.md`

## Global Constraints

- Work **only** on branch `design/hermes-unified-learning-os-2026-09-13`; never commit, merge, rebase, fast-forward or update `main`.
- Before every write batch, verify the current branch. If it is not exactly `design/hermes-unified-learning-os-2026-09-13`, stop before writing.
- Implementation is inline only: no subagents, no teams, no delegated coding/review.
- The owner authorizes implementation decisions, refactors required by this plan, dependency changes if strictly necessary, test execution and commits **inside this branch** without per-task confirmation.
- This authorization does **not** authorize production deploys, applying migrations to remote/production databases, modifying real credentials/secrets, destructive external operations, or merging to `main`; those are outside the branch-only boundary.
- `CLAUDE.md` remains repository doctrine. `.claude/rules/*`, specs, PRDs and business rules remain subordinate in the documented precedence order.
- Postgres/Supabase remains business/governance source of truth. JSONL/SQLite/local files must not become production learning authority.
- Every tenant-aware durable entity includes trusted `organization_id`, RLS and explicit service-role tenant filters.
- No model can promote itself, broaden its autonomy, bypass policy, broaden its capability set or activate a learning candidate directly.
- Existing Phase 6 proposal records remain readable. New code is additive/backward-compatible first; destructive migrations are forbidden.
- Existing proposal states are preserved. `NOT_EXECUTED`, `NOT_PROVEN` and `BLOCKED` never become PASS by inference.
- Schema changes ship as the canonical triplet: new migration + idempotent `supabase/baseline.sql` append + `supabase/migrations/MANIFEST.md` row; generated DB types are regenerated through the canonical project flow, never hand-edited.
- No raw secrets/tokens/cookies/customer transcripts in learning artifacts, logs, fixtures or docs. Prefer evidence references, hashes, sanitized summaries and synthetic fixtures.
- TDD for every behavior change: failing test → prove failure → minimal implementation → prove pass → relevant regression suite → commit.
- GitHub Actions is not a release gate. Primary evidence is local `typecheck`, `lint`, `lint:channels`, `lint:tenant-filter`, `test:unit`, `test:db`, `build`, plus targeted tests and final Preview only if the implementation changes a visible UI path and a Preview can be created without violating the branch-only boundary.
- Do not apply migration `0163` remotely while executing this plan. Test it only through the repository's disposable/local DB harness.

---

## File/Module Map Locked by This Plan

Existing files to extend rather than replace:

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

New canonical Hermes modules:

```text
apps/crm/lib/agent-engine/hermes/
├── index.ts                 # public facade, no business logic
├── contracts.ts             # shared Hermes-only types
├── service.ts               # bounded orchestration over existing Flywheel primitives
├── research-memory.ts       # experiment append/read/supersede contract
├── fingerprint.ts           # deterministic non-secret identity/context fingerprints
├── retrieval.ts             # same-tenant prior-evidence ranking with mustRetest
├── meta-research.ts         # aggregate strategy/provider/routing/failure performance
├── capability-trust.ts      # immutable capability identity + stale-trust invalidation
├── routing-metrics.ts       # Adaptive Expert routing/context/reviewer outcome metrics
├── outcome-ledger.ts        # generic technical/business outcome records
├── candidate-manifest.ts    # immutable/versioned improvement candidate manifest
├── runtime-events.ts        # stable input adapter for native runtime and future Mastra traces
└── sanitization.ts          # learning-artifact redaction/size/fingerprint guard
```

New/extended contract tests:

```text
apps/crm/lib/agent-engine/contracts/
├── hermes-facade.test.ts
├── hermes-sanitization.test.ts
├── hermes-research-memory.test.ts
├── hermes-fingerprint-retrieval.test.ts
├── hermes-capability-trust.test.ts
├── hermes-routing-metrics.test.ts
├── hermes-outcome-ledger.test.ts
├── hermes-candidate-manifest.test.ts
├── hermes-meta-research.test.ts
├── hermes-runtime-events.test.ts
├── hermes-end-to-end.test.ts
└── hermes-cross-tenant.test.ts
```

Schema addition:

```text
supabase/migrations/20260913130000_0163_hermes_learning_os.sql
supabase/baseline.sql
supabase/migrations/MANIFEST.md
apps/crm/lib/database.types.ts   # regenerate only through canonical generator
```

Command Center/API additions only after the core is proven:

```text
apps/crm/app/api/v1/ai/hermes/summary/route.ts
apps/crm/app/api/v1/ai/hermes/candidates/route.ts
apps/crm/app/api/v1/ai/hermes/experiments/route.ts
apps/crm/app/api/v1/ai/hermes/outcomes/route.ts
apps/crm/app/api/v1/ai/hermes/meta/route.ts
apps/crm/components/ai/HermesLearningPanel.tsx
```

---

### Task 0: Branch Guard and Baseline Evidence

**Files:**
- Read: `CLAUDE.md`
- Read: `.claude/rules/git-workflow.md`
- Read: `.claude/rules/testing-verification.md`
- Read: `.claude/rules/multi-tenancy.md`
- Read: `.claude/rules/database-migrations.md`
- Read: `docs/superpowers/specs/2026-09-13-hermes-unified-learning-os-design.md`
- No source write in this task.

**Interfaces:**
- Consumes: current repository state.
- Produces: baseline test evidence and branch lock for every later task.

- [ ] **Step 1: Verify branch and working tree**

```bash
git status --short --branch
git branch --show-current
git worktree list
```

Expected branch exactly:

```text
design/hermes-unified-learning-os-2026-09-13
```

If not exact, do not write.

- [ ] **Step 2: Record base relation to main without changing either ref**

```bash
git fetch origin main
git merge-base HEAD origin/main
git rev-list --left-right --count origin/main...HEAD
```

Expected at plan creation: branch contains the Hermes design/plan commits and no missing `main` commit. If `main` advanced, do **not** merge/rebase automatically during this task; first inspect whether the implementation branch can continue safely. The invariant is “never update main,” not “ignore upstream changes.”

- [ ] **Step 3: Run targeted existing Flywheel suite before modifications**

```bash
cd apps/crm
pnpm exec vitest run lib/agent-engine/contracts/flywheel-*.test.ts
```

Expected: current Flywheel tests PASS. Any pre-existing failure is recorded before implementation rather than silently attributed to Hermes.

- [ ] **Step 4: Run baseline static gates**

```bash
pnpm typecheck
pnpm lint
```

Record exact results in the execution log/commit notes. Do not “fix” unrelated baseline failures in the Hermes commits.

---

### Task 1: Introduce the Hermes Facade Without Changing Behavior

**Files:**
- Create: `apps/crm/lib/agent-engine/hermes/index.ts`
- Create: `apps/crm/lib/agent-engine/hermes/contracts.ts`
- Create: `apps/crm/lib/agent-engine/hermes/service.ts`
- Create: `apps/crm/lib/agent-engine/contracts/hermes-facade.test.ts`

**Interfaces:**
- Consumes: `LearningSignal`, `LearningScope`, `FlywheelLoopBudget`, `runLearningFlywheelIteration`, `LearningProposalStore`.
- Produces: `HermesLearningService`, `HermesLearningRunInput`, `HermesLearningRunResult`.

- [ ] **Step 1: Write the failing facade test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { createHermesLearningService } from '../hermes/service';

it('delegates one bounded learning iteration to the canonical flywheel', async () => {
  const runIteration = vi.fn().mockResolvedValue({
    processedSignals: 1,
    clusters: 1,
    createdProposals: 1,
    enrichedProposals: 0,
    modelTokensUsed: 0,
    costCentsUsed: 0,
    stoppedReason: 'completed',
  });
  const service = createHermesLearningService({ runIteration });
  const result = await service.runIteration({ rawSignals: [{}] } as never);
  expect(runIteration).toHaveBeenCalledOnce();
  expect(result.createdProposals).toBe(1);
});
```

- [ ] **Step 2: Prove RED**

```bash
pnpm exec vitest run lib/agent-engine/contracts/hermes-facade.test.ts
```

Expected: FAIL because `../hermes/service` does not exist.

- [ ] **Step 3: Implement a thin service only**

`service.ts` must inject the existing iteration function rather than duplicate its algorithm:

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

`index.ts` exports only the intended public facade/types; no wildcard export of internal stores.

- [ ] **Step 4: Prove GREEN + legacy compatibility**

```bash
pnpm exec vitest run lib/agent-engine/contracts/hermes-facade.test.ts lib/agent-engine/contracts/flywheel-*.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/crm/lib/agent-engine/hermes apps/crm/lib/agent-engine/contracts/hermes-facade.test.ts
git commit -m "feat(ai): add Hermes facade over learning flywheel"
```

---

### Task 2: Learning Artifact Sanitization and Provenance

**Files:**
- Create: `apps/crm/lib/agent-engine/hermes/sanitization.ts`
- Modify: `apps/crm/lib/agent-engine/flywheel/signals.ts`
- Create: `apps/crm/lib/agent-engine/contracts/hermes-sanitization.test.ts`
- Modify: `apps/crm/lib/agent-engine/contracts/flywheel-signals.test.ts`

**Interfaces:**
- Consumes: trusted `LearningScope` from current Flywheel.
- Produces: `HermesProvenance`, `sanitizeLearningSummary()`, extended signal kinds/source refs.

- [ ] **Step 1: Add RED tests for secret/PII-shaped summaries and provenance limits**

Tests must prove:

```ts
expect(sanitizeLearningSummary('Authorization: Bearer abc.def.ghi')).not.toContain('abc.def.ghi');
expect(sanitizeLearningSummary('alice@example.com +351 912 345 678')).not.toContain('alice@example.com');
expect(sanitizeLearningSummary('x'.repeat(2000)).length).toBeLessThanOrEqual(500);
```

Also prove that optional provenance identifiers are strings only and do not replace the trusted `scope.organizationId`.

- [ ] **Step 2: Prove RED**

```bash
pnpm exec vitest run lib/agent-engine/contracts/hermes-sanitization.test.ts lib/agent-engine/contracts/flywheel-signals.test.ts
```

- [ ] **Step 3: Implement bounded sanitizer**

Create an explicit sanitizer that redacts bearer/API-key-like assignments, obvious email/phone forms and truncates to 500 chars. It must return `null` for empty content. Do not build a generic DLP platform.

- [ ] **Step 4: Extend `LEARNING_SIGNAL_KINDS` additively**

Add:

```ts
'run_success'
'business_outcome'
'reviewer_finding'
'capability_changed'
'resource_regression'
```

Extend `LearningSignal` with optional provenance:

```ts
provenance?: {
  missionId?: string;
  runId?: string;
  workflowId?: string;
  sessionId?: string;
  traceId?: string;
  agentVersion?: string;
};
```

Fingerprint remains tenant/agent/capability/kind/failure-class scoped and must not ingest raw transcript text.

- [ ] **Step 5: Run tests**

```bash
pnpm exec vitest run lib/agent-engine/contracts/hermes-sanitization.test.ts lib/agent-engine/contracts/flywheel-signals.test.ts lib/agent-engine/contracts/flywheel-clustering.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add apps/crm/lib/agent-engine/hermes/sanitization.ts apps/crm/lib/agent-engine/flywheel/signals.ts apps/crm/lib/agent-engine/contracts/hermes-sanitization.test.ts apps/crm/lib/agent-engine/contracts/flywheel-signals.test.ts
git commit -m "feat(ai): add safe Hermes learning signals"
```

---

### Task 3: Add the Durable Hermes Schema (`0163`)

**Files:**
- Create: `supabase/migrations/20260913130000_0163_hermes_learning_os.sql`
- Modify: `supabase/baseline.sql`
- Modify: `supabase/migrations/MANIFEST.md`
- Regenerate: `apps/crm/lib/database.types.ts`
- Create: `apps/crm/tests/invariants/hermes-learning-rls.test.ts` if DB invariants live there; otherwise place beside the repository's current RLS invariant tests after inspecting the existing pattern.

**Interfaces:**
- Consumes: `organizations(id)`, existing Flywheel proposal store.
- Produces: durable experiment, outcome and capability-identity stores. Existing `flywheel_distiller_proposals` remains the proposal compatibility store.

- [ ] **Step 1: Write the DB isolation test first**

The test must exercise two organizations and prove org B cannot select org A rows from all new tenant tables. It also proves service-role repository code includes `.eq('organization_id', organizationId)` for tenant-aware operations.

- [ ] **Step 2: Prove RED via DB gate**

```bash
pnpm test:db
```

Expected targeted Hermes invariant failure because tables do not exist.

- [ ] **Step 3: Create migration `0163` with three bounded tables**

Use these canonical shapes:

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
  technical_quality double precision,
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

Create composite indexes starting with `organization_id` for lookup paths. Enable RLS on all three and use the repository's current canonical `fn_user_org_ids()` policy pattern after inspecting a recent tenant-aware migration. Do not invent a new auth helper.

- [ ] **Step 4: Add proposal-type compatibility extension in the same forward migration**

Replace the closed type constraint additively so it retains **all legacy + Phase 6 values** and adds:

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

Never remove `playbook_bullet`, `golden_case`, `reentry_trigger`, `org_memory_entry`, `skill_change`, `routing_change`, `eval_case`, or `operational_threshold`.

- [ ] **Step 5: Append equivalent idempotent DDL to `supabase/baseline.sql` and add manifest row**

Manifest row:

```text
| `20260913130000` | `0163_hermes_learning_os` | Additive Hermes research experiments, generic outcome ledger, capability identity/trust records, RLS and expanded governed learning proposal types. |
```

- [ ] **Step 6: Regenerate DB types with the repository's canonical generator**

First inspect `apps/crm/package.json`/scripts for the current generation command. Use that command; do not manually insert table types.

- [ ] **Step 7: Run DB gates**

```bash
pnpm test:db
pnpm lint:tenant-filter
```

- [ ] **Step 8: Commit schema triplet + generated types + DB test together**

```bash
git add supabase/migrations/20260913130000_0163_hermes_learning_os.sql supabase/baseline.sql supabase/migrations/MANIFEST.md apps/crm/lib/database.types.ts apps/crm/tests/invariants/hermes-learning-rls.test.ts
git commit -m "feat(db): add tenant-safe Hermes learning stores"
```

---

### Task 4: Scientific Research Memory Store

**Files:**
- Create: `apps/crm/lib/agent-engine/hermes/research-memory.ts`
- Extend: `apps/crm/lib/agent-engine/hermes/contracts.ts`
- Create: `apps/crm/lib/agent-engine/contracts/hermes-research-memory.test.ts`

**Interfaces:**
- Produces:

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

export interface HermesResearchMemory {
  append(experiment: HermesResearchExperiment): Promise<void>;
  listForOrganization(organizationId: string): Promise<HermesResearchExperiment[]>;
  listBySubject(input: { organizationId: string; subjectKind: string; subjectId: string }): Promise<HermesResearchExperiment[]>;
}
```

- [ ] **Step 1: RED tests** prove append-only history, exact tenant filter and supersede-with-reference rather than mutation/deletion.
- [ ] **Step 2: Run** `pnpm exec vitest run lib/agent-engine/contracts/hermes-research-memory.test.ts` and observe failure.
- [ ] **Step 3: Implement Supabase-backed store** using injected client; every query includes trusted `organization_id` filter even for admin clients.
- [ ] **Step 4: Add duplicate protection at application level using experiment `id`; database remains authoritative.**
- [ ] **Step 5: GREEN + targeted DB test.**
- [ ] **Step 6: Commit** `feat(ai): add Hermes scientific research memory`.

---

### Task 5: Deterministic Fingerprints and Controlled Retrieval

**Files:**
- Create: `apps/crm/lib/agent-engine/hermes/fingerprint.ts`
- Create: `apps/crm/lib/agent-engine/hermes/retrieval.ts`
- Create: `apps/crm/lib/agent-engine/contracts/hermes-fingerprint-retrieval.test.ts`

**Interfaces:**
- Produces:

```ts
export interface HermesContextFingerprintInput {
  domainTags: string[];
  languageHints: string[];
  runtimeHints: string[];
  packageManager: string | null;
  dependencies: string[];
  agentDefinitionId: string | null;
  agentVersion: string | null;
  capabilities: string[];
  workflowFamily: string | null;
  modelPolicyClass: string | null;
}

export interface PriorHermesEvidence {
  experiment: HermesResearchExperiment;
  score: number;
  mustRetest: true;
  warning: boolean;
}
```

- [ ] **Step 1: RED tests** for deterministic ordering-insensitive SHA-256 fingerprints; no secret values; same tenant only; fresh successful evidence ranks above stale/failed evidence when other dimensions are equal; every retrieval result has `mustRetest: true`.
- [ ] **Step 2: Prove RED.**
- [ ] **Step 3: Implement normalized fingerprint** by lowercase/sort/dedupe of non-secret identity fields and SHA-256 of canonical JSON.
- [ ] **Step 4: Implement bounded retrieval score** with weights fixed in code and tests:

```text
0.40 context similarity
0.25 goal overlap
0.15 metric compatibility
0.10 outcome quality
0.10 freshness
```

Use deterministic token/Jaccard-style overlap for V1; do not add embeddings/vector DB.
- [ ] **Step 5: Reject cross-tenant records before scoring.**
- [ ] **Step 6: GREEN.**
- [ ] **Step 7: Commit** `feat(ai): add Hermes controlled knowledge retrieval`.

---

### Task 6: Capability Identity and Trust Invalidation

**Files:**
- Create: `apps/crm/lib/agent-engine/hermes/capability-trust.ts`
- Create: `apps/crm/lib/agent-engine/contracts/hermes-capability-trust.test.ts`

**Interfaces:**
- Produces:

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

- [ ] **Step 1: RED tests** prove changed content, scripts/permissions/network declaration fingerprint or immutable revision invalidates prior trust.
- [ ] **Step 2: Prove RED.**
- [ ] **Step 3: Implement deterministic identity comparison**; if immutable revision is missing, cached trust is advisory and cannot bypass inspection.
- [ ] **Step 4: Persist inspected identities through `hermes_capability_identities` with explicit org filter.**
- [ ] **Step 5: GREEN + cross-tenant test.**
- [ ] **Step 6: Commit** `feat(ai): add identity-bound Hermes capability trust`.

---

### Task 7: Adaptive Expert Routing Metrics

**Files:**
- Create: `apps/crm/lib/agent-engine/hermes/routing-metrics.ts`
- Create: `apps/crm/lib/agent-engine/contracts/hermes-routing-metrics.test.ts`

**Interfaces:**
- Produces the closed classifications:

```ts
export type HermesDomain = 'software' | 'security' | 'database' | 'infrastructure' | 'AI' | 'research' | 'product' | 'data' | 'business' | 'general';
export type HermesComplexity = 'QUICK' | 'STANDARD' | 'DEEP' | 'CRITICAL';
export type HermesRisk = 'LOW' | 'MEDIUM' | 'HIGH';
export type HermesExecutionShape = 'MAIN' | 'SKILL' | 'SUBAGENT' | 'TEAM' | 'WORKFLOW';
```

Metrics record:

```ts
routeCorrect: boolean
workerCount: number
unnecessaryWorkerCount: number
missingSpecialist: boolean
contextWordsLoaded: number
estimatedTokenOverhead: number | null
reviewerFindingCount: number
falsePassCount: number
```

- [ ] **Step 1: RED tests** for QUICK trivial work remaining MAIN, TEAM requiring two independent workstreams/collaboration, HIGH risk not implying TEAM, and `falsePassCount` never being hidden by an aggregate quality score.
- [ ] **Step 2: Implement pure metric/classification helpers only.** Do not create a new workflow engine or permanent fleet.
- [ ] **Step 3: GREEN.**
- [ ] **Step 4: Commit** `feat(ai): add Hermes routing efficiency metrics`.

---

### Task 8: Generic Outcome Ledger

**Files:**
- Create: `apps/crm/lib/agent-engine/hermes/outcome-ledger.ts`
- Modify: `apps/crm/lib/agent-engine/flywheel/outcome-collector.ts`
- Create: `apps/crm/lib/agent-engine/contracts/hermes-outcome-ledger.test.ts`

**Interfaces:**
- Existing `flywheel_followup_outcomes` remains compatible for current follow-up dashboards.
- New generic output:

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

- [ ] **Step 1: RED tests** prove non-negative cost/latency, technical quality bounded 0..1 when present, org filtering, no KPI-only auto-promotion signal, and conversion outcome can be mirrored from the old follow-up collector without deleting old records.
- [ ] **Step 2: Implement ledger repository against `hermes_outcomes`.**
- [ ] **Step 3: Add a compatibility adapter in `outcome-collector.ts`** that can optionally write a generic Hermes outcome after the legacy `flywheel_followup_outcomes` write succeeds. Failure of the new optional mirror must be visible but must not corrupt the legacy record.
- [ ] **Step 4: GREEN.**
- [ ] **Step 5: Commit** `feat(ai): add generic Hermes outcome ledger`.

---

### Task 9: Expand Governed Candidate Types and Immutable Candidate Manifest

**Files:**
- Modify: `apps/crm/lib/agent-engine/flywheel/contracts.ts`
- Modify: `apps/crm/lib/agent-engine/flywheel/candidates.ts`
- Create: `apps/crm/lib/agent-engine/hermes/candidate-manifest.ts`
- Modify: `apps/crm/lib/agent-engine/contracts/flywheel-contracts.test.ts`
- Modify: `apps/crm/lib/agent-engine/contracts/flywheel-candidates.test.ts`
- Create: `apps/crm/lib/agent-engine/contracts/hermes-candidate-manifest.test.ts`

**Interfaces:**
- Preserve old proposal kinds and add the nine kinds from migration `0163`.
- Produce immutable candidate metadata:

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

- [ ] **Step 1: RED tests** prove old records still parse; forbidden authority fields remain rejected; candidate manifest requires rollback target and promotion policy; changing the bounded patch/reference yields a new fingerprint.
- [ ] **Step 2: Extend `LEARNING_PROPOSAL_TYPES` additively.**
- [ ] **Step 3: Keep specialized builders for skill/routing/threshold and add one generic `buildHermesCandidateManifest()` rather than nine copy-pasted builders.**
- [ ] **Step 4: GREEN legacy + new tests.**
- [ ] **Step 5: Commit** `feat(ai): expand governed Hermes improvement candidates`.

---

### Task 10: Explicit Evaluation Evidence States

**Files:**
- Modify: `apps/crm/lib/agent-engine/flywheel/contracts.ts`
- Modify: `apps/crm/lib/agent-engine/flywheel/validator.ts`
- Modify: `apps/crm/lib/agent-engine/contracts/flywheel-validator.test.ts`
- Create: `apps/crm/lib/agent-engine/contracts/hermes-evidence-states.test.ts`

**Interfaces:**
- Produces:

```ts
export type HermesEvidenceState = 'PASS' | 'FAIL' | 'NOT_EXECUTED' | 'NOT_PROVEN' | 'BLOCKED';

export interface HermesEvalEvidence {
  suite: 'regression' | 'golden' | 'safety' | 'shadow' | 'business' | 'cost_latency';
  state: HermesEvidenceState;
  evidenceRef: string | null;
  reason: string | null;
}
```

- [ ] **Step 1: RED tests** prove no evidence ref cannot be PASS; NOT_EXECUTED and BLOCKED remain distinct; previous-project PASS supplied through retrieved research is `NOT_PROVEN` for the current candidate until re-executed.
- [ ] **Step 2: Introduce the explicit evidence state model without breaking the existing `CandidateValidationReport` callers.** Use an adapter/derived boolean during migration instead of changing every caller at once.
- [ ] **Step 3: Extend validation ordering:** regression → golden → safety → shadow; business and cost/latency run only when requested by the candidate manifest and can veto promotion but cannot bypass safety.
- [ ] **Step 4: GREEN.**
- [ ] **Step 5: Commit** `feat(ai): make Hermes eval evidence states explicit`.

---

### Task 11: Meta-Research Aggregation

**Files:**
- Create: `apps/crm/lib/agent-engine/hermes/meta-research.ts`
- Create: `apps/crm/lib/agent-engine/contracts/hermes-meta-research.test.ts`

**Interfaces:**
- Consumes: `HermesResearchExperiment[]`, `HermesOutcomeRecord[]`, routing metric records.
- Produces recommendation-only report:

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

export interface HermesMetaResearchReport {
  byStrategy: Record<string, HermesPerformanceStats>;
  byProvider: Record<string, HermesPerformanceStats>;
  byExecutionShape: Record<string, HermesPerformanceStats>;
  repeatedFailures: Array<{ signature: string; count: number }>;
  recommendations: string[];
}
```

- [ ] **Step 1: RED tests** with deterministic fixtures comparing two strategies/providers and repeated failures.
- [ ] **Step 2: Implement pure aggregation**; no direct config mutation, no model call required for V1.
- [ ] **Step 3: Prove recommendations contain evidence-derived comparisons, not activation instructions.**
- [ ] **Step 4: GREEN.**
- [ ] **Step 5: Commit** `feat(ai): add Hermes meta research`.

---

### Task 12: Runtime Event Adapter for Native Runtime and Future Mastra

**Files:**
- Create: `apps/crm/lib/agent-engine/hermes/runtime-events.ts`
- Create: `apps/crm/lib/agent-engine/contracts/hermes-runtime-events.test.ts`
- Modify only the smallest current Agent OS completion/error hook after locating the canonical run-completion boundary; do not scatter Hermes calls across providers.

**Interfaces:**
- Produces provider-neutral event:

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

- [ ] **Step 1: Search and document the single canonical native run completion/error boundary before editing.**
- [ ] **Step 2: RED tests** prove native and future Mastra-shaped events normalize to the same contract and that no provider payload becomes authoritative tenant identity.
- [ ] **Step 3: Implement pure adapter + one integration call at the canonical boundary.** The adapter may emit a learning signal/outcome input; it does not run the whole learning loop synchronously inside a customer request.
- [ ] **Step 4: GREEN + existing Agent OS runtime tests.**
- [ ] **Step 5: Commit** `feat(ai): feed runtime evidence into Hermes`.

---

### Task 13: Unified Hermes Learning Cycle

**Files:**
- Modify: `apps/crm/lib/agent-engine/hermes/service.ts`
- Modify: `apps/crm/lib/agent-engine/hermes/index.ts`
- Create: `apps/crm/lib/agent-engine/contracts/hermes-end-to-end.test.ts`

**Interfaces:**
- `HermesLearningService.runCycle()` performs bounded orchestration only:

```text
sanitize/normalize signals
→ cluster via existing Flywheel
→ retrieve prior research evidence
→ mark transferred evidence mustRetest
→ synthesize/enrich candidate
→ validate requested suites
→ enqueue existing approval/promotion path
→ persist experiment/outcome evidence
→ update meta-research read model
```

- [ ] **Step 1: RED end-to-end test** using in-memory/fake ports: a tool failure creates a cluster, retrieves similar prior evidence, refuses direct reuse, creates a candidate, records NOT_PROVEN until fresh eval, then after fresh PASS becomes ready for existing human/system approval path.
- [ ] **Step 2: Implement `runCycle` through injected ports.** Do not directly import admin Supabase client in orchestration logic; inject stores/ports.
- [ ] **Step 3: Add budget accounting by extending the existing `FlywheelLoopBudget`, not a second budget model.** Extend with optional `maxRetrievals` and `maxEvalCases`; defaults preserve current behavior.
- [ ] **Step 4: Add no-progress termination when retrieval/candidate synthesis repeatedly yields no admissible candidate.**
- [ ] **Step 5: GREEN including all `flywheel-*` and `hermes-*` tests.**
- [ ] **Step 6: Commit** `feat(ai): unify Hermes learning cycle`.

---

### Task 14: Preserve Promotion Authority and Rollback Semantics

**Files:**
- Modify only if required: `apps/crm/lib/agent-engine/flywheel/promotion-queue.ts`
- Modify only if required: `apps/crm/lib/agent-engine/flywheel/rollout.ts`
- Modify only if required: `apps/crm/lib/agent-engine/flywheel/monitoring.ts`
- Modify: `apps/crm/lib/agent-engine/autonomy/promotion.ts` only if an integration assertion is required; never weaken its model denial.
- Create: `apps/crm/lib/agent-engine/contracts/hermes-promotion-safety.test.ts`

**Interfaces:**
- Existing authority remains: models cannot promote; approved candidate begins at SHADOW/DRAFT path; critical safety regression triggers safe rollback.

- [ ] **Step 1: RED adversarial tests** attempt self-promotion, skipped eval, stale evidence, direct ACTIVE jump, cross-candidate rollback target and safety regression continuation.
- [ ] **Step 2: Apply only minimal hardening found necessary.** If current code already passes a case, keep the test and avoid gratuitous refactor.
- [ ] **Step 3: Run**

```bash
pnpm exec vitest run lib/agent-engine/contracts/flywheel-adversarial.test.ts lib/agent-engine/contracts/flywheel-promotion-queue.test.ts lib/agent-engine/contracts/flywheel-rollout.test.ts lib/agent-engine/contracts/flywheel-monitoring*.test.ts lib/agent-engine/contracts/hermes-promotion-safety.test.ts
```

- [ ] **Step 4: Commit** only if code/tests changed: `test(ai): harden Hermes promotion and rollback boundaries`.

---

### Task 15: Cross-Tenant Integration Proof

**Files:**
- Create/extend: `apps/crm/lib/agent-engine/contracts/hermes-cross-tenant.test.ts`
- Use DB invariant test from Task 3.

**Interfaces:**
- Proves isolation for research, outcomes, capability trust, candidate retrieval and meta-read paths.

- [ ] **Step 1: Construct org A and org B fixtures with deliberately colliding subject IDs/fingerprints.**
- [ ] **Step 2: Prove org B cannot retrieve org A prior evidence even when similarity score would otherwise be maximal.**
- [ ] **Step 3: Prove admin/service-role repository methods issue explicit organization filters.**
- [ ] **Step 4: Run targeted unit + `pnpm test:db`.**
- [ ] **Step 5: Commit** `test(ai): prove Hermes tenant isolation`.

---

### Task 16: Read-Only Hermes API Surface

**Files:**
- Create: `apps/crm/app/api/v1/ai/hermes/summary/route.ts`
- Create: `apps/crm/app/api/v1/ai/hermes/candidates/route.ts`
- Create: `apps/crm/app/api/v1/ai/hermes/experiments/route.ts`
- Create: `apps/crm/app/api/v1/ai/hermes/outcomes/route.ts`
- Create: `apps/crm/app/api/v1/ai/hermes/meta/route.ts`
- Create targeted route tests following the existing `/api/v1/ai/evolution` test pattern.

**Interfaces:**
- Read-only V1 API. No “activate candidate” endpoint is introduced here; existing approval/promotion surfaces remain canonical.

- [ ] **Step 1: Inspect `/api/v1/ai/evolution/route.ts`, auth wrappers and canonical `ok()/fail()` API helpers before writing.**
- [ ] **Step 2: RED route tests** prove server-derived tenant, RBAC, no body-supplied tenancy, pagination/limits where lists can grow, and snake_case JSON.
- [ ] **Step 3: Implement read-only routes through Hermes repositories/services.** No direct unbounded admin-client query in route handlers.
- [ ] **Step 4: Run targeted route tests + `pnpm lint:tenant-filter`.**
- [ ] **Step 5: Commit** `feat(api): expose read-only Hermes learning data`.

---

### Task 17: Night/Periodic Learning Trigger Using Existing Worker/Event Patterns

**Files:**
- Inspect current Flywheel cron/worker path first, especially `apps/crm/app/api/v1/cron/flywheel-judge-loop/route.ts` and its service/worker dependencies.
- Modify the existing scheduled learning boundary rather than adding a competing scheduler when possible.
- Add a targeted Hermes scheduling/budget test in `apps/crm/lib/agent-engine/contracts/`.

**Interfaces:**
- The periodic trigger invokes `HermesLearningService.runCycle()` asynchronously/boundedly; schedule remains deployment policy, not a hard-coded “22:30” rule.

- [ ] **Step 1: RED test** proves max signals/clusters/candidates/tokens/cost/runtime/no-progress plus new retrieval/eval limits are enforced.
- [ ] **Step 2: Wire Hermes into the existing Flywheel scheduled path behind an explicit feature/capability gate if the current path has one.** Preserve the current max-duration ceiling and do not raise Vercel `maxDuration` above the repository's documented plan limit.
- [ ] **Step 3: Prove idempotent replay does not duplicate open candidates for the same fingerprint/scope.**
- [ ] **Step 4: Run targeted cron/service tests.**
- [ ] **Step 5: Commit** `feat(ai): run Hermes through the governed learning schedule`.

---

### Task 18: Command Center Hermes Learning Panel

**Files:**
- Create: `apps/crm/components/ai/HermesLearningPanel.tsx`
- Integrate into the existing AI evolution/command surface after inspecting current component ownership; do not invent a parallel navigation tree if an existing evolution page already owns this information.
- Add component test and, only if existing E2E structure supports it, one focused Playwright path.

**Interfaces:**
- Reads the five read-only Hermes API endpoints.
- Shows metrics only; activation continues through existing review/approval controls.

- [ ] **Step 1: RED component test** for loading/error/empty/populated states.
- [ ] **Step 2: Implement compact sections:** signals/candidates summary, experiments, outcomes/KPI, repeated failure patterns, rollback/policy warning counts.
- [ ] **Step 3: Ensure no raw evidence payload/transcript is rendered by default; show references/IDs/sanitized summaries.**
- [ ] **Step 4: Run component tests + typecheck.**
- [ ] **Step 5: If visible route changed, run one real browser journey and record screenshot/trace according to current repo convention.**
- [ ] **Step 6: Commit** `feat(ui): add Hermes learning observability panel`.

---

### Task 19: Compatibility, Documentation and Legacy Naming

**Files:**
- Modify: `docs/architecture/agent-os/README.md`
- Modify: `docs/index.md` if needed to index the Hermes design.
- Create: `docs/architecture/agent-os/hermes-learning-os.md`
- Modify current-state/handoff docs only if their precedence rules require a new snapshot; do not duplicate doctrine.
- Do **not** rename `flywheel/` wholesale in this implementation.

**Interfaces:**
- Documents `Flywheel = canonical low-level learning mechanism inside Hermes`, not two systems.

- [ ] **Step 1: Document ownership sentence exactly:**

```text
Maestri orchestrates; Lumenva governs; the execution runtime executes; Hermes learns and proposes.
```

- [ ] **Step 2: Document source-of-truth and promotion rule:** Postgres/Lumenva authoritative; Hermes cannot activate its own candidate.
- [ ] **Step 3: Mark external Helixforge/Adaptive Expert/EINVIRKI/Alfred implementations as source patterns/reference lineage, not runtime dependencies required by Lumenva.
- [ ] **Step 4: Run `pnpm harness:check` because agent/harness architecture documentation changed.**
- [ ] **Step 5: Commit** `docs(ai): document Hermes Learning OS architecture`.

---

### Task 20: Full Verification and Adversarial Completion Gate

**Files:**
- No new production file unless a failing gate exposes a Hermes-scoped bug.
- Update plan checkboxes/execution evidence only if the repository workflow preserves plan execution state.

**Interfaces:**
- Produces final branch evidence; does not merge/deploy/apply remote migrations.

- [ ] **Step 1: Verify branch again**

```bash
test "$(git branch --show-current)" = "design/hermes-unified-learning-os-2026-09-13"
git status --short --branch
```

- [ ] **Step 2: Run all Hermes/Flywheel unit tests**

```bash
cd apps/crm
pnpm exec vitest run lib/agent-engine/contracts/flywheel-*.test.ts lib/agent-engine/contracts/hermes-*.test.ts
```

- [ ] **Step 3: Run canonical static/unit gates**

```bash
pnpm typecheck
pnpm lint
pnpm lint:channels
pnpm lint:tenant-filter
pnpm test:unit
```

- [ ] **Step 4: Run schema/RLS gate**

```bash
pnpm test:db
```

This must exercise fresh baseline install plus relevant update/idempotence invariants; migration is not applied to any remote database.

- [ ] **Step 5: Build**

```bash
pnpm build
```

- [ ] **Step 6: Harness/governance verification**

```bash
pnpm harness:check
pnpm gov:verify
```

`gov:verify` is supplementary and never substitutes for `test:db`.

- [ ] **Step 7: Adversarial invariants review**

Manually verify against current diff that:

```text
model cannot promote itself
retrieved evidence always requires retest
no cross-tenant retrieval
no raw secret/PII artifact path
no unrestricted service_role path
no candidate can bypass policy/approval
legacy Phase 6 records still parse
critical safety regression still rolls back
NOT_PROVEN/BLOCKED are not PASS
KPI gain cannot bypass safety
```

- [ ] **Step 8: Inspect exact branch diff against main**

```bash
git diff --stat origin/main...HEAD
git diff origin/main...HEAD -- apps/crm/lib/agent-engine supabase docs/architecture docs/superpowers
```

No merge/rebase/update to `main`.

- [ ] **Step 9: Final branch-only commit if evidence/docs changed**

```bash
git status --short
git add <explicit-hermes-paths-only>
git commit -m "test(ai): verify Hermes unified learning OS"
```

- [ ] **Step 10: Completion report**

Report:

```text
branch
HEAD SHA
commits created
files changed
tests executed and exact results
DB/RLS proof
build result
what was not executed (production deploy, remote migration, main merge)
remaining risks
```

Do not call the work production-ready unless the evidence from this task supports that exact claim.

---

## Execution Order and Checkpoints

Execute strictly inline in this order:

```text
0 baseline
→ 1 facade
→ 2 safe signals
→ 3 schema
→ 4 research memory
→ 5 fingerprints/retrieval
→ 6 capability trust
→ 7 routing metrics
→ 8 outcome ledger
→ 9 candidate manifests
→ 10 evidence states
→ 11 meta-research
→ 12 runtime observations
→ 13 unified cycle
→ 14 promotion hardening
→ 15 tenant proof
→ 16 read APIs
→ 17 scheduled loop
→ 18 Command Center
→ 19 docs
→ 20 full verification
```

The implementer may make a small corrective commit between tasks when a prior change breaks a later gate, but must not skip backwards verification or expand scope into unrelated cleanup.

## Commit Policy

One coherent commit per task where possible. Every commit remains on `design/hermes-unified-learning-os-2026-09-13`. Use explicit `git add <paths>`; never `git add -A` when unrelated work exists. Never force-push. Never merge `main` into this branch automatically once execution starts; if upstream drift becomes material, record it and resolve deliberately without modifying `main`.

## Definition of Done

Hermes Unified Learning OS is complete on this branch only when current evidence proves:

1. Existing Flywheel behavior is backward-compatible.
2. Runtime outcomes can become sanitized tenant-scoped learning signals.
3. Research experiments persist with controlled same-tenant retrieval.
4. Transferred knowledge is always `mustRetest` and cannot directly promote.
5. Capability identity changes invalidate stale trust.
6. Routing/context/reviewer efficiency can be measured without spawning permanent specialist fleets.
7. Technical and business outcomes can be linked without KPI gains bypassing safety.
8. Expanded candidate types are immutable/versioned and retain rollback target/evidence requirements.
9. Eval evidence distinguishes PASS/FAIL/NOT_EXECUTED/NOT_PROVEN/BLOCKED.
10. Critical safety regressions still trigger safe rollback.
11. A model cannot self-promote or broaden authority.
12. Two-tenant DB/unit tests prove no research/outcome/trust retrieval leakage.
13. Meta-research compares strategies/routes/providers but only recommends.
14. Read-only API/UI surfaces expose learning state without leaking raw evidence/secrets.
15. Periodic learning obeys explicit budgets and no-progress limits.
16. `typecheck`, lint gates, relevant unit tests, `test:db`, build and harness verification pass or any genuine external blocker is reported precisely.
17. No production deploy, remote migration application or `main` mutation occurred.

## Selected Execution Mode

**INLINE EXECUTION is already selected by the owner.** Do not ask again between tasks. Use `superpowers:executing-plans` and continue task-by-task on the authorized branch, stopping only for a genuine blocker that cannot be resolved within the branch, an irreversible/external action outside the authorization boundary, or a contradiction with canonical repository doctrine.