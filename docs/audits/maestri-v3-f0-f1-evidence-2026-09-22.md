# Evidência F0/F1 + M1 Core — Maestri V3

**Branch:** `vps`
**Commit da implementação:** após esta evidência
**Escopo:** contratos canônicos e eliminação de sucesso simulado nos adapters.

## Alterações

- `TaskContract` agora exige capabilities, risco, budgets, provider preferido e evidência requerida.
- `ExecutionResult` agora cobre summary, commands, tests, evidence, usage, context e erro estruturado.
- `ExecutionPort` agora define `execute`, `resume`, `cancel`, `health`, `capabilities`, `usage` e `quota`.
- Codex e Antigravity não retornam mais `success` sem execução; retornam `unavailable` com `provider_unavailable`.
- Testes de integração Postgres são pulados quando Docker/daemon não existem; Docker não foi instalado.

## Comandos e resultado

```text
pnpm --filter @lumenva/operating-core test
Test Files: 3 passed, 2 skipped
Tests: 9 passed, 2 skipped

pnpm --filter @lumenva/operating-core typecheck
PASS

pnpm --filter @lumenva/core test
Test Files: 15 passed
Tests: 33 passed

pnpm --filter @lumenva/core typecheck
PASS

pnpm --filter @lumenva/maestri-context-gateway test
Tests: 34 passed, 0 failed
```

Os dois testes pulados dependem de Postgres em Docker; isso é esperado e documentado pela restrição do Owner. Nenhuma chamada externa de provider foi simulada como sucesso.
