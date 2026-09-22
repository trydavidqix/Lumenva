# Maestri V3 VPS Graphiti Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar o Maestri V3 ao Graphiti/Neo4j que já existe na VPS, preservando o estado `OFF` até validação, sem reinstalar serviços, sem Docker novo e sem alterar `main` ou produção.

**Architecture:** A VPS já possui o sidecar `zepai/graphiti:0.22.0` e Neo4j Community no profile `ai-graph`, com comunicação interna pela rede `ai-graph-internal`. O Maestri V3 usará o adapter HTTP existente (`/healthcheck`, `/messages`, `/search`) e receberá configuração via `infisical run`, nunca via Git ou variáveis públicas. A feature continuará desligada até o round-trip sintético, isolamento de namespace, compliance e dashboard passarem.

**Tech Stack:** Graphiti REST, Neo4j Community, Infisical `prod`, TypeScript, Vitest, Core Runtime, Maestri Context Gateway, dashboard read-only.

**Spec:** `docs/LUMENVA_COMMAND_CENTER_PLAN.md`, `docs/runbooks/graphiti.md`, `docs/runbooks/ai-platform-secrets.md`, `docs/evidence/ai-platform/phase-4-graphiti-gate.md`

## Findings from the VPS documentation

- Graphiti and Neo4j were already restored on the VPS on 2026-09-05; the existing volume was preserved.
- The chosen backend is Neo4j Community, not FalkorDB; this is the documented free self-hosted decision.
- The six Graphiti variables were reconciled into Infisical project `DeskcommCRM - Lumenva`, environment `prod`.
- The documented internal URL is `http://graphiti:8000`; production must not publish Graphiti, Neo4j HTTP, or Bolt ports through Caddy.
- `GRAPHITI_API_KEY` is a shared app/sidecar secret in the contract, even though the current Graphiti image does not enforce that header; network isolation remains the actual boundary.
- Graphiti must remain `OFF` by default. `SHADOW` writes real tenant content to the sidecar and external LLM/embedder, so it requires a compliance decision before any real tenant is enabled.
- The existing documentation does not prove a current Maestri V3 round-trip against the live VPS runtime; that is the missing integration evidence.
- No approved external OTLP collector is documented in the VPS material; OTLP remains a separate optional gate.

## Global Constraints

- Não instalar Docker, Docker Desktop, Compose, Neo4j, FalkorDB ou Graphiti; verificar o runtime existente antes de qualquer ação.
- Não fazer merge, push para `main`, deploy ou alteração de flags de produção durante a implementação.
- Manter `GRAPHITI_MODE=off` fora do teste sintético aprovado; não ligar uma organização real em `shadow` automaticamente.
- Nunca imprimir, copiar para Git, enviar para logs ou incluir em prompts qualquer valor de secret.
- Não usar dados reais de CRM no round-trip; usar namespace temporário e episódio sintético sem PII.
- PostgreSQL/CRM continua sendo a fonte de verdade; Graphiti/Neo4j é projeção reconstruível e read-only para a dashboard.
- Toda falha de health, timeout, autenticação ou schema deve degradar para `NullKnowledgeGraph` sem quebrar o Core.

## Review Focus

- Drift entre Infisical, `.env` da VPS e nomes consumidos pelo Maestri; testar resolução sem expor valores na Task 1.
- Endpoint interno inacessível a partir do processo Maestri; testar health e timeout na Task 2.
- Header `X-Api-Key` aceito/ignorado pelo servidor atual; testar contrato e documentar a fronteira de rede na Task 2.
- Namespace de validação vazando para outro namespace; testar isolamento na Task 3.
- `SHADOW` confundido com “sem egress”; testar que a promoção exige aprovação de compliance na Task 4.

### Task 1: Reconciliar o contrato Maestri com o runtime VPS existente

**Files:**
- Inspect: `docs/runbooks/graphiti.md`
- Inspect: `docs/runbooks/ai-platform-secrets.md`
- Inspect: `docs/evidence/ai-platform/phase-4-graphiti-gate.md`
- Inspect: `packages/knowledge-graph/src/runtime.ts`
- Inspect: `packages/knowledge-graph/src/graphiti-http.ts`
- Modify: `docs/audits/maestri-v3-rollout-matrix-2026-09-22.md`
- Modify: `docs/LUMENVA_COMMAND_CENTER_PLAN.md`

**Interfaces:**
- Consumes: `GRAPHITI_BASE_URL`, `GRAPHITI_API_KEY`, `GRAPHITI_TIMEOUT_MS`, `GRAPHITI_LLM_*`, `GRAPHITI_EMBEDDER_MODEL` from Infisical `prod`.
- Produces: one canonical configuration table mapping the VPS contract to `createKnowledgeGraphFromEnv()` and a list of fields that must remain runtime-only.

