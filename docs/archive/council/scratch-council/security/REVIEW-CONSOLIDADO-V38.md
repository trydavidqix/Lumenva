# Re-revisão — Wave 8 Approval Registry RLS

Data: 2026-09-13  
Worktree: `/home/claude/src/worktrees/wave8-asset-intelligence-2026-09-13`  
SHA: `5348cd09`.

## Prova independente

Repeti o harness via script remoto com heredoc (sem quoting aninhado). Subi PostgreSQL descartável, criei role `authenticated` não-superuser, tabela `layer_reuse_approvals`, função `fn_user_org_ids()` baseada em `current_setting('app.test_org')`, policy RLS `using/with check` e grant mínimo. Executei o teste oficial `apps/crm/lib/asset-intelligence/approval-registry.test.ts` com `DATABASE_URL` apontando ao banco.

Saída real:

```text
Test Files 1 passed (1)
Tests 1 passed (1)
exit 0
CONTAINER_REMOVED
```

O cenário passou persistência, leitura tenant-scoped, bloqueio de update cross-tenant e atualização/reuso no tenant correto. O container foi removido.

## Veredito

**PASS.** O Approval Registry tem persistência PostgreSQL, chave única por `(organization_id, approval_id)`, `FOR UPDATE` na leitura e RLS real provado com role não-superuser; o erro anterior era exclusivamente de quoting do harness.

SELF-CHECK: PASS — RLS executado de fato, saída registrada e container descartável removido.
