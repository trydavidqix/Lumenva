# Revalidação — integrações PostgreSQL Wave 5 e Wave 1

Data: 2026-09-13  
Escopo: execução independente com containers PostgreSQL descartáveis; containers removidos ao final.

## Wave 5 — Command Center overview RLS

- Env configurada: `COMMAND_CENTER_DATABASE_URL` apontando para PostgreSQL descartável.
- O teste criou role `command_center_rls_test` (`NOSUPERUSER NOBYPASSRLS`), função `fn_user_org_ids`, aplicou a migration `20260913150000_command_center_overview_rls.sql` e executou como role autenticada.
- `overview-state-rls.integration.test.ts`: **1/1 passou**, exit `0`.
- Prova real: tenant A grava; tenant B não lê A (`null`) e não consegue gravar A (erro de permissão `42501`).

**Veredito: PASS.** O isolamento RLS foi exercitado com role sem `BYPASSRLS`; container removido após o teste.

## Wave 1 — Operating Core receipts

- Env configurada: `OPERATING_CORE_TEST_DATABASE_URL` apontando para PostgreSQL descartável.
- Migration `20260913140000_0165_operating_core_receipts.sql` aplicada para criar a tabela. O `psql` reportou erro ao criar a policy porque o harness mínimo definiu `fn_user_org_ids()` retornando `text`, enquanto `organization_id` é `uuid` (`operator does not exist: uuid = text`).
- `receipt-store.integration.test.ts`: **1/1 passou**, exit `0`.
- A prova concorrente real executou 16 `save` em `Promise.all` e confirmou exatamente um id/uma linha para a chave de idempotência.
- Limite da prova: esse teste não tenta acesso cross-tenant e, devido ao erro de tipo na policy durante a preparação, não comprova RLS. A migration precisa de `fn_user_org_ids()` compatível com `uuid` (ou cast explícito) para uma prova RLS válida.

**Veredito: BLOCKED para o requisito RLS; PASS apenas para persistência/idempotência concorrente.** Reexecutar com a assinatura/tipo correto da função e teste cross-tenant sob role `authenticated`/sem `BYPASSRLS`.

## Resultado final

- Wave 5: **PASS**.
- Wave 1 receipts: **BLOCKED** (RLS não provado; concorrência/idempotência passou).

<self-check>PASS — ambos os testes foram executados com DATABASE_URL real em PostgreSQL descartável; nenhum skip foi tratado como sucesso.</self-check>