- [x] **Step 1: Confirm the current checkout and competing work**

  Run `git status --short --branch`, `git branch --show-current`, and inspect active agents before editing. Expected: clean isolated `vps`; no active agent owns this same worktree.

- [x] **Step 2: Compare names without reading values**

  Compare only secret names from Infisical/GitHub and env names consumed by `runtime.ts`; do not run a command that prints secret values. Expected mapping: `GRAPHITI_BASE_URL` → `http://graphiti:8000` inside the compose network, `GRAPHITI_API_KEY` → adapter header, and the four sidecar provider settings remain sidecar-only.

- [x] **Step 3: Resolve mode vocabulary explicitly**

  Keep Maestri V3 modes `off`, `shadow`, and `on`. Treat the legacy CRM vocabulary `canary` as an external rollout policy, not as an unreviewed new mode in the V3 runtime. Document that no real tenant flag is changed by this plan.

- [x] **Step 4: Record the reconciliation**

  Add the mapping, current VPS evidence, and unresolved live round-trip gate to the audit and canonical plan. Run `git diff --check` and commit:

  ```powershell
  git add docs/audits/maestri-v3-rollout-matrix-2026-09-22.md docs/LUMENVA_COMMAND_CENTER_PLAN.md
  git commit -m "docs(graph): reconcile Maestri with VPS runtime"
  ```

**Task 1 result — 2026-09-22:** `RECONCILED / LIVE ROUND-TRIP PENDING`.
The local checkout is clean on `vps`; no competing agent owns this worktree;
the documented Infisical names match the Maestri adapter contract; V3 keeps
`off|shadow|on`; legacy `canary` remains external policy. The local Infisical
wrapper produced no usable version/help/session output, so no values were read
and no CLI was installed. The next gate requires access to the existing VPS
runtime or an authenticated names-only Infisical query.

### Task 2: Harden the Maestri Graphiti adapter for the existing service

**Files:**
- Modify: `packages/knowledge-graph/src/graphiti-http.ts` only when a contract test proves a mismatch
- Modify: `packages/knowledge-graph/src/runtime.ts` only when configuration mapping requires it
- Test: `packages/knowledge-graph/src/graph.test.ts`
- Test: `packages/knowledge-graph/src/graph-view.test.ts`

**Interfaces:**
- Consumes: `GraphitiHttpClient`, `KnowledgeGraph`, deterministic namespace strings, and the existing `X-Api-Key` contract.
- Produces: a bounded, timeout-controlled client that accepts the deployed Graphiti response shapes and fails closed.

- [ ] **Step 1: Write tests for the deployed wire contract**

  Cover `GET /healthcheck`, `POST /messages`, and `POST /search`; assert the request path, namespace/group ID, timeout, and that the API key never appears in thrown error text. Add a test for non-2xx and malformed JSON responses.

- [ ] **Step 2: Run the focused tests and observe RED**

  ```powershell
  pnpm --filter @lumenva/knowledge-graph test -- graph.test.ts
  ```

  Expected: any newly missing assertion fails for the real contract reason, not because of a test typo.

- [ ] **Step 3: Implement only the smallest adapter correction**

  Preserve `NullKnowledgeGraph`, the 2-second default timeout, deterministic group IDs, and no secret logging. Do not add a new provider, database driver, or public route.

- [ ] **Step 4: Run the package suite and typecheck**

  ```powershell
  pnpm --filter @lumenva/knowledge-graph test
  pnpm --filter @lumenva/knowledge-graph typecheck
  ```

  Expected: all tests pass with no live VPS dependency.

- [ ] **Step 5: Commit only if code changed**

  ```powershell
  git diff --check
  git add packages/knowledge-graph/src/graphiti-http.ts packages/knowledge-graph/src/runtime.ts packages/knowledge-graph/src/graph.test.ts packages/knowledge-graph/src/graph-view.test.ts
  git commit -m "fix(graph): align adapter with VPS Graphiti contract"
  ```

### Task 3: Validate the live VPS sidecar with synthetic data

**Files:**
- Inspect: `docs/runbooks/graphiti.md`
- Modify: `docs/audits/maestri-v3-rollout-matrix-2026-09-22.md`
- Modify: `docs/audits/maestri-v3-windows-bootstrap-2026-09-22.md`
- Test: `packages/knowledge-graph/src/graph.test.ts`

**Interfaces:**
- Consumes: existing VPS internal Graphiti URL and Infisical runtime injection.
- Produces: health evidence, one synthetic episode/search round-trip, namespace isolation evidence, and rollback evidence with the feature still `OFF`.

- [ ] **Step 1: Verify the existing VPS service before changing anything**

  On the VPS, inspect the exact compose project, profiles, service health, networks, and current feature flags. Do not run `up`, `pull`, `down`, `down -v`, volume deletion, or secret rotation. Expected: existing `graphiti` and `neo4j` services/volumes are identified before any request.

