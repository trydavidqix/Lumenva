# Maestri V3 First Three External Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validar os três primeiros gates externos restantes da Maestri V3 sem Docker, sem duplicar instalações/agentes e sem alterar `main` ou produção.

**Architecture:** Usaremos os workflows manuais já existentes como validação controlada em `vps`; o Core continuará com Graphiti `OFF` até um endpoint remoto real passar health/read/write controlados; o exporter OTLP continuará opcional e só será ativado após um collector HTTPS existente responder com sucesso. Nenhum segredo será gravado no repositório.

**Tech Stack:** GitHub Actions, `openai/codex-action@v1`, `google-labs-code/jules-invoke@v1`, `@lumenva/knowledge-graph`, `OtlpHttpExporter`, PowerShell, pnpm, GitHub Secrets.

**Spec:** `docs/LUMENVA_COMMAND_CENTER_PLAN.md` and `docs/MAESTRI_AGENT_ARCHITECTURE.md`

## Global Constraints

- Trabalhar somente na branch `vps` e no worktree isolado; nunca fazer merge, push para `main` ou deploy de produção.
- Não instalar Docker, Docker Desktop, Compose ou outro runtime duplicado.
- Antes de qualquer instalação/configuração, verificar se já existe processo, serviço, endpoint, secret ou agente equivalente.
- Não imprimir, salvar ou versionar valores de `JULES_API_KEY`, `OPENAI_API_KEY`, `GRAPHITI_API_KEY` ou headers OTLP.
- Graphiti permanece `OFF` se o endpoint não passar health e teste de isolamento; OTLP permanece desligado se não houver collector autorizado.
- Toda alteração de código/documentação deve ter teste, `git diff --check` e commit pequeno.

## Review Focus

- Secret ausente: workflow deve falhar de forma explícita sem vazar valor; cobrir no Task 1.
- Ref diferente de `vps`: workflow não deve executar; cobrir no Task 1.
- Graphiti indisponível ou resposta inválida: runtime deve degradar sem derrubar o Core; cobrir no Task 2.
- Namespace incorreto: Graphiti não pode misturar tenants/projetos; cobrir no Task 2.
- Collector OTLP indisponível ou retorna erro: trace local deve continuar persistido; cobrir no Task 3.

### Task 1: Validar GitHub Actions reais para Jules e Codex

**Files:**
- Inspect: `.github/workflows/maestri-v3-jules-manual.yml`
- Inspect: `.github/workflows/maestri-v3-codex-manual.yml`
- Modify: `docs/audits/maestri-v3-windows-bootstrap-2026-09-22.md`
- Modify: `docs/LUMENVA_COMMAND_CENTER_PLAN.md`
- Test: `.github/workflows/maestri-v3-jules-manual.yml` and `.github/workflows/maestri-v3-codex-manual.yml` with `actionlint`

**Interfaces:**
- Consumes: existing `JULES_API_KEY` secret, optional `OPENAI_API_KEY` secret, branch `vps`.
- Produces: one Jules evidence run and one Codex evidence run, or a documented external block if `OPENAI_API_KEY` is absent.

- [ ] **Step 1: Confirm no duplicate workflow or competing agent**

  Run:

  ```powershell
  git branch --show-current
  git status --short --branch
  gh workflow list --repo trydavidqix/Lumenva
  gh secret list --repo trydavidqix/Lumenva
  ```

  Expected: branch `vps`, clean worktree, exactly one Maestri V3 Jules workflow and one Maestri V3 Codex workflow, `JULES_API_KEY` present, and no value printed.

- [ ] **Step 2: Validate workflow syntax before dispatch**

  Run:

  ```powershell
  actionlint .github/workflows/maestri-v3-jules-manual.yml .github/workflows/maestri-v3-codex-manual.yml
  ```

  Expected: exit code `0`.

- [ ] **Step 3: Dispatch Jules only on `vps`**

  Run:

  ```powershell
  gh workflow run maestri-v3-jules-manual.yml --repo trydavidqix/Lumenva --ref vps
  gh run list --repo trydavidqix/Lumenva --workflow maestri-v3-jules-manual.yml --branch vps --limit 1
  gh run watch <RUN_ID> --repo trydavidqix/Lumenva --exit-status
  ```

  Expected: Jules completes a read-only audit, reports evidence, creates no commit, and touches no `main` or production.

- [ ] **Step 4: Decide Codex credential gate without inventing a key**

  If `gh secret list` shows `OPENAI_API_KEY`, dispatch:

  ```powershell
  gh workflow run maestri-v3-codex-manual.yml --repo trydavidqix/Lumenva --ref vps
  gh run list --repo trydavidqix/Lumenva --workflow maestri-v3-codex-manual.yml --branch vps --limit 1
  gh run watch <RUN_ID> --repo trydavidqix/Lumenva --exit-status
  ```

  If it is absent, do not create one automatically. Record Codex as `BLOCKED_EXTERNAL_SECRET`, because the workflow correctly requires `OPENAI_API_KEY`.

- [ ] **Step 5: Persist evidence and commit**

  Record run IDs, status, ref, actor, permissions, and conclusion without secrets in the two audit documents. Run `git diff --check`, then:

  ```powershell
  git add docs/audits/maestri-v3-windows-bootstrap-2026-09-22.md docs/LUMENVA_COMMAND_CENTER_PLAN.md
  git commit -m "docs(actions): record vps workflow validation"
  ```

### Task 2: Ativar Graphiti remoto sem Docker

**Files:**
- Inspect: `packages/knowledge-graph/src/runtime.ts`
- Inspect: `packages/knowledge-graph/src/graphiti-http.ts`
- Modify: `packages/knowledge-graph/src/graph.test.ts` only if a missing contract test is found
- Modify: `docs/audits/maestri-v3-rollout-matrix-2026-09-22.md`
- Modify: `docs/LUMENVA_COMMAND_CENTER_PLAN.md`

