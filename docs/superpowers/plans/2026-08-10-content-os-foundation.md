# Content OS Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o bounded context Content OS, o schema base, os quatro provider contracts e o modelo de jobs/eventos partilhado pelos restantes módulos.

**Architecture:** O domínio é provider-agnostic e vive em `lib/content-os/`. Persistência é Supabase/Postgres com RLS; side effects externos são emitidos para workers através do `event_log` existente. Providers concretos só entram em subplanos posteriores.

**Tech Stack:** TypeScript 6 strict, Next.js 16, Supabase/Postgres, Zod, Vitest, DB invariant tests, Sentry/logger canónico.

## Global Constraints

- Executar apenas em `gpt-lumenva-content-os`.
- Não criar PR nem tocar `main`.
- Seguir Spec 17 e Spec 01/07 existentes.
- Toda tabela tenant-aware usa `organization_id` + RLS.
- Schema sai em migration + baseline + manifest.
- API usa `/api/v1/`, `snake_case`, `ok()`/`fail()` e Zod.
- Sem imports de Postiz/RSSHub/changedetection/ComfyUI/MPT no domínio.

---

## File structure

**Create**
- `lib/content-os/providers/types.ts` — tipos partilhados de provider/job.
- `lib/content-os/providers/intelligence.ts` — contract `IntelligenceProvider`.
- `lib/content-os/providers/creative.ts` — contract `CreativeProvider`.
- `lib/content-os/providers/video-composer.ts` — contract `VideoComposer`.
- `lib/content-os/providers/distribution.ts` — contract `DistributionProvider`.
- `lib/content-os/providers/registry.ts` — registry explícito, sem auto-discovery.
- `lib/content-os/events.ts` — nomes e payload schemas dos eventos Content OS.
- `lib/content-os/jobs.ts` — transições permitidas de job.
- `lib/content-os/providers/health.ts` — normalização de health.
- `tests/unit/content-os-provider-contracts.test.ts`.
- `tests/unit/content-os-jobs.test.ts`.
- `tests/invariants/content-os-schema.test.ts`.
- `tests/invariants/content-os-rls.test.ts`.
- `supabase/migrations/20260810235000_content_os_foundation.sql`.

**Modify**
- `supabase/baseline.sql`.
- `supabase/migrations/MANIFEST.md`.
- `lib/database.types.ts` via regeneração.

---

### Task 1: Provider shared types

**Files:**
- Create: `lib/content-os/providers/types.ts`
- Test: `tests/unit/content-os-provider-contracts.test.ts`

**Interfaces:**
- Produces: `ProviderHealth`, `ProviderJobState`, `ProviderJobRef`.

- [ ] **Step 1: Write failing type/runtime invariant test**

```ts
import { describe, expect, it } from "vitest";
import { providerJobStates } from "@/lib/content-os/providers/types";

describe("Content OS provider contracts", () => {
  it("keeps the canonical provider job state vocabulary stable", () => {
    expect(providerJobStates).toEqual([
      "queued",
      "running",
      "succeeded",
      "failed",
      "cancelled",
    ]);
  });
});
```

- [ ] **Step 2: Run test and verify RED**

```bash
pnpm vitest run tests/unit/content-os-provider-contracts.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement minimal shared types**

```ts
export const providerJobStates = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
] as const;

export type ProviderJobState = (typeof providerJobStates)[number];

export type ProviderHealth = {
  ok: boolean;
  checkedAt: string;
  latencyMs?: number;
  code?: string;
  message?: string;
};

export type ProviderJobRef = {
  provider: string;
  providerJobId: string;
  state: ProviderJobState;
};
```

- [ ] **Step 4: Run test and verify GREEN**

```bash
pnpm vitest run tests/unit/content-os-provider-contracts.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/content-os/providers/types.ts tests/unit/content-os-provider-contracts.test.ts
git commit -m "feat(content-os): add provider shared types"
```

---

### Task 2: Four provider contracts

**Files:**
- Create: `lib/content-os/providers/intelligence.ts`
- Create: `lib/content-os/providers/creative.ts`
- Create: `lib/content-os/providers/video-composer.ts`
- Create: `lib/content-os/providers/distribution.ts`
- Modify: `tests/unit/content-os-provider-contracts.test.ts`

**Interfaces:**
- Consumes: `ProviderHealth`, `ProviderJobRef`.
- Produces: four exact interfaces from Spec 17.

- [ ] **Step 1: Extend test with compile-time contract fixtures**

Create one fake object for each interface and assert its `provider` name at runtime. The fixture must implement every method so a signature drift fails `typecheck`.

```ts
const intelligence: IntelligenceProvider = {
  provider: "fake-intelligence",
  collect: async () => [],
  health: async () => ({ ok: true, checkedAt: new Date(0).toISOString() }),
};

