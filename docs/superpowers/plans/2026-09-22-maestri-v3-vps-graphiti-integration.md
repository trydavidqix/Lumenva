# Maestri V3 VPS Graphiti Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar a integração operacional do Maestri V3 com o Graphiti/Neo4j já existente, sem instalar serviços, sem ativar tenants CRM e sem alterar `main` ou produção.

**Architecture:** A documentação e a auditoria anterior já comprovam o sidecar `zepai/graphiti:0.22.0`, Neo4j Community e a rede privada `ai-graph-internal`. O código V3 já contém adapter HTTP, runtime `OFF` por padrão, fallback nulo e Graph View read-only. Este plano cobre apenas lacunas V3: contrato de busca/health/erros do adapter, um round-trip sintético atual por caminho privado aprovado e status operacional mascarado na dashboard. A prova live histórica do CRM não será repetida como se fosse prova do adapter V3.

**Tech Stack:** Graphiti REST, Neo4j Community, Infisical `prod`, TypeScript, Vitest, Core Runtime, Maestri Context Gateway, dashboard read-only.

**Spec:** `docs/LUMENVA_COMMAND_CENTER_PLAN.md`, `docs/runbooks/graphiti.md`, `docs/runbooks/ai-platform-secrets.md`, `docs/evidence/ai-platform/phase-4-graphiti-gate.md`

## Findings from the VPS documentation

- Graphiti and Neo4j were already restored on the VPS on 2026-09-05; the existing volume was preserved.
- The chosen backend is Neo4j Community, not FalkorDB; this is the documented free self-hosted decision.
- The six Graphiti variables were reconciled into Infisical project `DeskcommCRM - Lumenva`, environment `prod`.
- The documented internal URL is `http://graphiti:8000`; production must not publish Graphiti, Neo4j HTTP, or Bolt ports through Caddy.
- `GRAPHITI_API_KEY` is a shared app/sidecar secret in the contract, even though the current Graphiti image does not enforce that header; network isolation remains the actual boundary.
- O restore/health do stack e o contrato Graphiti REST foram testados e documentados no runbook/evidence anteriores. Isso prova o stack e o adapter CRM daquela fase, não o adapter Maestri V3 atual.
- `GRAPHITI_MODE=off` continua sendo o default do runtime V3. Não usar `shadow` para testar: no CRM, a flag organizacional aceita `off|shadow|canary|on`, e `shadow` também grava conteúdo real e envia dados ao LLM/embedder configurado.
- A lacuna live é um round-trip atual do adapter V3 com dados sintéticos. O plano não presume que o processo V3 tenha rota de rede até `graphiti:8000`; o caminho privado de execução precisa ser confirmado antes da chamada.

## Global Constraints

- Não instalar Docker, Docker Desktop, Compose, Neo4j, FalkorDB ou Graphiti; verificar o runtime existente antes de qualquer ação.
- Não fazer merge para `main`, deploy ou alteração de flags de produção durante a implementação.
- Manter o default `GRAPHITI_MODE=off`; executar o probe V3 apenas no namespace sintético isolado da Task 3; não alterar flags de organização CRM.
- Nunca imprimir, copiar para Git, enviar para logs ou incluir em prompts qualquer valor de secret.
- Não usar dados reais de CRM no round-trip; usar namespace temporário e episódio sintético sem PII.
- PostgreSQL/CRM continua sendo a fonte de verdade; Graphiti/Neo4j é projeção reconstruível e read-only para a dashboard.
- Configuração ausente/inválida usa `NullKnowledgeGraph`. Falha de rede/schema durante uma chamada deve ser reportada como indisponível, com erro sanitizado e sem encerrar o Core; não afirmar que o client troca automaticamente para `NullKnowledgeGraph` em runtime.

## Review Focus

- Não assumir que `graphiti:8000` resolve fora da rede Docker privada; confirmar um caminho já existente antes do round-trip.
- O servidor Graphiti atual não aplica autenticação pelo header `X-Api-Key`; a rede interna é a fronteira efetiva. Não tratar o header como controle de acesso.
- O namespace sintético deve ser único, isolado e removido ao final; se a limpeza falhar, registrar o identificador e interromper novas tentativas.
- Não usar modos/flags do CRM como configuração do runtime V3. Nenhuma flag organizacional será alterada neste plano.

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
- Consumes: VPS runbooks and the checked-in V3 environment contract; no secret values.
- Produces: documented mapping from V3 runtime variables to the existing Infisical contract.

- [x] **Step 1: Confirm the current checkout and competing work**

  Run `git status --short --branch`, `git branch --show-current`, and inspect active agents before editing. Expected: clean isolated `vps`; no active agent owns this same worktree.