**Interfaces:**
- Consumes: `GRAPHITI_MODE`, `GRAPHITI_BASE_URL`, `GRAPHITI_API_KEY`, `GRAPHITI_TIMEOUT_MS`.
- Produces: configured Graphiti runtime status, health evidence, isolated namespace evidence, and a reversible `shadow`/`on` activation procedure.

- [ ] **Step 1: Verify an existing endpoint before selecting a provider**

  Check the VPS/provider inventory and existing secrets using the approved provider console or CLI. Do not install Docker or a second Graphiti/FalkorDB/Neo4j instance. The endpoint must expose the adapter paths `/healthcheck`, `/messages`, and `/search`.

- [ ] **Step 2: Test the endpoint without exposing the API key**

  Set credentials only in the process/session environment. Run a health probe with `GRAPHITI_TIMEOUT_MS=2000`. Expected: HTTPS endpoint returns success within timeout; any DNS, TLS, auth, or schema failure leaves `GRAPHITI_MODE=off`.

- [ ] **Step 3: Run the existing package tests**

  ```powershell
  pnpm --filter @lumenva/knowledge-graph test
  pnpm --filter @lumenva/knowledge-graph typecheck
  pnpm --filter @lumenva/core test
  pnpm --filter @lumenva/core typecheck
  ```

  Expected: all pass with no test depending on a live remote service.

- [ ] **Step 4: Validate shadow ingestion and namespace isolation**

  Start with `GRAPHITI_MODE=shadow`, publish one synthetic non-production episode with namespace `lumenva:vps:maestri-validation`, search that same namespace, and verify another namespace returns no result. Do not send CRM/customer data.

- [ ] **Step 5: Promote only after evidence and commit**

  Keep `shadow` as the first rollout state. Promote to `on` only after health, ingestion, search, timeout, and isolation evidence is recorded. Store only variable names and endpoint hostname in docs, never the key. Run `git diff --check` and commit:

  ```powershell
  git add docs/audits/maestri-v3-rollout-matrix-2026-09-22.md docs/LUMENVA_COMMAND_CENTER_PLAN.md packages/knowledge-graph/src/graph.test.ts
  git commit -m "docs(graph): record remote Graphiti rollout gate"
  ```

### Task 3: Conectar collector OTLP opcional

**Files:**
- Inspect: `apps/core/src/otlp-exporter.ts`
- Inspect: `apps/core/src/telemetry-sink.ts`
- Inspect: `apps/core/src/trace-sink.ts`
- Modify: `apps/core/src/telemetry-sink.test.ts` only if a missing failure-preservation test is found
- Modify: `docs/audits/maestri-v3-rollout-matrix-2026-09-22.md`
- Modify: `docs/LUMENVA_COMMAND_CENTER_PLAN.md`

**Interfaces:**
- Consumes: existing `OtlpHttpExporter` endpoint, optional OTLP headers, service name, and locally persisted spans.
- Produces: collector acceptance evidence while preserving local traces if export fails.

- [ ] **Step 1: Verify an existing collector before creating anything**

  Inventory the approved OTLP provider/collector and confirm the exact OTLP/HTTP JSON endpoint, TLS requirement, auth header name, retention, and workspace. Do not install a collector locally unless explicitly authorized; do not duplicate an existing one.

- [ ] **Step 2: Send a synthetic non-production span**

  Use a temporary process environment with a unique service name such as `lumenva-maestri-v3-vps-validation`. Send one span containing only task/job IDs designed for validation. Expected: HTTP `2xx`; no secret or customer payload in attributes.

- [ ] **Step 3: Prove local persistence survives collector failure**

  Run the existing Core telemetry tests and a controlled request against an unavailable endpoint. Expected: exporter records failure, Core keeps the local trace/span, and the request does not become successful merely because export succeeded.

- [ ] **Step 4: Verify trace correlation**

  Confirm the collector receives `trace_id`, `span_id`, parent relationship, service name, provider, and status; compare with the local trace store. Do not treat an accepted HTTP response as proof of semantic correctness until the span is visible in the collector.

- [ ] **Step 5: Record configuration and commit**

  Document endpoint class, auth method, service name, retention, last successful probe, and failure behavior without values of secrets. Run:

  ```powershell
  pnpm --filter @lumenva/core test
  pnpm --filter @lumenva/core typecheck
  git diff --check
  git add docs/audits/maestri-v3-rollout-matrix-2026-09-22.md docs/LUMENVA_COMMAND_CENTER_PLAN.md apps/core/src/telemetry-sink.test.ts
  git commit -m "docs(telemetry): record OTLP collector rollout gate"
  ```

## Final Gate

After the three tasks, run:

```powershell
git status --short --branch
git diff main...vps --stat
pnpm --filter @lumenva/knowledge-graph test
pnpm --filter @lumenva/core test
pnpm --filter @lumenva/maestri-context-gateway test
pnpm --filter @lumenva/maestri-context-gateway check:rollout
```

Expected final state: clean `vps`, no changes to `main`, local tests green, Jules evidence present, Codex either green or explicitly blocked by missing `OPENAI_API_KEY`, Graphiti either safely `shadow`/`on` with isolation evidence or safely `off`, and OTLP either verified or safely optional with local traces intact.

## Self-review

- Covered the three first pending external gates from the canonical plan.
- No step installs Docker or assumes an unverified provider.
- Secrets are referenced by name only and never printed.
- Every external activation has a reversible safe fallback.
- Gemini/Antigravity remains outside these three gates because its current blocker is a Google product license, not a missing Maestri code path.
