# Content OS Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar Radar de Notícias e Radar de Concorrentes usando `IntelligenceProvider`, com RSSHub e changedetection.io atrás de adapters privados e sinais normalizados no Postgres.

**Architecture:** O domínio persiste `content_sources`, `content_signals`, `competitors`, `competitor_monitors`, `competitor_events` e `content_opportunities`. Workers recolhem sinais e persistem resultados idempotentes; a UI nunca fala directamente com os engines.

**Tech Stack:** TypeScript 6, Next.js Route Handlers, Supabase/Postgres, event_log/workers, Zod, Redis quando necessário, Vitest, Playwright.

## Global Constraints

- Foundation concluída antes deste plano.
- `IntelligenceProvider` da Spec 17 é imutável neste plano.
- RSSHub/changedetection são privados.
- Não aceitar URL arbitrária sem validação anti-SSRF.
- `organization_id` vem de auth/contexto confiável.
- AI do changedetection.io fica desligada; classificação pertence ao Content OS.

---

## File structure

**Create**
- `lib/content-os/intelligence/normalize-signal.ts`
- `lib/content-os/intelligence/deduplicate.ts`
- `lib/content-os/providers/rsshub/client.ts`
- `lib/content-os/providers/rsshub/provider.ts`
- `lib/content-os/providers/changedetection/client.ts`
- `lib/content-os/providers/changedetection/provider.ts`
- `lib/content-os/intelligence/source-service.ts`
- `lib/content-os/intelligence/competitor-service.ts`
- `workers/content-os-intelligence-worker/main.ts`
- `app/api/v1/content-os/sources/route.ts`
- `app/api/v1/content-os/signals/route.ts`
- `app/api/v1/content-os/competitors/route.ts`
- `app/api/v1/content-os/opportunities/route.ts`
- `tests/unit/content-os-signal-normalization.test.ts`
- `tests/unit/content-os-rsshub-provider.test.ts`
- `tests/unit/content-os-changedetection-provider.test.ts`
- `tests/e2e/content-os-intelligence.spec.ts`

**Modify**
- `.env.example`
- `lib/env.ts`
- worker/deploy config only where the repo already declares workers.

---

### Task 1: Signal normalizer + dedup key

**Files:**
- Create: `lib/content-os/intelligence/normalize-signal.ts`
- Create: `lib/content-os/intelligence/deduplicate.ts`
- Test: `tests/unit/content-os-signal-normalization.test.ts`

**Interfaces:**
- Consumes: `RawSignal` from Foundation.
- Produces: canonical signal + deterministic dedup key.

- [ ] **Step 1: Write failing normalization tests**

Cover stable title/body trimming, canonical URL handling, UTC timestamps and same input → same hash.

- [ ] **Step 2: Run RED**

```bash
pnpm vitest run tests/unit/content-os-signal-normalization.test.ts
```

- [ ] **Step 3: Implement normalizer**

Return an object with `externalId`, `sourceUrl`, `title`, `body`, `publishedAt`, `observedAt`, `rawHash` and safe metadata.

- [ ] **Step 4: Implement tenant-aware dedup key**

```ts
export function signalDedupKey(input: {
  organizationId: string;
  provider: string;
  sourceId: string;
  externalId?: string;
  rawHash: string;
}) {
  return [
    input.organizationId,
    input.provider,
    input.sourceId,
    input.externalId || input.rawHash,
  ].join(":");
}
```

- [ ] **Step 5: Verify GREEN and commit**

```bash
pnpm vitest run tests/unit/content-os-signal-normalization.test.ts
pnpm typecheck
git add lib/content-os/intelligence tests/unit/content-os-signal-normalization.test.ts
git commit -m "feat(content-os): normalize intelligence signals"
```

---

### Task 2: RSSHub adapter

**Files:**
- Create: `lib/content-os/providers/rsshub/client.ts`
- Create: `lib/content-os/providers/rsshub/provider.ts`
- Test: `tests/unit/content-os-rsshub-provider.test.ts`
- Modify: `.env.example`
- Modify: `lib/env.ts`

