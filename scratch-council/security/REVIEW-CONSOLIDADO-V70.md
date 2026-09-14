# Revisão consolidada V70 — Wave 8 Layer Reuse Approvals e Wave 1 Job Claims RLS

Data: 2026-09-13  
Escopo: revisão read-only dos dois fechamentos e prova PostgreSQL independente.

## Wave 8 — layer reuse approvals (Vértice)

- Worktree: `/home/claude/src/worktrees/wave8-asset-intelligence-2026-09-13`
- SHA: `d6b5a0afeba81742022de141c65bd36cf6edfb72` (`test(wave8): prove layer reuse approval persistence and RLS`).
- Migration `20260913140000_layer_reuse_approvals.sql`: chave única `(organization_id, approval_id)`, status fechado por `CHECK`, RLS com `fn_user_org_ids()` em `USING`/`WITH CHECK` e grants limitados.
- Teste executado por mim: `apps/crm/lib/asset-intelligence/layer-reuse-approval.integration.test.ts`.
- O teste subiu PostgreSQL Docker descartável, criou role `layer_approval_test` como `NOSUPERUSER NOBYPASSRLS`, comprovou persistência após novo pool, replay/idempotência e bloqueio cross-tenant. Container removido no teardown.
- Resultado: **1 arquivo / 1 teste PASS**, exit `0`.

**Veredito Wave 8: PASS.**

## Wave 1 — job claims RLS (Telar)

- Worktree: `/home/claude/src/worktrees/wave1-job-engine-persistence-2026-09-13`
- SHA: `a2fd5dde02d95be6ec92107a8f96d7043d1d9534` (`fix(wave1): enforce job claim tenant RLS`).
- Migration `20260913090000_operating_core_job_claims.sql` agora habilita RLS, aplica policy tenant-scoped em `USING` e `WITH CHECK` e concede acesso somente à role `authenticated`.
- Teste executado por mim: `packages/operating-core/src/job-claim-store-rls.integration.test.ts`.
- O teste subiu PostgreSQL Docker descartável, criou role `authenticated` `NOSUPERUSER NOBYPASSRLS`, verificou leitura exclusiva de tenant e rejeição de insert cross-tenant. Container removido no teardown.
- Resultado: **1 arquivo / 1 teste PASS**, exit `0`.

**Veredito Wave 1 job claims RLS: PASS.**

## Resumo

- Wave 8 layer reuse approvals: **PASS**.
- Wave 1 job claims RLS: **PASS**.
- Nenhum secret hardcoded ou log sensível observado.
- A contagem permanece **16/16 Waves com pelo menos uma peça crítica em PASS real**.

SELF-CHECK: PASS
