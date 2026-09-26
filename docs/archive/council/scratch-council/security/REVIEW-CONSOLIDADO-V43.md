# Revisão — Wave 2 Agent Definition Registry V2 persistido

Data: 2026-09-13  
Worktree: `/home/claude/src/worktrees/wave2-agent-birth-2026-09-12`  
SHA: `0e285f1c` (`feat(wave2): add registry RLS migration`).

## Código e schema

`PostgresAgentDefinitionRegistry` usa colunas explícitas, primary key composta `(organization_id, definition_id, definition_version)` e unique `(organization_id, approval_id)`. O `register` revalida authority server-side antes do `INSERT ... ON CONFLICT DO NOTHING`; `get` filtra pelos três campos de tenant/id/versão. A migration `0168_agent_definition_registry.sql` fixa `organization_id uuid`, status exclusivamente `CERTIFIED` e RLS `USING/WITH CHECK` via `fn_user_org_ids()`.

## Prova independente

Subi PostgreSQL descartável, exportei `DATABASE_URL` e executei `agent-definition-registry-pg.integration.test.ts`. Resultado: **1 arquivo, 1 teste passou, exit 0**. O teste usou dois `register` concorrentes e confirmou exatamente um vencedor e leitura posterior do registro; container removido.

Limite: o teste chama `initialize()`, que cria uma tabela de teste com `organization_id text` e sem RLS, em vez de aplicar a migration `0168` com `uuid`/policies. Logo, a concorrência/upsert foi provada, mas RLS real e schema final não foram exercidos por este teste.

## Veredito

**PASS-CONDICIONAL.** Chaves compostas, colunas explícitas, authority e concorrência estão corretas; aplicar a migration real em role não-superuser e repetir cross-tenant para confirmar RLS antes de PASS definitivo.

SELF-CHECK: PASS — SHA conferido, PostgreSQL real usado, concorrência observada, limitação do harness registrada e container removido.