**Interfaces:**
- Implements: `IntelligenceProvider`.
- Produces provider name: `rsshub`.

- [ ] **Step 1: Write failing adapter contract test**

Mock HTTP only at the transport boundary. Assert feed items map to `RawSignal[]`, provider errors become safe typed errors, and no credential is placed in URL query by our client.

- [ ] **Step 2: Add env contract**

Use private server-side envs such as `CONTENT_OS_RSSHUB_BASE_URL` and `CONTENT_OS_RSSHUB_ACCESS_KEY`; validate them in `lib/env.ts` using the existing env pattern.

- [ ] **Step 3: Implement client with timeout and header-based internal auth**

Do not concatenate the secret into query strings. If the deployed RSSHub requires its native query-based auth, terminate that detail at a private sidecar/reverse proxy rather than propagating it through application logs/URLs.

- [ ] **Step 4: Implement provider mapping**

`collect()` consumes a controlled source definition resolved server-side; user input is never treated as an arbitrary RSSHub route without catalogue validation.

- [ ] **Step 5: Verify and commit**

```bash
pnpm vitest run tests/unit/content-os-rsshub-provider.test.ts
pnpm typecheck
pnpm lint
git add lib/content-os/providers/rsshub tests/unit/content-os-rsshub-provider.test.ts .env.example lib/env.ts
git commit -m "feat(content-os): add rsshub intelligence provider"
```

---

### Task 3: changedetection.io adapter

**Files:**
- Create: `lib/content-os/providers/changedetection/client.ts`
- Create: `lib/content-os/providers/changedetection/provider.ts`
- Test: `tests/unit/content-os-changedetection-provider.test.ts`
- Modify: `.env.example`
- Modify: `lib/env.ts`

**Interfaces:**
- Implements: `IntelligenceProvider`.
- Produces provider name: `changedetection`.

- [ ] **Step 1: Write failing tests**

Cover `x-api-key` auth, safe timeout, 4xx/5xx mapping, snapshot/change → `RawSignal`, and secret redaction.

- [ ] **Step 2: Add server-side env contract**

Add `CONTENT_OS_CHANGEDETECTION_BASE_URL` and `CONTENT_OS_CHANGEDETECTION_API_KEY` using the existing env validator.

- [ ] **Step 3: Implement minimal client**

Support only operations required by the product: create/update/delete watch, read watch/history/latest snapshot, health/system info. Do not wrap the entire external API.

- [ ] **Step 4: Implement provider mapping**

A changed page yields `RawSignal` with deterministic `externalId` derived from watch + change timestamp/hash.

- [ ] **Step 5: Verify and commit**

```bash
pnpm vitest run tests/unit/content-os-changedetection-provider.test.ts
pnpm typecheck
pnpm lint
git add lib/content-os/providers/changedetection tests/unit/content-os-changedetection-provider.test.ts .env.example lib/env.ts
git commit -m "feat(content-os): add changedetection intelligence provider"
```

---

### Task 4: Source and competitor services

**Files:**
- Create: `lib/content-os/intelligence/source-service.ts`
- Create: `lib/content-os/intelligence/competitor-service.ts`
- Create: `tests/unit/content-os-intelligence-services.test.ts`

**Interfaces:**
- Consumes: provider registry, Supabase tenant context.
- Produces: source/monitor CRUD and collection commands.

- [ ] **Step 1: Write failing tenancy/service tests**

Assert org A cannot read or mutate org B source/competitor records even when given IDs from B.

- [ ] **Step 2: Implement trusted organization resolution**

Service functions receive `organizationId` only from authenticated server context, never directly from request body DTOs.

- [ ] **Step 3: Implement source lifecycle**

Create/enable/disable source; store provider + provider configuration references, not raw provider secrets.

- [ ] **Step 4: Implement competitor monitor lifecycle**

Content OS record is created first; adapter provisioning records remote watch ID as external reference. Failure leaves visible local failed/pending state rather than silently dropping the monitor.

- [ ] **Step 5: Verify and commit**

```bash
pnpm vitest run tests/unit/content-os-intelligence-services.test.ts
pnpm typecheck
git add lib/content-os/intelligence tests/unit/content-os-intelligence-services.test.ts
git commit -m "feat(content-os): add intelligence domain services"
```

