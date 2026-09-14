# Review consolidado V78 — Wave 14 Watchdog authorization

Data: 2026-09-13  
Escopo: revisão independente read-only do estado atual no worker.

## Entrega

**Worktree:** `/home/claude/src/worktrees/wave14-15-evals-autonomy-2026-09-12`  
**SHA:** `a6852314d5cbdb3afad9f59e4f7f8cba3b7a6ae3`.

Revisei `postgres-watchdog-authorization.ts` e o teste de integração. O registry exige tenant não vazio, valida requester/permission, usa chave composta `(organization_id, requester_id)` com upsert, e o caller carrega o requester do tenant antes de permitir reroute. A migration habilita RLS; o teste usa role `NOSUPERUSER NOBYPASSRLS`.

## Evidência executada

Comando:

```text
node apps/crm/node_modules/vitest/vitest.mjs run --config apps/crm/vitest.config.ts apps/crm/lib/psycheos/postgres-watchdog-authorization.integration.test.ts apps/crm/lib/psycheos/postgres-no-progress-watchdog.integration.test.ts
```

Os testes subiram PostgreSQL 16 descartável e removeram os containers no teardown.

```text
✓ postgres-no-progress-watchdog.integration.test.ts (1 test)
✓ postgres-watchdog-authorization.integration.test.ts (1 test)
Test Files  2 passed (2)
Tests       2 passed (2)
EXIT=0
```

Foram comprovados requester permitido no tenant, requester desconhecido rejeitado, leitura cross-tenant vazia e INSERT forjado cross-tenant rejeitado por `42501`, além da persistência/concorrência do watchdog.

## Veredito

**PASS real no escopo Wave 14 — autorização persistente do reroute e RLS.** Não encontrei secret hardcoded nem caminho fail-open no boundary revisado. O teste é de integração local, portanto não prova produção/deploy nem todos os callers de evolução.

## Self-check

PASS — código, SHA e teste real verificados; PostgreSQL descartável encerrado; nenhum provider/credencial real utilizado.
