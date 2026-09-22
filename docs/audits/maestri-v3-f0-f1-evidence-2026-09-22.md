# Evidência F0/F1 + M1 Core — Maestri V3

**Branch:** `vps`
**Commit da implementação:** `95c359c5` (contratos); adapter Codex segue no commit seguinte.
**Escopo:** contratos canônicos e eliminação de sucesso simulado nos adapters.

## Alterações

- `TaskContract` agora exige capabilities, risco, budgets, provider preferido e evidência requerida.
- `ExecutionResult` agora cobre summary, commands, tests, evidence, usage, context e erro estruturado.
- `ExecutionPort` agora define `execute`, `resume`, `cancel`, `health`, `capabilities`, `usage` e `quota`.
- Codex e Antigravity não retornam mais `success` sem execução; retornam `unavailable` com `provider_unavailable`.
- Codex possui runner oficial via `@openai/codex-sdk`; o runner é injetável em testes e só aceita `ExecutionResult` estruturado.
- O health probe Codex verifica `codex --version` e `codex login status`; capabilities declaradas são `execute`, `structured_output` e `read_only`.
- Testes de integração Postgres são pulados quando Docker/daemon não existem; Docker não foi instalado.

## Claude adapter validation

The existing authenticated Claude CLI was used; no duplicate installation was performed.

```text
pnpm --dir packages/operating-core exec vitest run src/cloud-fabric/claude-adapter.test.ts
pnpm --dir packages/operating-core test
pnpm --dir packages/operating-core typecheck
pnpm --dir apps/core exec tsc --noEmit
```

Results: Claude adapter 2/2 passed; operating-core 13 passed and 2 Docker-dependent tests skipped; package and Core typechecks passed.

Antigravity remains unavailable by design: the installed application has no runnable CLI/SDK entrypoint in this runtime. The adapter contract test verifies `unavailable` status and empty capabilities; no installation was duplicated.

## F12 usage/quota validation

- Codex SDK types expose `turn.usage` with `input_tokens`, `cached_input_tokens`, `output_tokens`, and reasoning tokens. The adapter now maps the exact provider values and execution duration into `UsageSnapshot`.
- Claude CLI was probed with the existing authenticated installation using read-only planning flags. Its JSON result exposed `usage`, `total_cost_usd`, and `duration_ms`; the adapter maps input, cache creation/read, output, cost, and duration.
- Windows executable probes use the audited binaries `codex.exe` and `claude.exe`; both version/auth checks passed on 2026-09-22.
- The authenticated CLIs expose no local official quota command: `codex --help` exposes login/doctor but no quota command, and `claude auth status --json` exposes authentication/subscription metadata but no remaining quota.
- Therefore `quota()` remains explicitly unavailable rather than returning fabricated capacity. This is a known F12 partial gate, not a hidden estimate.

Focused provider usage tests: 8/8 passed. Package and Core typechecks passed.

## F13 Resource Router validation

- `QuotaRouter` now requires healthy status, required capabilities, and a positive verified quota.
- `ResourceRouter` considers Codex, Claude, and Antigravity according to risk, but never attaches a provider whose quota is unavailable.
- When no provider is proven executable, the returned fallback contains `reason: no_healthy_provider_with_verified_quota` and no adapter.
- Resource Router tests: 3/3 passed; full operating-core suite: 20 passed, 2 Docker-dependent tests skipped.

## F14/F15 contract validation

- `HandoffRequest` is deterministic, bounded, explicitly brokered by `maestri`, and excludes session transcripts.
- `ResultDigest` is derived from `ExecutionResult` and excludes commands/full logs from the downstream payload.
- Contract tests passed; full operating-core suite reached 23 passed and 2 Docker-dependent tests skipped.

## F16 delegation validation

`MaestriDelegator` enforces `broker: maestri`, routes through `ResourceRouter`, resolves context before execution, and returns a `ResultDigest`. Direct agent-to-agent requests are rejected. Delegation tests: 2/2 passed; full operating-core suite: 25 passed and 2 Docker-dependent tests skipped.

## F19 trace propagation validation

- MCP rejects malformed W3C `traceparent` values.
- Valid trace context is forwarded to the MCP server and persisted on the MCG `mcp.catalog` span.
- Core MCP/trace tests: 5/5 passed; MCG regression suite: 36/36 passed.
- External OpenTelemetry export is still pending; local trace provenance is exact and persisted.

## F20/F21 dashboard usage validation

The read-only `Executions` view now aggregates exact `ExecutionResult.usage` values from Core: input, cached, output, duration, and cost. Without provider usage it returns `UNAVAILABLE` instead of synthetic zeros. Focused dashboard tests: 14/14 passed.

## F24 benchmark evidence

Suite `suite-1790091180340-8e6276c6` ran 20 paired cases / 40 real Codex CLI read-only executions from `validation.jsonl`.

