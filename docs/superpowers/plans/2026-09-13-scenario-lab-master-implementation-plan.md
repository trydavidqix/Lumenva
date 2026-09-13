# Scenario Lab + Council + OASIS — Implementation Plan

**Date:** 2026-09-13  
**Branch:** `feature/scenario-lab-council-oasis-2026-09-13`  
**Design:** `docs/superpowers/specs/2026-09-13-scenario-lab-council-oasis-design.md`

## Goal

Implement the approved Scenario Lab as a governed subsystem of the existing Lumenva Agent Engine. Do not create a second agent runtime, do not copy MiroFish AGPL code, do not make synthetic output authoritative, and do not merge to `main`.

## Execution rules

- Work only on this branch.
- Additive migrations only under root `supabase/migrations/`.
- Every business table is tenant-scoped by `organization_id` with RLS and org-first indexes.
- Trusted server context owns tenant identity.
- New external simulation starts OFF/SHADOW.
- Lifecycle facts are emitted through the existing `event_log` path.
- Tests are authored before implementation for each core behavior. Because this branch is being edited through the GitHub connector, executable RED/GREEN proof remains PENDING until a runnable checkout/CI is available.
- Production migrations, production deploys, production secrets and merging/rebasing into `main` are out of scope.

## Task 1 — Scenario contracts and invariants

**Create:**
- `apps/crm/lib/agent-engine/contracts/scenario.ts`
- `apps/crm/lib/agent-engine/scenario/state-machine.test.ts`
- `apps/crm/lib/agent-engine/scenario/state-machine.ts`
- `apps/crm/lib/agent-engine/scenario/synthetic-boundary.test.ts`
- `apps/crm/lib/agent-engine/scenario/synthetic-boundary.ts`

Define scenario lifecycle, strategies, evidence, assumptions, actor templates, populations, runs, artifacts, metrics, confidence components, reports, Council inputs/results and simulation-engine contracts. Add deterministic transition validation and a guard that rejects attempts to promote synthetic artifacts into authoritative CRM facts.

**Verify in runnable checkout:**
`pnpm --dir apps/crm exec vitest run lib/agent-engine/scenario/state-machine.test.ts lib/agent-engine/scenario/synthetic-boundary.test.ts`

## Task 2 — Additive tenant-scoped schema

**Create:**
- `supabase/migrations/20260913170000_0130_scenario_lab_core.sql`
- `supabase/migrations/20260913170100_0131_scenario_lab_simulation.sql`
- `supabase/migrations/20260913170200_0132_scenario_lab_evaluation.sql`
- `supabase/migrations/20260913170300_0133_scenario_lab_calibration.sql`
- `apps/crm/tests/unit/scenario-lab-migrations-contract.test.ts`

Create the approved tables, FKs, lifecycle checks, JSONB only for flexible artifacts, org-first indexes and RLS policies based on organization membership. Ensure synthetic rows carry provenance and cannot be mistaken for CRM contacts/companies.

**Verify in runnable checkout:**
`pnpm --dir apps/crm exec vitest run tests/unit/scenario-lab-migrations-contract.test.ts`
`pnpm --dir apps/crm db:reset`
`pnpm --dir apps/crm test:db`

## Task 3 — Persistence and lifecycle audit

**Create:**
- `apps/crm/lib/agent-engine/scenario/repository.test.ts`
- `apps/crm/lib/agent-engine/scenario/repository.ts`

Implement parameterized, organization-scoped persistence using the existing Postgres pool. Every scenario transition must be optimistic/concurrency-safe and emit an `event_log` fact with scenario/run correlation metadata.

**Verify:** targeted Vitest plus tenant-filter lint.

## Task 4 — Evidence Pack and Scenario Compiler

**Create:**
- `apps/crm/lib/agent-engine/scenario/evidence-pack.test.ts`
- `apps/crm/lib/agent-engine/scenario/evidence-pack.ts`
- `apps/crm/lib/agent-engine/scenario/compiler.test.ts`
- `apps/crm/lib/agent-engine/scenario/compiler.ts`

Evidence items carry authority, timestamp, provenance and source references. The compiler separates observed facts, derived facts, user assumptions, Council hypotheses and simulation parameters. It produces a validated business-oriented `CompiledScenario`.

## Task 5 — Council port and governed adapter

**Create:**
- `apps/crm/lib/agent-engine/scenario/council.test.ts`
- `apps/crm/lib/agent-engine/scenario/council.ts`

Implement `CouncilPort` with independent proposal, challenge and review rounds. Preserve member provenance/disagreement. Apply hard member/round/runtime/token/cost budgets outside model output. Provide a deterministic in-process council implementation for tests and a provider adapter seam for the existing model runtime/CLI council integration. Member failure degrades the round without granting new permissions.

## Task 6 — Population builder

**Create:**
- `apps/crm/lib/agent-engine/scenario/population.test.ts`
- `apps/crm/lib/agent-engine/scenario/population.ts`

Build deterministic synthetic populations from aggregate templates and seed. Default MVP bounds: 24–50 actors, 8–12 rounds, 3–5 strategies, five seeds. No real contact identity is copied into synthetic actors.

