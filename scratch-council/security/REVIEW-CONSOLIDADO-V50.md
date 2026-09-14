# Re-revisão — Wave 1 receipts RLS e Wave 15 Resource Router RLS

Data: 2026-09-13  
Escopo: código real no worker e provas PostgreSQL independentes; sem efeitos externos.

## Wave 1 — receipts RLS (Telar)

- Worktree: `/home/claude/src/worktrees/wave1-job-engine-persistence-2026-09-13`
- SHA confirmado: `4459d509` (`test(wave1): prove receipt tenant RLS`), sobre `f2ef1bc0`.
- O teste `job-receipt-store-rls.integration.test.ts` cria seu próprio PostgreSQL descartável, role `authenticated` `NOSUPERUSER NOBYPASSRLS`, aplica a policy e executa leitura/gravação com `app.org_ids`.
- Prova real executada: **1/1 passou**, exit `0`. Tenant A lê apenas A; tentativa de inserir receipt de tenant B é rejeitada com `42501`.
- A migration usa `USING` e `WITH CHECK` contra `fn_user_org_ids()::text`; o tipo é compatível com `organization_id` textual desta tabela.

**Veredito: PASS.** O gap anterior de tipo/policy e ausência de prova cross-tenant foi fechado. O container criado pelo teste foi removido no teardown.

## Wave 15 — Resource Router RLS (Fornalha)

- Worktree: `/home/claude/src/worktrees/wave15-resource-router-2026-09-13`
- SHA confirmado: `01122bc4d05eac4abb4c21e3e4217cf1fcaa404d` (`fix(wave15): enforce resource router tenant RLS`).
- O teste `resource-router-rls.integration.test.ts` requer `RESOURCE_ROUTER_DATABASE_URL`; configurei a variável para PostgreSQL Docker descartável, criei `fn_user_org_ids()`, e o próprio teste criou role `resource_router_rls_test` `NOSUPERUSER NOBYPASSRLS`, aplicou a migration e concedeu apenas privilégios da tabela.
- Prova real executada: **1/1 passou**, exit `0`. Tenant B não lê worker de A e tentativa de persistir em A falha com `42501`.
- Migration aplica RLS `FOR ALL` com `USING` e `WITH CHECK` em workers e reroutes, ambos tenant-scoped.

**Veredito: PASS.** Isolamento cross-tenant foi comprovado sob role sem `BYPASSRLS`; container removido após a execução.

## Consolidado

- Wave 1 receipts: **PASS**.
- Wave 15 Resource Router: **PASS**.

<self-check>PASS — SHAs confirmados, env vars corretas configuradas, PostgreSQL real usado e nenhum teste skipped.</self-check>