expect(intelligence.provider).toBe("fake-intelligence");
```

Repeat explicitly for `CreativeProvider`, `VideoComposer` and `DistributionProvider`.

- [ ] **Step 2: Run typecheck and verify RED**

```bash
pnpm typecheck
```

Expected: FAIL until interfaces exist.

- [ ] **Step 3: Implement contracts exactly as Spec 17**

Use named exported types for every input/result; no `any`; `metadata`/provider-specific extension points use `Record<string, unknown>`.

- [ ] **Step 4: Verify types and unit tests**

```bash
pnpm typecheck
pnpm vitest run tests/unit/content-os-provider-contracts.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/content-os/providers tests/unit/content-os-provider-contracts.test.ts
git commit -m "feat(content-os): define provider contracts"
```

---

### Task 3: Explicit provider registry

**Files:**
- Create: `lib/content-os/providers/registry.ts`
- Modify: `tests/unit/content-os-provider-contracts.test.ts`

**Interfaces:**
- Consumes: four provider interfaces.
- Produces: typed registration/resolution without importing concrete engines into domain code.

- [ ] **Step 1: Add failing registry test**

```ts
import { ContentOsProviderRegistry } from "@/lib/content-os/providers/registry";

it("fails closed for unknown providers", () => {
  const registry = new ContentOsProviderRegistry();
  expect(() => registry.getIntelligence("missing")).toThrow("Unknown intelligence provider: missing");
});
```

- [ ] **Step 2: Run RED**

```bash
pnpm vitest run tests/unit/content-os-provider-contracts.test.ts
```

- [ ] **Step 3: Implement registry with explicit maps**

```ts
export class ContentOsProviderRegistry {
  private readonly intelligence = new Map<string, IntelligenceProvider>();
  private readonly creative = new Map<string, CreativeProvider>();
  private readonly composers = new Map<string, VideoComposer>();
  private readonly distribution = new Map<string, DistributionProvider>();

  registerIntelligence(provider: IntelligenceProvider) {
    this.intelligence.set(provider.provider, provider);
  }