- Baseline success: 100%.
- Fabric success: 100%.
- Context recall: 100%.
- Evidence grounding: 100%.
- Hallucination rate: 0%.
- Exact token reduction: 7.81%.
- Trust: `VALIDATING` (20/30 minimum paired cases).

Raw benchmark state is isolated under `.lumenva-benchmark-state`; it is not production state and does not modify `main`.

Final aggregate after 30 paired cases:

- Baseline: `916321` exact tokens.
- Fabric: `968573` exact tokens.
- Token delta: `-5.70%` (regression; Fabric used more tokens).
- Context tokens reconstructed from existing raw JSONL: baseline `1662140`, Fabric `1786750`; delta `-7.50%`.
- Task success/recall/grounding: `100%`; hallucination: `0%`.
- Trust: `DEGRADED`; quality-preserving savings not approved.

This evidence advances the plan but does not pass F24. F22 must reduce redundant context without reducing quality before re-running the benchmark.

F22 first optimization increment: the MCG compiler deduplicates identical fragments before budget selection, retaining the highest-priority item deterministically. MCG regression suite remained 36/36 green. End-to-end benchmark impact is not yet claimed.

The evaluation contract now reports `context_tokens` separately from `total_tokens`. Legacy paired records are hydrated from their already-persisted raw Codex JSONL evidence; no benchmark task was rerun. The measured result remains negative in both views, so this change improves attribution but does not pass F22/F24.

F22 increment after the benchmark: Core now removes identical candidate content before progressive L1/L2 expansion, selecting the highest score and using the path as deterministic tie-breaker. Core validation passed with 38/38 tests and TypeScript typecheck. The homogeneous v2 benchmark below supplies the end-to-end savings evidence.

F17/F18 bridge increment: `packages/operating-core` now defines the canonical snake_case `ContextPacket`; `apps/core` maps its progressive packet through deterministic `toDelegationContext`, and `MaestriDelegator` accepts the typed packet. Core context tests passed 8/8, delegator tests 2/2, and Core typecheck passed. The final provider execution wiring is still pending.

F19 increment: `apps/core` now provides an optional native-fetch OTLP/HTTP exporter. It emits canonical OTLP JSON spans with normalized 32/16-hex IDs, preserves local MCG trace storage, and counts export failures. Core validation passed 42/42 tests and typecheck; no external collector was installed or started.

Provider wiring increment: `TaskContract.context_packet` is now the canonical handoff field. `MaestriDelegator` injects the resolved packet before execution; Codex and Claude runners receive it through their existing serialized contract path. Operating-core validation passed 26 tests, with 2 Docker-dependent tests skipped, and typecheck passed.

The homogeneous v2 dataset was completed with 30 unique pairs, using offset execution so no earlier case was repeated: baseline `1171978` versus Fabric `842666` total tokens (`28.10%` reduction), and baseline `2128743` versus Fabric `1593713` context tokens (`25.13%` reduction). Quality stayed at 100% for success, recall, and grounding with 0% hallucination. Trust is `VALIDATED` with score `81.28`.

## Comandos e resultado

```text
pnpm --filter @lumenva/operating-core test
Test Files: 3 passed, 2 skipped
Tests: 10 passed, 2 skipped

pnpm --filter @lumenva/operating-core typecheck
PASS

pnpm --filter @lumenva/operating-core test -- src/cloud-fabric/execution-port.test.ts
Tests: 4 passed

## Prova real do provider

Runner read-only do `@openai/codex-sdk` executado no worktree `vps` com sandbox read-only, aprovação `never`, rede desabilitada e web search desabilitado:

```json
{"status":"ok","branch":"vps","clean":true,"summary":"Working tree is clean."}
```

Nenhum arquivo foi alterado pela prova.

## Persistência de execução

- SQLite agora possui a tabela `executions` na mesma fonte de estado do Core.
- `CoreRuntime.recordExecutionResult()` persiste o `ExecutionResult` e publica `execution.recorded`.
- `CoreRuntime.execution()` permite leitura posterior do resultado persistido.
- `apps/core` passou `core-runtime` + `sqlite-store`: 4/4 testes; typecheck PASS.
- API loopback expõe `GET /executions/:id` em modo read-only; TDD observado RED 404 → GREEN 200.
- Suíte final de `apps/core`: 15 arquivos, 36 testes PASS; typecheck PASS.
- Core também expõe `GET /executions`; MCG consome apenas URL loopback configurada em `LUMENVA_CORE_URL`.
- Dashboard adicionou a view read-only `Executions`; MCG passou 36/36 testes.

pnpm --filter @lumenva/core test
Test Files: 15 passed
Tests: 33 passed

pnpm --filter @lumenva/core typecheck
PASS

pnpm --filter @lumenva/maestri-context-gateway test
Tests: 34 passed, 0 failed
```

Os dois testes pulados dependem de Postgres em Docker; isso é esperado e documentado pela restrição do Owner. Nenhuma chamada externa de provider foi simulada como sucesso.
