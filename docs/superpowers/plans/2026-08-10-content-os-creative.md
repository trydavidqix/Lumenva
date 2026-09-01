# Content OS Creative Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o Creative Studio do Content OS com jobs locais, ComfyUI como rendering worker privado, Storage canónico e um Video Composer inicialmente derivado do MoneyPrinterTurbo.

**Architecture:** O Content OS cria `creative_jobs`, submete trabalho através de `CreativeProvider`/`VideoComposer`, reconcilia o estado externo e persiste outputs finais em `content_assets`. ComfyUI e Composer não são fontes de verdade nem superfícies públicas.

**Tech Stack:** TypeScript 6, Supabase Storage/Postgres, workers/event_log, HTTP/WebSocket server-to-server, ComfyUI privado, FFmpeg/serviço Python para composição, Vitest, Playwright.

## Global Constraints

- Foundation concluída.
- `CreativeProvider` e `VideoComposer` não mudam localmente.
- ComfyUI Manager/UI não é público.
- Custom nodes apenas allowlist/versionados.
- Browser não recebe URL privada de worker nem provider secret.
- Outputs finais são copiados para Storage do CRM.
- Job local é a autoridade; provider job ID é referência técnica.

---

## File structure

**Create**
- `lib/content-os/creative/job-service.ts`
- `lib/content-os/creative/asset-service.ts`
- `lib/content-os/creative/workflows.ts`
- `lib/content-os/providers/comfy/client.ts`
- `lib/content-os/providers/comfy/provider.ts`
- `lib/content-os/providers/video-composer/client.ts`
- `lib/content-os/providers/video-composer/provider.ts`
- `workers/content-os-creative-worker/main.ts`
- `app/api/v1/content-os/creative/jobs/route.ts`
- `app/api/v1/content-os/creative/jobs/[id]/route.ts`
- `app/api/v1/content-os/assets/route.ts`
- `tests/unit/content-os-creative-jobs.test.ts`
- `tests/unit/content-os-comfy-provider.test.ts`
- `tests/unit/content-os-video-composer.test.ts`
- `tests/e2e/content-os-creative.spec.ts`
- `services/video-composer/README.md`

**Modify**
- `.env.example`
- `lib/env.ts`
- deploy compose only when adding private services to the established self-host topology.

---

### Task 1: Creative job service

**Files:**
- Create: `lib/content-os/creative/job-service.ts`
- Test: `tests/unit/content-os-creative-jobs.test.ts`

**Interfaces:**
- Consumes: canonical job state machine.
- Produces: create/get/cancel/reconcile operations for `creative_jobs`.

- [ ] **Step 1: Write failing tests**

Cover create with idempotency key, same key/same payload reuse, same key/different payload conflict, legal/illegal state transition and tenant isolation.

- [ ] **Step 2: Run RED**

```bash
pnpm vitest run tests/unit/content-os-creative-jobs.test.ts
```

- [ ] **Step 3: Implement job creation through repository/service boundary**

Persist local job before provider side effect. Store provider, operation, request hash, idempotency key, state and provider job ref separately.

- [ ] **Step 4: Implement cancellation semantics**

Local `cancel_requested_at`/state transition happens through domain rules; provider cancellation is worker-owned side effect.

- [ ] **Step 5: Verify and commit**

```bash
pnpm vitest run tests/unit/content-os-creative-jobs.test.ts
pnpm typecheck
git add lib/content-os/creative/job-service.ts tests/unit/content-os-creative-jobs.test.ts
git commit -m "feat(content-os): add creative job service"
```

---

### Task 2: Asset service and Storage ownership

**Files:**
- Create: `lib/content-os/creative/asset-service.ts`
- Create: `tests/unit/content-os-assets.test.ts`

**Interfaces:**
- Produces: safe registration/copy of generated output into `content_assets`.

- [ ] **Step 1: Write failing tests**

Cover tenant path scoping, content type allowlist, external URL rejection for private/local ranges, file size limit and no provider URL persisted as final asset authority.

- [ ] **Step 2: Implement canonical Storage key**