---

### Task 5: Intelligence worker

**Files:**
- Create: `workers/content-os-intelligence-worker/main.ts`
- Create: `tests/unit/content-os-intelligence-worker.test.ts`

**Interfaces:**
- Consumes events: source collection/competitor check requests.
- Produces: `content.signal.collected`, persisted signals/events.

- [ ] **Step 1: Write failing worker tests**

Cover success, duplicate signal, provider timeout, retryable failure and terminal validation failure.

- [ ] **Step 2: Implement claim/ack using existing `event_log` worker pattern**

Do not invent a second queue. Reuse atomic claim/backoff/DLQ semantics from Spec 07.

- [ ] **Step 3: Persist idempotently**

Catch tenant-aware unique conflict and treat it as already-collected success, not as a duplicated business event.

- [ ] **Step 4: Emit downstream event**

After successful persistence emit `content.signal.collected` with local signal ID, not raw external payload.

- [ ] **Step 5: Verify and commit**

```bash
pnpm vitest run tests/unit/content-os-intelligence-worker.test.ts
pnpm typecheck
pnpm lint
git add workers/content-os-intelligence-worker tests/unit/content-os-intelligence-worker.test.ts
git commit -m "feat(content-os): add intelligence worker"
```

---

### Task 6: Intelligence API

**Files:**
- Create: `app/api/v1/content-os/sources/route.ts`
- Create: `app/api/v1/content-os/signals/route.ts`
- Create: `app/api/v1/content-os/competitors/route.ts`
- Create: `app/api/v1/content-os/opportunities/route.ts`
- Create: matching `route.test.ts` files.

**Interfaces:**
- Produces authenticated tenant API for UI/mobile.

- [ ] **Step 1: Write route tests first**

Cover unauthenticated 401/403 according to existing helper semantics, malformed body 400, tenant isolation, cursor pagination and `ok()` wrapper shape.

- [ ] **Step 2: Implement Zod request schemas**

Public body never includes authoritative `organization_id`.

- [ ] **Step 3: Implement route handlers through domain services**

No direct provider fetch in Route Handler.

- [ ] **Step 4: Verify and commit**

```bash
pnpm vitest run app/api/v1/content-os/**/route.test.ts
pnpm typecheck
pnpm lint
git add app/api/v1/content-os
git commit -m "feat(content-os): expose intelligence api"
```

---

### Task 7: E2E Radar journey

**Files:**
- Create: `tests/e2e/content-os-intelligence.spec.ts`
- Modify: `docs/testing/user-journey-map.md`

**Interfaces:**
- Consumes: APIs + test provider fixture.
- Produces: human-visible proof of Radar workflow.

- [ ] **Step 1: Add deterministic fixture provider mode for test environment**

Use adapter injection, not production code branches with hard-coded fake payloads.

- [ ] **Step 2: Test Radar de Notícias**

Create source → collect → signal appears → create/inspect opportunity.

- [ ] **Step 3: Test Radar de Concorrentes**

Create competitor → monitor → inject change → event appears.

- [ ] **Step 4: Test mobile viewport of both radars**

Assert no horizontal overflow and critical actions remain reachable.

- [ ] **Step 5: Verify**

```bash
pnpm test:e2e --grep "Content OS Intelligence"
pnpm build
```

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/content-os-intelligence.spec.ts docs/testing/user-journey-map.md
git commit -m "test(content-os): cover intelligence journeys"
```

---

### Task 8: Intelligence final gate

- [ ] **Step 1: Run**

```bash
pnpm typecheck
pnpm lint
pnpm lint:channels
pnpm test:unit
pnpm test:db
pnpm test:e2e --grep "Content OS Intelligence"
pnpm build
```

- [ ] **Step 2: Verify operational failures explicitly**

Prove provider unavailable → visible failed/retry state; duplicate signal → no duplicate row; org B → no access to org A.

- [ ] **Step 3: Do not declare changedetection SaaS-ready**

Its commercial/licensing gate remains open until external legal/procurement validation is recorded.