- [ ] **Step 2: Inject existing Infisical configuration ephemerally**

  Use the existing `infisical run -- <command>` path from the runbook. Do not copy values into `.env`, GitHub secrets, Windows environment, or chat. Confirm only variable names and masked endpoint host.

- [ ] **Step 3: Run health only**

  Call the internal `/healthcheck` with the configured timeout. Expected: success without changing feature flags or tenant state. If it fails, stop the live validation and retain `OFF`.

- [ ] **Step 4: Run one synthetic round-trip**

  Use namespace `lumenva:vps:maestri-validation:<run_id>` and a non-PII episode such as `Maestri validation fact: build 1 passed`. Post one episode, search it, then search a different namespace. Expected: the first query finds the fact and the second does not.

- [ ] **Step 5: Verify no production exposure**

  Confirm Graphiti/Neo4j have no public Caddy route or host port and that the feature/tenant flags remain unchanged. Do not enable `shadow` for a real organization.

- [ ] **Step 6: Persist evidence and commit documentation**

  Record only run ID, masked host, status codes, namespace hashes, latency, and flag state. Run `git diff --check` and commit:

  ```powershell
  git add docs/audits/maestri-v3-rollout-matrix-2026-09-22.md docs/audits/maestri-v3-windows-bootstrap-2026-09-22.md
  git commit -m "docs(graph): record VPS synthetic round-trip"
  ```

### Task 4: Wire live status into Core and dashboard without enabling tenant data flow

**Files:**
- Inspect: `apps/core/src/http-api.ts`
- Inspect: `apps/core/src/core-runtime.ts`
- Inspect: `packages/maestri-context-gateway/src/dashboard.mjs`
- Modify: only the smallest status/read-only endpoint needed
- Test: `apps/core/src/http-api.test.ts`
- Test: `packages/maestri-context-gateway/test/dashboard.test.mjs`

**Interfaces:**
- Consumes: Graphiti runtime status, health result, trace/evidence store, and existing read-only graph endpoint.
- Produces: dashboard fields showing `configured`, `health`, `mode`, `provider`, `last_probe`, and `fallback_reason` without exposing URL, API key, tenant data, or raw Graphiti errors.

- [ ] **Step 1: Write failing tests for masked status**

  Assert that the dashboard distinguishes `disabled`, `configured`, `healthy`, `unhealthy`, and `invalid_configuration`; assert that no URL, header, key, raw episode, or placeholder zero is emitted.

- [ ] **Step 2: Implement read-only status projection**

  Reuse the existing Core/MCG evidence stores. Do not make the dashboard call Graphiti directly, mutate flags, or trigger ingestion.

- [ ] **Step 3: Run Core and MCG suites**

  ```powershell
  pnpm --filter @lumenva/core test
  pnpm --filter @lumenva/core typecheck
  pnpm --filter @lumenva/maestri-context-gateway test
  ```

- [ ] **Step 4: Commit**

  ```powershell
  git diff --check
  git add apps/core packages/maestri-context-gateway
  git commit -m "feat(dashboard): expose masked Graphiti runtime status"
  ```

### Task 5: OTLP collector discovery as a separate optional gate

**Files:**
- Inspect: `apps/core/src/otlp-exporter.ts`
- Inspect: `docs/architecture/agent-os/observability.md`
- Modify: `docs/audits/maestri-v3-rollout-matrix-2026-09-22.md`
- Modify: `docs/LUMENVA_COMMAND_CENTER_PLAN.md`

**Interfaces:**
- Consumes: an already approved OTLP/HTTP collector, if one exists in the VPS provider inventory.
- Produces: a documented `not_configured` result when none exists, or a synthetic trace validation without replacing local persistence.

- [ ] **Step 1: Search provider inventory and secret names only**
- [ ] **Step 2: If no collector exists, record `OPTIONAL_NOT_CONFIGURED` and stop**
- [ ] **Step 3: If one exists, test one synthetic span and failure fallback**
- [ ] **Step 4: Never install a collector or expose credentials as part of Graphiti work**

## Final acceptance gate

The VPS integration is complete only when all are evidenced:

- Existing Graphiti/Neo4j runtime found; no duplicate installation.
- Infisical `prod` names map to the Maestri runtime without values in Git/logs.
- Health, synthetic round-trip, malformed response, timeout, and namespace isolation pass.
- Graphiti/Neo4j remain private; no Caddy/public port exposure.
- Real tenant flags remain unchanged and default `OFF` is preserved.
- Core/dashboard show masked status and local fallback behavior.
- OTLP is either verified against an existing collector or explicitly recorded as optional/unconfigured.
- `pnpm --filter @lumenva/knowledge-graph test`, Core tests/typecheck, MCG tests, `actionlint`, `git diff --check`, and rollout guard pass.
- `main` and production remain unchanged.
