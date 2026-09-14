# Revisão consolidada V65 — Wave 6 single-use concorrente

Data: 2026-09-13  
Escopo: confirmação independente do teste concorrente do token do client portal.

## Identidade

- Worktree: `/home/claude/src/worktrees/wave6-studio-comercial-2026-09-12`
- SHA observado: `2a3810552943d741304e60c1a7f4a698620c98b1`
- Teste: `apps/crm/lib/studio/client-portal-token-store.integration.test.ts`
- O teste depende de `STUDIO_PORTAL_TEST_DATABASE_URL` e usa 16 chamadas concorrentes a `consume` sobre o mesmo token `single_use`.

## Prova independente

Iniciei PostgreSQL 16 Docker descartável no worker, criei o schema compatível do token store, exportei `STUDIO_PORTAL_TEST_DATABASE_URL`, executei Vitest da raiz da worktree com configuração explícita e removi o container no teardown.

Saída real:

```text
✓ apps/crm/lib/studio/client-portal-token-store.integration.test.ts (1 test) 59ms
Test Files 1 passed (1)
Tests 1 passed (1)
EXIT:0
```

O teste confirma que, entre 16 consumidores concorrentes, exatamente um resultado é truthy e que apenas uma linha fica com `used_at` preenchido. A query de consumo usa um único `UPDATE ... WHERE ... (single_use = false or used_at is null) RETURNING`, portanto a decisão é atômica no PostgreSQL.

## Veredito

**PASS — concorrência single-use do token da Wave 6.**

A lacuna específica de prova concorrente foi fechada independentemente. O escopo maior de client-portal-flow continua **PASS-CONDICIONAL** conforme V62: ainda faltam redação efetiva de comentários, RLS para `studio_client_decisions` e teste fail-closed quando a URL não existe.

SELF-CHECK: PASS
