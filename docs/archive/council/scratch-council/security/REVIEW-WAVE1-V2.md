# Re-revisão de segurança — Wave 1 Job Claim Store

Data: 2026-09-13  
Método: inspeção read-only via SSH no worker e execução somente do teste de integração focado. Nenhum merge, migration ou efeito em ambiente real foi feito.

## Estado revisado

Worktree: `/home/claude/src/worktrees/wave1-job-engine-persistence-2026-09-13`  
Branch: `wave1/job-engine-persistence-2026-09-13`  
HEAD: `85e2d1e5` (`feat(wave1): persist job claims atomically`)

Arquivos do commit: `packages/operating-core/src/job-claim-store.ts`, `job-claim-store.test.ts`, `job-claim-store.integration.test.ts`, alterações em `job-engine.ts`/teste e migration `supabase/migrations/20260913090000_operating_core_job_claims.sql`.

## Teste de integração — resultado real

Comando executado a partir da raiz da worktree:

```text
pnpm --dir apps/crm exec vitest run --root /home/claude/src/worktrees/wave1-job-engine-persistence-2026-09-13 --config /home/claude/src/worktrees/wave1-job-engine-persistence-2026-09-13/apps/crm/vitest.config.ts packages/operating-core/src/job-claim-store.integration.test.ts
```

Resultado:

```text
Test Files  1 failed (1)
Tests       1 failed (1)
Error: DATABASE_URL is required for this integration test
EXIT_CODE=1
```

O arquivo foi descoberto e o teste foi realmente carregado pelo Vitest, mas não houve conexão com Postgres: `DATABASE_URL` não estava configurada. Portanto, a alegação de concorrência real/restart **não está provada por execução** nesta revisão.

## Persistência e claim atômico

**Veredito de código: PASS parcial; veredito de evidência: BLOCKED/NOT_PROVEN.**

- `job-claim-store.ts:19-30` usa um único `INSERT ... ON CONFLICT (organization_id,job_id) DO UPDATE ... RETURNING`; `RETURNING` vazio representa claim perdido, sem check-then-write em memória.
- `:23-24` parametriza tenant, job e worker. A migration `operating_core_job_claims.sql:1-13` cria tabela persistente e unique `(organization_id, job_id)`.
- O update só ocorre se o estado existente for `RELEASED` (`:23`); claim `CLAIMED` não é reaberto por outro worker. Erro de unique `23505` é tratado como ausência de claim (`:27-29`).
- `release` (`:33-39`) exige tenant, job, worker e status `CLAIMED`, evitando release por worker alheio.
- `job-engine.ts:11-19` integra claim persistido antes do claim local e libera a linha se a transição local falhar.

Limites:

- O teste unitário (`job-claim-store.test.ts:4-19`) verifica apenas SQL/mock; não prova semântica Postgres.
- O teste de integração (`job-claim-store.integration.test.ts:14-25`) foi escrito para dois stores concorrentes e nova instância após release, mas falhou antes de executar por falta de `DATABASE_URL`.
- Identidade/capability do worker não são autenticadas pelo store; `workerId` é input do chamador. RLS/privileges da tabela não estão definidos na migration (`:1-16`).
- IDs/tenant vazios não são rejeitados em runtime; podem gerar linhas inválidas embora não criem cross-tenant por si só.

## Secrets e logging

Busca textual read-only nos arquivos alterados por padrões de chave/credencial não encontrou secret hardcoded ou logging sensível. O teste não contém password literal; usa exclusivamente `process.env.DATABASE_URL`.

## Veredito final

**BLOCKED por falta de prova executada, não por falha estrutural evidente no claim SQL.** O desenho é atomicamente adequado em código e a unique constraint fornece isolamento básico por tenant/job, mas o teste real não passou porque o worker não tinha `DATABASE_URL`; persistência, concorrência de dois processos e restart permanecem NOT_PROVEN.

SELF-CHECK: PASS — worktree/HEAD confirmados, teste focal executado com saída real, sem migration/merge e sem exposição de credenciais.