```ts
export function contentAssetObjectKey(input: {
  organizationId: string;
  assetId: string;
  extension: string;
}) {
  return `content-os/${input.organizationId}/${input.assetId}.${input.extension}`;
}
```

- [ ] **Step 3: Implement metadata persistence**

Persist checksum, MIME, bytes, storage bucket/key, origin provider and local job ID. Do not persist provider secrets or temporary signed URLs as durable identifiers.

- [ ] **Step 4: Verify and commit**

```bash
pnpm vitest run tests/unit/content-os-assets.test.ts
pnpm typecheck
git add lib/content-os/creative/asset-service.ts tests/unit/content-os-assets.test.ts
git commit -m "feat(content-os): own generated assets in storage"
```

---

### Task 3: ComfyUI client/provider

**Files:**
- Create: `lib/content-os/providers/comfy/client.ts`
- Create: `lib/content-os/providers/comfy/provider.ts`
- Create: `lib/content-os/creative/workflows.ts`
- Test: `tests/unit/content-os-comfy-provider.test.ts`
- Modify: `.env.example`
- Modify: `lib/env.ts`

**Interfaces:**
- Implements: `CreativeProvider` as provider `comfy`.

- [ ] **Step 1: Write failing contract tests**

Cover submit `/prompt`, status/history mapping, cancel, timeout and non-2xx failure. Assert no browser-facing response exposes `CONTENT_OS_COMFY_BASE_URL`.

- [ ] **Step 2: Add private env contract**

Define server-only `CONTENT_OS_COMFY_BASE_URL`; bind worker networking so the service is not publicly routed.

- [ ] **Step 3: Define workflow catalogue**

`workflows.ts` maps product workflow IDs to versioned Comfy workflow JSON/template builders. User cannot submit arbitrary node graphs in V1.

- [ ] **Step 4: Implement provider**

`generate()` translates approved workflow + parameters to provider payload and returns `ProviderJobRef` only.

- [ ] **Step 5: Verify and commit**

```bash
pnpm vitest run tests/unit/content-os-comfy-provider.test.ts
pnpm typecheck
pnpm lint
git add lib/content-os/providers/comfy lib/content-os/creative/workflows.ts tests/unit/content-os-comfy-provider.test.ts .env.example lib/env.ts
git commit -m "feat(content-os): add comfy creative provider"
```

---

### Task 4: Creative worker + reconciliation

**Files:**
- Create: `workers/content-os-creative-worker/main.ts`
- Create: `tests/unit/content-os-creative-worker.test.ts`

**Interfaces:**
- Consumes: `content.asset.requested`, provider registry.
- Produces: job transitions, canonical assets, `content.asset.ready`.

- [ ] **Step 1: Write failing worker tests**

Cover queued→running→succeeded, provider fail, network timeout, stale running job reconciliation, cancel request and duplicate event.

- [ ] **Step 2: Implement existing `event_log` claim pattern**

Do not create a second queue. Side effect runs only after local job exists.

- [ ] **Step 3: Implement output ingest**

On provider success, copy output into Storage, create `content_assets`, associate `creative_job_assets`, then mark job succeeded.

- [ ] **Step 4: Implement restart reconciliation**

Running jobs with provider ref are polled/reconciled; absence of response does not silently mark success.

- [ ] **Step 5: Verify and commit**

```bash
pnpm vitest run tests/unit/content-os-creative-worker.test.ts
pnpm typecheck
pnpm lint
git add workers/content-os-creative-worker tests/unit/content-os-creative-worker.test.ts
git commit -m "feat(content-os): add creative job worker"
```

---

### Task 5: Video Composer service boundary

**Files:**
- Create: `services/video-composer/README.md`
- Create: `lib/content-os/providers/video-composer/client.ts`
- Create: `lib/content-os/providers/video-composer/provider.ts`
- Test: `tests/unit/content-os-video-composer.test.ts`

**Interfaces:**
- Implements: `VideoComposer` as provider `mpt-composer` initially.

- [ ] **Step 1: Document service contract before copying code**

`services/video-composer/README.md` must define only these operations:

```text
POST /v1/jobs
GET  /v1/jobs/{id}
POST /v1/jobs/{id}/cancel
GET  /health
```