- [x] **Step 2: Compare documented names without reading values**

  Compare names recorded in the VPS runbooks with names consumed by `runtime.ts`; do not claim a fresh Infisical query. Expected mapping: `GRAPHITI_BASE_URL` → `http://graphiti:8000` inside the private network, `GRAPHITI_API_KEY` → adapter header, `GRAPHITI_TIMEOUT_MS` → V3 request timeout, and LLM/embedder/Neo4j credentials stay inside the service runtime. A live secret inventory is not needed to finish this documentation task.

- [x] **Step 3: Resolve mode vocabulary explicitly**

  Keep the V3 adapter modes `off`, `shadow`, and `on`. Separately, the CRM tenant feature flag supports `off`, `shadow`, `canary`, and `on`. Do not map one enum to the other or change any tenant flag as part of Maestri V3 integration.

- [x] **Step 4: Record the reconciliation**

  Add the mapping, current VPS evidence, and unresolved live round-trip gate to the audit and canonical plan. Run `git diff --check` and commit:

  ```powershell
  git add docs/audits/maestri-v3-rollout-matrix-2026-09-22.md docs/LUMENVA_COMMAND_CENTER_PLAN.md docs/superpowers/plans/2026-09-22-maestri-v3-vps-graphiti-integration.md
  git commit -m "docs(graph): reconcile Maestri with VPS runtime"
  ```

**Task 1 result — 2026-09-22:** `DOCUMENTED CONTRACT RECONCILED`.
The local checkout was clean on `vps`; no other active agent owned this
worktree. Runbooks and V3 source were compared without reading secret values.
The Infisical names are documented evidence, not a fresh live inventory. The
V3 adapter enum and CRM tenant enum are distinct. No local Infisical CLI was
installed to compensate for the unusable wrapper.

### Task 2: Harden the Maestri Graphiti adapter for the existing service

**Files:**
- Modify: `packages/knowledge-graph/src/graphiti-http.ts` only when a contract test proves a mismatch
- Modify: `packages/knowledge-graph/src/runtime.ts` only when configuration mapping requires it
- Test: `packages/knowledge-graph/src/graph.test.ts`
- Test: `packages/knowledge-graph/src/graph-view.test.ts`

**Interfaces:**
- Consumes: `GraphitiHttpClient`, `KnowledgeGraph`, deterministic namespace strings, and the existing `X-Api-Key` contract.
- Produces: a bounded, timeout-controlled client that accepts the deployed Graphiti response shapes and fails closed.

- [ ] **Step 1: Add only missing V3 adapter coverage**

  Existing `graph.test.ts` already covers `POST /messages`, namespace/group ID, and the `X-Api-Key` header. Add coverage only for `GET /healthcheck`, `POST /search`, timeout/network failure, non-2xx, malformed JSON, and secret redaction. Do not duplicate Graphiti server-contract tests already recorded in `phase-4-graphiti-gate.md`.

- [ ] **Step 2: Run the focused tests and observe RED**

  ```powershell
  pnpm --filter @lumenva/knowledge-graph test -- graph.test.ts
  ```

  Expected: tests establish Maestri adapter behavior without requiring a VPS connection.

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

### Task 3: Validate the current V3 adapter against the existing VPS sidecar

**Files:**
- Inspect: `docs/runbooks/graphiti.md`
- Modify: `docs/audits/maestri-v3-rollout-matrix-2026-09-22.md`
- Modify: this plan's progress ledger
- Test: `packages/knowledge-graph/src/graph.test.ts`

**Interfaces:**
- Consumes: existing VPS internal Graphiti URL and Infisical runtime injection.
- Produces: health evidence and one isolated synthetic episode/search round-trip through the current V3 adapter; tenant flags remain unchanged.

- [ ] **Step 1: Confirm an already-approved private execution path**

  Confirm whether Maestri V3 is already deployed on the VPS. No current evidence in this plan proves that it is. If it is not deployed, identify an approved way to run the exact V3 adapter from this `vps` checkout inside the existing private network while secrets remain in the VPS runtime. Do not substitute a hand-written HTTP probe; that would test Graphiti, not Maestri. Do not install, start, stop, recreate, or reconfigure services. If no such path exists, mark `BLOCKED_EXTERNAL_ACCESS` and stop before writing data.

- [ ] **Step 2: Inject existing Infisical configuration ephemerally**

  Use the existing secret injection mechanism only on the approved VPS execution path. Execute o probe como processo descartável, com `GRAPHITI_MODE=on` apenas no ambiente desse processo para atravessar o adapter; nunca persista esse modo em serviço ou organização. Não copie valores de secrets para `.env`, GitHub secrets, ambiente do Windows ou chat. Emita apenas indicadores configurado/ausente e host mascarado.

- [ ] **Step 3: Run health only**

  Call `/healthcheck` through the V3 adapter with its configured timeout. Expected: success without changing persistent runtime configuration or CRM tenant state. If it fails, stop the process before any write and record the provider as unavailable.

