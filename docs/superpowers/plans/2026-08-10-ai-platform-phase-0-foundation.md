# AI Platform Phase 0 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a green baseline, typed AI-platform contracts, tenant-aware feature flags, projection ledger, kill switches, sanitized Golden Dataset, and secret-management scaffolding without changing agent behavior.

**Architecture:** Phase 0 is intentionally behavior-preserving. It adds contracts and operational controls around the existing PostgreSQL/event_log/agent-engine architecture. All new providers remain `OFF`; the agent must behave byte-for-byte equivalent where deterministic inputs permit.

**Tech Stack:** Next.js 16, TypeScript 6, Zod 4, Supabase/Postgres 17, Vitest 4, existing event_log/worker patterns, Infisical CLI integration documentation.

## Global Constraints

- Work only on `gpt-ai-platform` or child branch.
- PostgreSQL remains source of truth.
- New tenant-aware tables require RLS + DB invariants.
- Do not enable external providers in this phase.
- Do not create paid resources.
- Do not expose new public endpoints.
- Schema change = migration + baseline.sql + MANIFEST.md together.

---

### Task 1: Restore and freeze the baseline

**Files:**
- Inspect: `website/app/api/contact/route.ts`
- Inspect: `website/lib/`
- Inspect: commits `e94dad40002dfb220fc4e946afbb3f9805a398cc`, `97f9a74987266cc5c48be81da0f0aadb15c2760d`, `92ee126c6e536ae097c5b9ab82d04816649f8b13`
- Modify only files proven to be the root cause of the current build failure.
- Create evidence: `docs/evidence/ai-platform/baseline-summary.md`

**Interfaces:**
- Consumes: current repository build.
- Produces: green baseline used by every later phase.

- [ ] **Step 1: Reproduce the current baseline failure**

Run:

```bash
pnpm install --frozen-lockfile
pnpm build
```

Expected on the known starting commit: failure around `website/app/api/contact/route.ts` importing `@/lib/contact-form` if the defect is still present.

- [ ] **Step 2: Trace the missing module from Git history**

Run:

```bash
git log --all -- website/app/api/contact/route.ts website/lib/contact-form.ts website/lib/contact-rate-limit.ts website/lib/resend.ts
git show e94dad40002dfb220fc4e946afbb3f9805a398cc --
git show 97f9a74987266cc5c48be81da0f0aadb15c2760d --
git show 92ee126c6e536ae097c5b9ab82d04816649f8b13 --
```

Do not create a fake module until the original intended files/imports are understood.

- [ ] **Step 3: Add a regression test for the contact API/module boundary if missing**

The test must import the exact production module path and exercise validation without Resend network access.

- [ ] **Step 4: Fix the root cause minimally**

Allowed: restore a file lost by merge, correct an import path, or reconcile the website merge.  
Forbidden: `ts-ignore`, excluding `website` from build, deleting route, making build skip typecheck.

- [ ] **Step 5: Run the complete baseline gate**

```bash
pnpm typecheck
pnpm lint
pnpm lint:channels
pnpm test:unit
pnpm test:db
pnpm build
```

- [ ] **Step 6: Record aggregate baseline**

Create `docs/evidence/ai-platform/baseline-summary.md` with commit SHA, date, commands/results, no PII, and placeholders only for metrics that genuinely require runtime measurement later are forbidden; if a metric cannot yet be measured, explicitly write `not measured in Phase 0 because <concrete reason>`.

- [ ] **Step 7: Commit**

```bash
git add <only-baseline-files> docs/evidence/ai-platform/baseline-summary.md
git commit -m "fix: restore green baseline before ai platform work"
```

---

### Task 2: Add canonical AI-platform contract types

**Files:**
- Create: `lib/agent-engine/platform/contracts.ts`
- Create: `lib/agent-engine/platform/contracts.test.ts`

**Interfaces:**
- Produces: `FeatureMode`, `AuthorityDomain`, `MemoryRisk`, `ProjectionEnvelope`, `ContextRequest`, `ContextItem`, `ContextProviderResult`.

- [ ] **Step 1: Write tests for enum/value parsing and envelope validation**

Use Zod. Tests must reject missing `organizationId`, invalid risk, invalid feature mode, and empty idempotency key.

- [ ] **Step 2: Run the test and verify failure**

```bash
pnpm vitest run lib/agent-engine/platform/contracts.test.ts
```

