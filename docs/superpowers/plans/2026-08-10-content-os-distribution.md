# Content OS Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar conexões sociais, publication jobs e sincronização de estado/métricas através do `DistributionProvider`, usando Postiz como primeiro provider.

**Architecture:** O Content OS é dono de `distribution_connections` e `publication_jobs`; Postiz é side-effect engine. Toda publicação nasce localmente, recebe idempotency key, é executada por worker e reconciliada por provider reference.

**Tech Stack:** TypeScript 6, Next.js Route Handlers, Supabase/Postgres, event_log/workers, Zod, server-side HTTP, Vitest, Playwright.

## Global Constraints

- Foundation concluída.
- `DistributionProvider` é o contrato único.
- Postiz nunca é acedido pelo browser.
- Tokens sociais/Postiz não são duplicados para o domínio sem necessidade.
- Publicação tem idempotência server-side.
- Timeout não significa ausência de publicação remota.
- `organization_id` é sempre resolvido de contexto confiável.

---

## File structure

**Create**
- `lib/content-os/distribution/connection-service.ts`
- `lib/content-os/distribution/publication-service.ts`
- `lib/content-os/distribution/metrics-service.ts`
- `lib/content-os/providers/postiz/client.ts`
- `lib/content-os/providers/postiz/provider.ts`
- `workers/content-os-distribution-worker/main.ts`
- `app/api/v1/content-os/distribution/connections/route.ts`
- `app/api/v1/content-os/publications/route.ts`
- `app/api/v1/content-os/publications/[id]/route.ts`
- `tests/unit/content-os-postiz-provider.test.ts`
- `tests/unit/content-os-publication-service.test.ts`
- `tests/unit/content-os-distribution-worker.test.ts`
- `tests/e2e/content-os-distribution.spec.ts`

**Modify**
- `.env.example`
- `lib/env.ts`
- deploy/runbook only when Postiz private service is actually added.

---

### Task 1: Postiz client/provider contract

**Files:**
- Create: `lib/content-os/providers/postiz/client.ts`
- Create: `lib/content-os/providers/postiz/provider.ts`
- Test: `tests/unit/content-os-postiz-provider.test.ts`
- Modify: `.env.example`
- Modify: `lib/env.ts`

**Interfaces:**
- Implements: `DistributionProvider` as provider `postiz`.

- [ ] **Step 1: Write failing adapter tests**

Cover connect URL creation, publish, status, metrics, 401, 429, 5xx, timeout and response validation. Assert auth secret stays in `Authorization` header and is redacted from errors.

- [ ] **Step 2: Add env contract**

Define server-only `CONTENT_OS_POSTIZ_BASE_URL` and platform/admin bootstrap secret only if the deployment model requires it. Tenant-specific provider references are stored in domain tables; raw secrets stay in the provider boundary/secret storage.

- [ ] **Step 3: Implement minimal HTTP client**

Wrap only endpoints needed by V1: integration/connect, post creation/status, integration list and metrics. Do not mirror the entire Postiz API.

- [ ] **Step 4: Implement provider mapping**

Map remote states to canonical `ProviderJobState`; unknown state fails safely instead of being treated as success.

- [ ] **Step 5: Verify and commit**

```bash
pnpm vitest run tests/unit/content-os-postiz-provider.test.ts
pnpm typecheck
pnpm lint
git add lib/content-os/providers/postiz tests/unit/content-os-postiz-provider.test.ts .env.example lib/env.ts
git commit -m "feat(content-os): add postiz distribution provider"
```

---

### Task 2: Connection service

**Files:**
- Create: `lib/content-os/distribution/connection-service.ts`
- Create: `tests/unit/content-os-distribution-connections.test.ts`

**Interfaces:**
- Consumes: Postiz provider + `distribution_connections`.
- Produces: tenant-owned logical connection lifecycle.

- [ ] **Step 1: Write failing tests**

Cover tenant isolation, duplicate connection prevention, disabled connection, provider reference update and no raw token persistence.

- [ ] **Step 2: Implement connection creation**

Create local connection record first in `pending`; request provider connection URL server-side; persist only provider organization/integration references needed for subsequent calls.

- [ ] **Step 3: Implement connection reconciliation**

Provider callback/poll transitions `pending → active` or `failed`; failed connection remains visible with safe reason.

- [ ] **Step 4: Verify and commit**

```bash
pnpm vitest run tests/unit/content-os-distribution-connections.test.ts
pnpm typecheck
git add lib/content-os/distribution/connection-service.ts tests/unit/content-os-distribution-connections.test.ts
git commit -m "feat(content-os): add distribution connection service"
```

---

### Task 3: Publication service + idempotency

**Files:**
- Create: `lib/content-os/distribution/publication-service.ts`
- Test: `tests/unit/content-os-publication-service.test.ts`

**Interfaces:**
- Produces: local publication creation/cancel/status semantics.

- [ ] **Step 1: Write failing idempotency tests**

```ts
it("reuses same publication for same idempotency key and payload", async () => {
  // create twice with the same key/payload
  // assert same local publication id and one queued side effect
});

it("rejects same idempotency key with different payload", async () => {
  // assert canonical 409/idempotency conflict mapping
});
```

- [ ] **Step 2: Include payload hash**

Canonical hash covers content ID, connection ID, scheduled time and asset/version references that affect the side effect.

- [ ] **Step 3: Persist local job before side effect**

