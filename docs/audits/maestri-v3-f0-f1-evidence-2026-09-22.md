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
- The authenticated CLIs expose no local official quota command: `codex --help` exposes login/doctor but no quota command, and `claude auth status --json` exposes authentication/subscription metadata but no remaining quota.
- Therefore `quota()` remains explicitly unavailable rather than returning fabricated capacity. This is a known F12 partial gate, not a hidden estimate.

Focused provider usage tests: 8/8 passed. Package and Core typechecks passed.

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