- [ ] **Step 3: Implement exact canonical values**

```ts
export const featureModeSchema = z.enum(["off", "shadow", "canary", "on"]);
export const memoryRiskSchema = z.enum(["low", "medium", "high"]);
export const authorityDomainSchema = z.enum([
  "commercial_status",
  "customer_preference",
  "consent",
  "legal",
  "product_policy",
  "relationship",
  "behavior",
  "operational_state",
]);
```

Add typed projection/context schemas matching the master spec.

- [ ] **Step 4: Verify**

```bash
pnpm vitest run lib/agent-engine/platform/contracts.test.ts
pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add lib/agent-engine/platform/contracts.ts lib/agent-engine/platform/contracts.test.ts
git commit -m "feat(ai-platform): add canonical platform contracts"
```

---

### Task 3: Create feature flag and projection ledger schema

**Files:**
- Create: `supabase/migrations/20260810030000_0116_ai_platform_foundation.sql`
- Modify: `supabase/baseline.sql`
- Modify: `supabase/migrations/MANIFEST.md`
- Create: `tests/invariants/ai-platform-foundation.test.ts`

**Interfaces:**
- Produces tables: `ai_platform_feature_flags`, `ai_projection_ledger`.

- [ ] **Step 1: Write DB invariant tests first**

Tests must prove:

- org A cannot read/write org B flags/ledger through authenticated role;
- `organization_id NULL` feature row is not writable by normal tenant users;
- feature mode constraint accepts only `off|shadow|canary|on`;
- duplicate `(org, projection_type, provider, idempotency_key)` is rejected;
- anon has no write access.

- [ ] **Step 2: Run DB test and verify failure**

```bash
pnpm test:db
```

Expected: new invariant fails because tables do not exist.

- [ ] **Step 3: Implement migration**

Create both tables with timestamps, checks, indexes, RLS. Global rows (`organization_id IS NULL`) are service/platform-managed only; tenant RLS sees only own org row. Do not invent an authenticated policy that exposes all global configuration if it contains operational config; the app service resolves defaults through trusted server code.

- [ ] **Step 4: Mirror migration into baseline and MANIFEST**

Append idempotent SQL to `supabase/baseline.sql`; add manifest row `0116_ai_platform_foundation`.

- [ ] **Step 5: Verify DB**

```bash
pnpm test:db
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260810030000_0116_ai_platform_foundation.sql supabase/baseline.sql supabase/migrations/MANIFEST.md tests/invariants/ai-platform-foundation.test.ts
git commit -m "feat(ai-platform): add feature flags and projection ledger"
```

---

### Task 4: Implement server-side feature resolution and kill switches

**Files:**
- Create: `lib/agent-engine/platform/features.ts`
- Create: `lib/agent-engine/platform/features.test.ts`
- Modify: `lib/env.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces:

```ts
resolveAiPlatformFeature(input: {
  organizationId: string;
  feature: AiPlatformFeature;
}): Promise<{ mode: FeatureMode; config: Record<string, unknown>; killed: boolean }>;
```

- [ ] **Step 1: Write unit tests**

Cases: no row=>`off`; global `shadow`; tenant override `canary`; kill switch=>`off` regardless of DB; invalid config never enables feature.

- [ ] **Step 2: Verify failure**

```bash
pnpm vitest run lib/agent-engine/platform/features.test.ts
```

- [ ] **Step 3: Add kill-switch env vars**

Add all six `AI_PLATFORM_KILL_*` vars as optional booleans default false to `lib/env.ts` and `.env.example`.

- [ ] **Step 4: Implement resolver using trusted DB access**

Never accept organization from a model/tool payload. Query global default and exact tenant row; tenant override wins unless kill switch is true.

- [ ] **Step 5: Verify**

```bash
pnpm vitest run lib/agent-engine/platform/features.test.ts
pnpm typecheck
pnpm lint
```

- [ ] **Step 6: Commit**

```bash
git add lib/agent-engine/platform/features.ts lib/agent-engine/platform/features.test.ts lib/env.ts .env.example
git commit -m "feat(ai-platform): add feature resolution and kill switches"
```

---

### Task 5: Add projection ledger repository

**Files:**
- Create: `lib/agent-engine/platform/projection-ledger.ts`
- Create: `lib/agent-engine/platform/projection-ledger.test.ts`

**Interfaces:**
- Produces: `beginProjection`, `markProjectionApplied`, `markProjectionRetry`, `markProjectionFailed`, `markProjectionDeleted`.

- [ ] **Step 1: Write tests using a queryable fake/transaction pattern already used in agent-engine tests**

Verify idempotent duplicate begin, sourceVersion monotonic comparison, retry metadata without raw payload, and organization filter in every SQL query.

- [ ] **Step 2: Run failing tests**

```bash
pnpm vitest run lib/agent-engine/platform/projection-ledger.test.ts
```

- [ ] **Step 3: Implement repository**

Do not persist conversation text or secret-bearing payload in ledger.

- [ ] **Step 4: Verify**

```bash
pnpm vitest run lib/agent-engine/platform/projection-ledger.test.ts
pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add lib/agent-engine/platform/projection-ledger.ts lib/agent-engine/platform/projection-ledger.test.ts
git commit -m "feat(ai-platform): add projection ledger repository"
```

---

### Task 6: Add synthetic Golden Dataset and local evaluator harness

**Files:**
- Create: `tests/fixtures/ai-platform/golden-cases.json`
- Create: `scripts/ai-platform-eval.ts`
- Create: `tests/unit/ai-platform-eval.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces command: `pnpm ai:eval:local`.