Request receives structured script/assets/format references; response contains job ID/state/output descriptor. No global provider configuration is writable through public API.

- [ ] **Step 2: Record MIT notice policy**

The service README must require preservation of MoneyPrinterTurbo copyright/license notices for copied substantial portions.

- [ ] **Step 3: Write adapter tests first**

Cover compose/status/cancel and mapping to `ProviderJobRef`.

- [ ] **Step 4: Implement TypeScript client/provider boundary**

Do not couple CRM domain code to MPT internals.

- [ ] **Step 5: Verify and commit**

```bash
pnpm vitest run tests/unit/content-os-video-composer.test.ts
pnpm typecheck
git add services/video-composer/README.md lib/content-os/providers/video-composer tests/unit/content-os-video-composer.test.ts
git commit -m "feat(content-os): define video composer boundary"
```

---

### Task 6: Hardened composer implementation

**Files:**
- Create under: `services/video-composer/` according to the extracted Python modules required by the documented API.
- Test under: `services/video-composer/tests/`.

**Interfaces:**
- Consumes: explicit job payload from Task 5.
- Produces: local output file/descriptor only.

- [ ] **Step 1: Extract minimal composition path**

Port only material retrieval needed by V1, TTS adapter, subtitle generation and FFmpeg composition. Do not port Streamlit UI, provider configuration UI or unrelated publishing code.

- [ ] **Step 2: Add authentication at the private service boundary**

Require a server-to-server bearer/header secret validated before job creation; secret never appears in query string/log.

- [ ] **Step 3: Bound concurrency and queue**

Reject over-capacity with 429/typed error rather than unbounded thread creation.

- [ ] **Step 4: Add path/file validation**

Resolve every input/output inside approved job directories; reject traversal and unsupported MIME/extension.

- [ ] **Step 5: Run service tests**

Use the service's own Python test runner and record exact command/result in the implementation handoff. Do not claim the service green from TypeScript tests alone.

- [ ] **Step 6: Commit extracted service separately**

Commit message:

```text
feat(content-os): add hardened video composer service
```

---

### Task 7: Creative API

**Files:**
- Create: `app/api/v1/content-os/creative/jobs/route.ts`
- Create: `app/api/v1/content-os/creative/jobs/[id]/route.ts`
- Create: `app/api/v1/content-os/assets/route.ts`
- Create matching `route.test.ts` files.

**Interfaces:**
- Produces: authenticated product API.

- [ ] **Step 1: Write route tests**

Cover auth, RBAC, idempotency, invalid workflow, tenant isolation, cancel and pagination.

- [ ] **Step 2: Implement create job route**

Handler validates Zod payload, resolves tenant from auth, persists local job and appends event. It never calls Comfy/MPT inline.

- [ ] **Step 3: Implement status/cancel/assets routes**

Return local normalised states and Storage-backed asset metadata only.

- [ ] **Step 4: Verify and commit**

```bash
pnpm vitest run app/api/v1/content-os/creative/**/route.test.ts app/api/v1/content-os/assets/route.test.ts
pnpm typecheck
pnpm lint
git add app/api/v1/content-os/creative app/api/v1/content-os/assets
git commit -m "feat(content-os): expose creative api"
```

---

### Task 8: Creative E2E and failure proof

**Files:**
- Create: `tests/e2e/content-os-creative.spec.ts`
- Modify: `docs/testing/user-journey-map.md`

- [ ] **Step 1: Test image generation journey**

Request → queued → running → ready → asset preview/download from canonical Storage.

- [ ] **Step 2: Test video composition journey**

Approved script/assets → compose → output asset.

- [ ] **Step 3: Test provider outage**

Provider unavailable must produce visible retry/failed state, never infinite spinner or false success.

- [ ] **Step 4: Test mobile status/approval surface**

Critical creative job state remains readable/retryable on mobile viewport.

- [ ] **Step 5: Final gate**

```bash
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm test:db
pnpm test:e2e --grep "Content OS Creative"
pnpm build
```

Expected: all applicable checks pass with fresh evidence; Python composer tests are reported independently.