## Task 7 — Simulation kernel, mock engine and OASIS boundary

**Create:**
- `apps/crm/lib/agent-engine/scenario/simulation-kernel.test.ts`
- `apps/crm/lib/agent-engine/scenario/simulation-kernel.ts`
- `apps/crm/lib/agent-engine/scenario/mock-simulation-engine.ts`
- `apps/crm/lib/agent-engine/scenario/oasis-simulation-engine.test.ts`
- `apps/crm/lib/agent-engine/scenario/oasis-simulation-engine.ts`
- `workers/scenario-oasis/README.md`
- `workers/scenario-oasis/app.py`
- `workers/scenario-oasis/requirements.txt`

`SimulationKernel` owns budgets, cancellation, timeout and artifact validation. `MockSimulationEngine` is deterministic. `OasisSimulationEngine` calls a thin external worker through a typed HTTP boundary. Worker receives sanitized synthetic payload only, has no DB/service-role credentials and exposes health/prepare/run/status/cancel/artifacts endpoints. External engine is disabled by default.

## Task 8 — Multi-run evaluator, confidence and backtesting

**Create:**
- `apps/crm/lib/agent-engine/scenario/evaluator.test.ts`
- `apps/crm/lib/agent-engine/scenario/evaluator.ts`
- `apps/crm/lib/agent-engine/scenario/confidence.test.ts`
- `apps/crm/lib/agent-engine/scenario/confidence.ts`
- `apps/crm/lib/agent-engine/scenario/backtesting.test.ts`
- `apps/crm/lib/agent-engine/scenario/backtesting.ts`

Compute distributions across seeds, direction/ranking stability, variance, percentile bands, segment effects, sensitivity and failure rates. Confidence is component-based and inspectable, never a free-form model percentage. Backtesting enforces a cutoff timestamp and prevents post-outcome evidence leakage.

## Task 9 — Orchestrator and Decision Brief

**Create:**
- `apps/crm/lib/agent-engine/scenario/orchestrator.test.ts`
- `apps/crm/lib/agent-engine/scenario/orchestrator.ts`
- `apps/crm/lib/agent-engine/scenario/decision-brief.ts`

Compose Council → compile → population → runs → evaluate → Council review → Decision Brief. Bound iterative refinement by max Council rounds, max runs, wall-clock, cost/tokens, failures and no-progress. Recommendation remains advisory.

## Task 10 — Hermes bridge

**Create:**
- `apps/crm/lib/agent-engine/scenario/hermes-bridge.test.ts`
- `apps/crm/lib/agent-engine/scenario/hermes-bridge.ts`

Only create a learning candidate carrying scenario/report/run provenance. Never promote directly to ACTIVE knowledge, skill, memory or policy.

## Task 11 — API surface

**Create:**
- `apps/crm/app/api/v1/scenarios/route.ts`
- `apps/crm/app/api/v1/scenarios/[scenarioId]/route.ts`
- `apps/crm/app/api/v1/scenarios/[scenarioId]/run/route.ts`
- `apps/crm/app/api/v1/scenarios/[scenarioId]/report/route.ts`
- focused route tests under `apps/crm/tests/unit/`

Use `requireAuth`, `resolveActiveOrg`, role checks, `ok()`/`fail()`, Zod validation, server-derived organization identity and thin handlers.

## Task 12 — Scenario Lab UI

**Create:**
- `apps/crm/app/app/command/scenarios/page.tsx`
- `apps/crm/app/app/command/scenarios/[scenarioId]/page.tsx`
- `apps/crm/app/app/command/scenarios/scenario-lab-client.tsx`

Follow the existing authenticated `/app` shell. Product URL becomes `/app/command/scenarios` in this repository's routing convention while retaining the product concept `/command/scenarios`. Create question-first flow, editable Council strategy candidates, setup sections, run action and result comparison focused on ranges/stability/provenance rather than raw agent chatter.

## Task 13 — Feature flags, docs and observability

**Create/update:**
- Scenario runtime config module with `off | shadow | on` external simulation mode; default `off`.
- `docs/architecture/agent-os/scenario-lab.md`
- branch verification document under `docs/architecture/agent-os/`.

Document metrics/events, AGPL boundary, data authority, rollout and rollback.

## Task 14 — Verification gates

In a runnable checkout/CI, run:

```bash
pnpm --dir apps/crm typecheck
pnpm --dir apps/crm lint
pnpm --dir apps/crm lint:tenant-filter
pnpm --dir apps/crm test:unit
pnpm --dir apps/crm build
pnpm --dir apps/crm db:reset
pnpm --dir apps/crm test:db
pnpm --dir apps/crm gov:verify
```

Also prove org A cannot read/write org B scenario data and that synthetic output cannot enter authoritative CRM fact paths.

If this environment cannot execute these commands, the branch documentation must mark them PENDING rather than PASS.

## Commit strategy

Prefer reviewable commits in this order:

1. plan;
2. contracts + migrations + tests;
3. persistence + evidence/compiler/council/population;
4. simulation + evaluator/backtesting;
5. orchestrator + Hermes/API;
6. UI/docs/verification.

Do not merge or rebase this branch into `main`.