- [ ] **Step 4: Run one synthetic round-trip**

  Use a unique, non-tenant namespace and non-PII fact. Post and search through the V3 adapter, then query a second namespace and confirm it does not return the fact. This writes one synthetic episode and may invoke the configured LLM/embedder; record that external processing occurred. In `finally`, delete only the unique test group through the documented Graphiti group-delete route and verify deletion. If cleanup cannot be confirmed, stop and report the retained namespace.

- [ ] **Step 5: Verify no production exposure**

  Reuse the documented private-network/no-public-port evidence unless configuration changed. Keep this plan outside CRM: do not read or write organization feature flags, and do not enable CRM `shadow`, `canary`, or `on`.

- [ ] **Step 6: Persist evidence and commit documentation**

  Record only run ID, masked host, response status codes, namespace hashes, latency, cleanup result, process-scoped mode, and confirmation that no persistent settings changed. Run `git diff --check` and commit:

  ```powershell
  git add docs/audits/maestri-v3-rollout-matrix-2026-09-22.md docs/superpowers/plans/2026-09-22-maestri-v3-vps-graphiti-integration.md
  git commit -m "docs(graph): record VPS synthetic round-trip"
  ```

### Task 4: Add masked Graphiti operational status to the existing dashboard

**Files:**
- Inspect: `apps/core/src/http-api.ts`
- Inspect: `apps/core/src/core-runtime.ts`
- Inspect (produto MCG separado, versão fixada pela dependência Git do Core): `@lumenva/maestri-context-gateway/dashboard`
- Modify: only the smallest status/read-only endpoint needed
- Test: `apps/core/src/http-api.test.ts`
- Test (repo MCG separado): `C:\Users\David\Desktop\Projetos\maestri-context-gateway\test\dashboard.test.mjs`

**Interfaces:**
- Consumes: Graphiti runtime status, health result, trace/evidence store, and existing read-only graph endpoint.
- Produces: a small status view alongside the existing Graph View, showing configuration/health/mode/provider and safe fallback reason, with no URL, API key, tenant data, or raw provider error.

Existing work: Core `GET /graph`, dashboard `/api/graph`, Graph View and read-only fact/source drill-down already exist. Do not rebuild these routes, graph visualization, or evidence stores. Only add operational status if the fields are not already exposed by an existing endpoint.

- [ ] **Step 1: Write failing tests for masked status**

  Assert only the missing masked status fields and safe states. Reuse the existing `/api/graph` and Core contracts. Do not introduce placeholder values or expose URL, header, key, raw episode, or provider error text.

- [ ] **Step 2: Implement read-only status projection**

  Reuse Core and MCG. A health probe deve ser feita pelo Core com timeout e resultado seguro (`healthy`/`unhealthy`), sem chamada Graphiti direta da dashboard. Respostas de consulta Graphiti indisponível devem usar status `503` e código estável `GRAPH_UNAVAILABLE`, sem texto bruto do provider. Não mutar flags nem disparar ingestão.

- [ ] **Step 3: Run Core and MCG suites**

  ```powershell
  pnpm --filter @lumenva/core test
  pnpm --filter @lumenva/core typecheck
  npm --prefix "$env:USERPROFILE\Desktop\Projetos\maestri-context-gateway" test
  ```

- [ ] **Step 4: Commit**

  ```powershell
  git diff --check
  git add apps/core
  git commit -m "feat(dashboard): expose masked Graphiti runtime status"
  ```

  If the MCG dashboard itself changes, test and commit that repository separately; do not stage it from the Lumenva checkout.

## Final acceptance gate

The VPS integration is complete only when all are evidenced:

- Existing Graphiti/Neo4j runtime found; no duplicate installation.
- Documented Infisical `prod` names map to the Maestri runtime; live secret values never enter Git/logs.
- Health, synthetic round-trip, malformed response, timeout, and namespace isolation pass; runtime provider failures remain sanitized and do not terminate Core.
- Graphiti/Neo4j remain private; no Caddy/public port exposure.
- Real tenant flags remain unchanged and default `OFF` is preserved.
- Core/dashboard show masked status and local fallback behavior.
- Focused knowledge-graph/Core/MCG checks for changed work, `git diff --check`, and the existing rollout guard pass. `actionlint` is unrelated to this integration and is not a gate here.
- `main` and production remain unchanged.

## Progress ledger

- Task 1 — **complete**: documented contract reconciled; no fresh live secret inventory claimed.
- Task 2 — **not started**: only missing adapter tests and any evidenced minimal correction.
- Task 3 — **blocked pending safe VPS execution path**: historical service restore is documented; current V3 round-trip is not.
- Task 4 — **not started**: Graph View already exists; only masked health/config status remains in scope.
- OTLP — already has a local exporter; external collector configuration is separate observability/F25 work and excluded from this plan's completion percentage.

Completion is counted across the four Graphiti tasks: Task 1 complete = **25%**. Do not report an overall Maestri V3 percentage from this integration plan.