- [ ] **Step 1: Create all 25 mandatory synthetic cases from the QA spec**

Use UUIDs reserved for tests and invented names/data only.

- [ ] **Step 2: Write parser/schema test**

Every case must validate; duplicate IDs fail.

- [ ] **Step 3: Implement local evaluator command**

At Phase 0 it evaluates deterministic contract properties only; no paid LLM call. Output JSON summary and exit non-zero on P0 deterministic failure.

- [ ] **Step 4: Add package script**

```json
"ai:eval:local": "tsx scripts/ai-platform-eval.ts"
```

- [ ] **Step 5: Verify**

```bash
pnpm ai:eval:local
pnpm vitest run tests/unit/ai-platform-eval.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add tests/fixtures/ai-platform/golden-cases.json scripts/ai-platform-eval.ts tests/unit/ai-platform-eval.test.ts package.json pnpm-lock.yaml
git commit -m "test(ai-platform): add synthetic golden evaluation harness"
```

---

### Task 7: Add Infisical operating contract without moving tenant BYOK

**Files:**
- Create: `docs/runbooks/ai-platform-secrets.md`
- Modify: `.env.example`
- Do not modify: `lib/ai/credentials.ts` except if a test reveals a concrete bug unrelated to migration.

**Interfaces:**
- Produces operational mapping for platform secrets vs tenant BYOK vs KeePassXC.

- [ ] **Step 1: Document inventory categories**

Explicitly classify existing env secrets from `lib/env.ts` into platform/runtime. State that `ai_provider_credentials` remains tenant BYOK encrypted in DB.

- [ ] **Step 2: Document Infisical injection pattern**

Use `infisical run -- <command>` for local/controlled runtime. Never put Infisical access token in repository. Do not enable production auto-restart/watch.

- [ ] **Step 3: Document break-glass**

KeePassXC contains human/admin/recovery only; apps never read it.

- [ ] **Step 4: Add non-secret Infisical config keys to `.env.example` only if code in a later task actually consumes them**

Do not add dead env vars prematurely.

- [ ] **Step 5: Commit**

```bash
git add docs/runbooks/ai-platform-secrets.md .env.example
git commit -m "docs(ai-platform): define secrets operating model"
```

---

### Task 8: Phase 0 release gate

**Files:**
- Create: `docs/evidence/ai-platform/phase-0-gate.md`

- [ ] **Step 1: Run full verification**

```bash
pnpm typecheck
pnpm lint
pnpm lint:channels
pnpm test:unit
pnpm test:db
pnpm ai:eval:local
pnpm build
git diff --check
```

- [ ] **Step 2: Verify no external provider influences runtime**

All feature rows/defaults must resolve to `off` in a fresh install and all kill switches default false.

- [ ] **Step 3: Write GO/NO-GO evidence using QA spec format**

`GO` only with zero open P0/P1.

- [ ] **Step 4: Commit evidence**

```bash
git add docs/evidence/ai-platform/phase-0-gate.md
git commit -m "docs(ai-platform): record phase 0 release gate"
```