`publication_jobs.state = queued` and append `content.publication.requested`; no inline Postiz publish from route/service transaction.

- [ ] **Step 4: Implement terminal state protections**

A `published`/`succeeded` job cannot return to `running`; cancel after remote publication becomes a distinct unsupported/no-op outcome, not fake rollback.

- [ ] **Step 5: Verify and commit**

```bash
pnpm vitest run tests/unit/content-os-publication-service.test.ts
pnpm typecheck
git add lib/content-os/distribution/publication-service.ts tests/unit/content-os-publication-service.test.ts
git commit -m "feat(content-os): add idempotent publication service"
```

---

### Task 4: Distribution worker

**Files:**
- Create: `workers/content-os-distribution-worker/main.ts`
- Test: `tests/unit/content-os-distribution-worker.test.ts`

**Interfaces:**
- Consumes: `content.publication.requested`.
- Produces: remote publication + local state/events.

- [ ] **Step 1: Write failing worker tests**

Cover success, remote validation failure, timeout-after-send, 429, duplicate event and provider unavailable.

- [ ] **Step 2: Implement claim using existing Spec 07 worker semantics**

No second queue implementation.

- [ ] **Step 3: Handle timeout-after-send safely**

When request outcome is unknown, do **not** enqueue blind second publish. Persist `reconcile_required`/equivalent failure metadata and query provider using available remote/local correlation before retrying the side effect.

- [ ] **Step 4: Persist provider publication ref atomically with state transition where practical**

Store provider ID and normalised state; emit `content.publication.published` only after confirmed remote success.

- [ ] **Step 5: Verify and commit**

```bash
pnpm vitest run tests/unit/content-os-distribution-worker.test.ts
pnpm typecheck
pnpm lint
git add workers/content-os-distribution-worker tests/unit/content-os-distribution-worker.test.ts
git commit -m "feat(content-os): add distribution worker"
```

---

### Task 5: Metrics service

**Files:**
- Create: `lib/content-os/distribution/metrics-service.ts`
- Create: `tests/unit/content-os-metrics-service.test.ts`

**Interfaces:**
- Consumes: provider metrics + local publication.
- Produces: normalised `publication_metrics` snapshots.

- [ ] **Step 1: Write failing mapping tests**

Map supported metrics to canonical names such as impressions/views, reach, likes/reactions, comments, shares, saves and clicks only when provider supplies them. Missing metric is `null`/absent, never fabricated zero.

- [ ] **Step 2: Implement snapshot timestamp semantics**

Each metrics record stores `captured_at` and provider/source version/reference sufficient for debugging.

- [ ] **Step 3: Implement idempotent snapshot insert/update policy**

Use a tenant/publication/captured-window unique key appropriate to the cadence; repeated collection of the same snapshot does not multiply rows.

- [ ] **Step 4: Verify and commit**

```bash
pnpm vitest run tests/unit/content-os-metrics-service.test.ts
pnpm typecheck
git add lib/content-os/distribution/metrics-service.ts tests/unit/content-os-metrics-service.test.ts
git commit -m "feat(content-os): normalize publication metrics"
```

---

### Task 6: Distribution API

**Files:**
- Create: `app/api/v1/content-os/distribution/connections/route.ts`
- Create: `app/api/v1/content-os/publications/route.ts`
- Create: `app/api/v1/content-os/publications/[id]/route.ts`
- Create matching `route.test.ts` files.

**Interfaces:**
- Produces: authenticated UI/mobile API.

- [ ] **Step 1: Write route tests**

Cover auth, RBAC, tenant isolation, Zod, idempotency header required where applicable, safe error mapping and `ok()`/`fail()` wrappers.

- [ ] **Step 2: Implement connection routes**

No provider secret is returned. Redirect URL may be returned only when required for OAuth flow and must be provider-generated/validated.

- [ ] **Step 3: Implement publication routes**

POST creates local job + event; GET reads local state; cancel/requested action follows domain rules.

- [ ] **Step 4: Verify and commit**

```bash
pnpm vitest run app/api/v1/content-os/distribution/**/route.test.ts app/api/v1/content-os/publications/**/route.test.ts
pnpm typecheck
pnpm lint
git add app/api/v1/content-os/distribution app/api/v1/content-os/publications
git commit -m "feat(content-os): expose distribution api"
```

---

### Task 7: Distribution E2E

**Files:**
- Create: `tests/e2e/content-os-distribution.spec.ts`
- Modify: `docs/testing/user-journey-map.md`

- [ ] **Step 1: Test connection journey**

Connect controlled/sandbox account → local connection becomes active → UI never displays provider API key.

- [ ] **Step 2: Test scheduled publication**

Create content → schedule → job progresses → published URL/remote ID is reconciled.

- [ ] **Step 3: Test duplicate protection**

Submit same operation twice with same idempotency key; prove one remote publication.

- [ ] **Step 4: Test provider outage and 429**

State becomes visible/retryable with `Retry-After`/backoff semantics; no false success.

- [ ] **Step 5: Test mobile approval/publish surface**

Critical actions remain reachable in mobile viewport.

- [ ] **Step 6: Final verification**

```bash
pnpm typecheck
pnpm lint
pnpm lint:channels
pnpm test:unit
pnpm test:db
pnpm test:e2e --grep "Content OS Distribution"
pnpm build
```

- [ ] **Step 7: Record external test limitations**

If a real social sandbox/account is unavailable, report that gap explicitly; mocks do not prove external publication.