  getIntelligence(name: string) {
    const provider = this.intelligence.get(name);
    if (!provider) throw new Error(`Unknown intelligence provider: ${name}`);
    return provider;
  }
}
```

Implement equivalent explicit register/get methods for the other three maps.

- [ ] **Step 4: Verify GREEN**

```bash
pnpm vitest run tests/unit/content-os-provider-contracts.test.ts
pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add lib/content-os/providers/registry.ts tests/unit/content-os-provider-contracts.test.ts
git commit -m "feat(content-os): add provider registry"
```

---

### Task 4: Foundation schema

**Files:**
- Create: `supabase/migrations/20260810235000_content_os_foundation.sql`
- Modify: `supabase/baseline.sql`
- Modify: `supabase/migrations/MANIFEST.md`
- Test: `tests/invariants/content-os-schema.test.ts`
- Test: `tests/invariants/content-os-rls.test.ts`

**Interfaces:**
- Produces: base tables required by all subsequent subplans.

- [ ] **Step 1: Write failing schema invariant**

Test existence of these tables:

```ts
const tables = [
  "content_sources",
  "content_signals",
  "competitors",
  "competitor_monitors",
  "competitor_events",
  "content_opportunities",
  "content_campaigns",
  "content_ideas",
  "content_hooks",
  "content_scripts",
  "content_items",
  "content_approvals",
  "content_creators",
  "content_creator_profiles",
  "content_creator_assignments",
  "content_assets",
  "creative_jobs",
  "creative_job_assets",
  "distribution_connections",
  "publication_jobs",
  "publication_metrics",
  "content_learning_events",
];
```

Follow the existing `tests/invariants/*-schema.test.ts` database helper pattern; do not invent a parallel Postgres harness.

- [ ] **Step 2: Write failing RLS invariant**

For every tenant table, assert RLS is enabled and policies reference trusted org membership. Include an actual two-org access test following `tests/invariants/rls-isolation.test.ts`.

- [ ] **Step 3: Run DB tests and verify RED**

```bash
pnpm test:db
```

Expected: new invariants FAIL because tables do not exist.

- [ ] **Step 4: Implement migration**

Minimum common columns for every mutable tenant entity:

```sql
id uuid primary key default gen_random_uuid(),
organization_id uuid not null references organizations(id) on delete cascade,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
```

Use domain-specific constraints, indexes and FKs; do not use free-form strings where a FK/check vocabulary is known. Add unique tenant-aware keys for provider refs/dedup where the domain requires them.

- [ ] **Step 5: Apply schema tripla**

Copy the final idempotent baseline form to `supabase/baseline.sql` and add the migration entry to `supabase/migrations/MANIFEST.md`.

- [ ] **Step 6: Regenerate DB types**

Use the repository's established Supabase type-generation command/path. Verify the generated diff rather than editing `lib/database.types.ts` by hand.

- [ ] **Step 7: Run DB tests and verify GREEN**

```bash
pnpm test:db
```

Expected: schema + RLS invariants PASS, including two-tenant isolation.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260810235000_content_os_foundation.sql supabase/baseline.sql supabase/migrations/MANIFEST.md lib/database.types.ts tests/invariants/content-os-schema.test.ts tests/invariants/content-os-rls.test.ts
git commit -m "feat(content-os): add foundation schema"
```

---

### Task 5: Canonical job state machine

**Files:**
- Create: `lib/content-os/jobs.ts`
- Test: `tests/unit/content-os-jobs.test.ts`

**Interfaces:**
- Produces: deterministic local state transitions for creative/publication jobs.

- [ ] **Step 1: Write failing transition tests**

```ts
expect(canTransitionJob("queued", "running")).toBe(true);
expect(canTransitionJob("running", "succeeded")).toBe(true);
expect(canTransitionJob("running", "failed")).toBe(true);
expect(canTransitionJob("queued", "cancelled")).toBe(true);
expect(canTransitionJob("succeeded", "running")).toBe(false);
expect(canTransitionJob("cancelled", "succeeded")).toBe(false);
```

- [ ] **Step 2: Run RED**

```bash
pnpm vitest run tests/unit/content-os-jobs.test.ts
```

- [ ] **Step 3: Implement transition table**

```ts
const transitions: Record<ProviderJobState, readonly ProviderJobState[]> = {
  queued: ["running", "failed", "cancelled"],
  running: ["succeeded", "failed", "cancelled"],
  succeeded: [],
  failed: [],
  cancelled: [],
};
```

Expose `canTransitionJob(from, to)` and `assertJobTransition(from, to)`.

- [ ] **Step 4: Verify GREEN**

```bash
pnpm vitest run tests/unit/content-os-jobs.test.ts
pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add lib/content-os/jobs.ts tests/unit/content-os-jobs.test.ts
git commit -m "feat(content-os): add canonical job state machine"
```

---

### Task 6: Content OS event contracts

**Files:**
- Create: `lib/content-os/events.ts`
- Create: `tests/unit/content-os-events.test.ts`

**Interfaces:**
- Produces: event names/schemas consumed by workers and future adapters.

- [ ] **Step 1: Write failing event vocabulary test**

Assert the exact event names from Spec 17, including `content.signal.collected`, `content.asset.requested`, `content.publication.requested`, `content.metrics.collected` and `content.learning.recorded`.

- [ ] **Step 2: Define Zod schemas for event payloads**

Every tenant event includes trusted `organizationId`, local entity/job ID and correlation/request ID. Provider-specific metadata is optional and structured.

- [ ] **Step 3: Verify invalid payloads fail closed**

Test missing `organizationId`, malformed UUID and unknown event name.

- [ ] **Step 4: Run tests**

```bash
pnpm vitest run tests/unit/content-os-events.test.ts
pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add lib/content-os/events.ts tests/unit/content-os-events.test.ts
git commit -m "feat(content-os): define event contracts"
```

---

### Task 7: Provider health normalization

**Files:**
- Create: `lib/content-os/providers/health.ts`
- Create: `tests/unit/content-os-provider-health.test.ts`

**Interfaces:**
- Produces: stable health result and timeout wrapper used by every adapter.

- [ ] **Step 1: Write failing timeout/error tests**

Test success, timeout and thrown provider error without leaking raw secret-bearing messages.

- [ ] **Step 2: Implement bounded health wrapper**

The wrapper records `checkedAt`, measured `latencyMs`, stable `code`, safe `message`; it never returns credentials or raw response bodies.

- [ ] **Step 3: Run tests**

```bash
pnpm vitest run tests/unit/content-os-provider-health.test.ts
pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add lib/content-os/providers/health.ts tests/unit/content-os-provider-health.test.ts
git commit -m "feat(content-os): normalize provider health"
```

---

### Task 8: Foundation verification gate

**Files:**
- Review: all files changed by Tasks 1–7.

**Interfaces:**
- Produces: stable contract boundary for Intelligence, Creative and Distribution subplans.

- [ ] **Step 1: Inspect diff**

```bash
git diff origin/main...HEAD --stat
git diff origin/main...HEAD -- lib/content-os supabase tests
```

- [ ] **Step 2: Run full relevant verification**

```bash
pnpm harness:check
pnpm typecheck
pnpm lint
pnpm lint:channels
pnpm test:unit
pnpm test:db
pnpm build
```

Expected: all applicable commands exit 0 with fresh evidence.

- [ ] **Step 3: Stop on contract drift**

If a child plan requires changing one of the four provider interfaces, amend Spec 17 + this plan first instead of creating a local variant.
