# Re-revisão final — Wave 1 Job Claim Store

Data: 2026-09-13  
Método: verificação read-only no worker e execução real do teste de integração focado. Não foram feitas alterações no repositório nem merges; a migration foi aplicada somente no PostgreSQL descartável.

## Estado confirmado

Worktree: `/home/claude/src/worktrees/wave1-job-engine-persistence-2026-09-13`  
HEAD: `85e2d1e5` — `feat(wave1): persist job claims atomically`  
Status Git: limpo.

## Teste real — resultado independente

Comando executado:

```text
pnpm --dir apps/crm exec vitest run --root /home/claude/src/worktrees/wave1-job-engine-persistence-2026-09-13 --config /home/claude/src/worktrees/wave1-job-engine-persistence-2026-09-13/apps/crm/vitest.config.ts packages/operating-core/src/job-claim-store.integration.test.ts
```

Execução final, com PostgreSQL descartável novo e migration aplicada via `psql` dentro do container:

```text
POSTGRES_READY attempt=3
CREATE TABLE
CREATE INDEX
MIGRATION_EXIT=0
✓ packages/operating-core/src/job-claim-store.integration.test.ts (1 test)
Test Files  1 passed (1)
Tests       1 passed (1)
TEST_EXIT=0
CONTAINER_REMOVED=wave1-pg-269111
```

O teste conectou ao PostgreSQL descartável, executou a disputa concorrente via `Promise.all`, verificou um único vencedor, release, novo store/claim e encerrou o pool. O container foi removido pelo `trap` após a execução.

## Revisão do claim

**Veredito de implementação: PASS parcial.**

- `packages/operating-core/src/job-claim-store.ts:19-30` usa `INSERT ... ON CONFLICT (organization_id,job_id) DO UPDATE ... RETURNING`; `RETURNING` vazio representa perda do claim.
- `supabase/migrations/20260913090000_operating_core_job_claims.sql:1-13` persiste a linha e impõe unique `(organization_id, job_id)`.
- O update só permite takeover de estado `RELEASED` (`job-claim-store.ts:23`), e `23505` é tratado como ausência de claim (`:27-29`).
- `release` exige tenant, job, worker e status `CLAIMED` (`:33-39`).
- `job-engine.ts:11-19` integra claim persistido antes da transição local e libera se ela falhar.

## Veredito final

**PASS (provider-free / integração PostgreSQL descartável).** A execução independente confirmou a migration, a conexão PostgreSQL, a concorrência de dois claims, um único vencedor, release, novo store/claim e teardown, com `TEST_EXIT=0`.

Persistem ainda as lacunas de autenticação/capability do worker e RLS/privileges da tabela; o `workerId` é fornecido pelo chamador e a migration não declara RLS.

SELF-CHECK: PASS — teste real executado com saída e exit code registrados, sem exposição de credenciais, sem migration/merge e com container descartável removido.
