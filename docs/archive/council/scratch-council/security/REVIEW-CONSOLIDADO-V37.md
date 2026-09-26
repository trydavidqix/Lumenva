# Revisão consolidada — Wave 1 Job Claims e Wave 8 Approval Registry

Data: 2026-09-13  
Método: leitura read-only e execução independente com PostgreSQL descartável.

## Fornalha — Wave 1 `PostgresJobClaimStore`

Worktree `/home/claude/src/worktrees/wave1-job-engine-persistence-2026-09-13`, SHA `85e2d1e5d355f29bccfc66e5f231edad5351ce05`. `claim` usa unique `(organization_id, job_id)` e `ON CONFLICT` condicionado a `status='RELEASED'`; release/get também filtram tenant e worker.

Teste real contra PostgreSQL descartável: **1 arquivo, 1 teste passou, exit 0**. Dois stores em `Promise.all` produziram exatamente um claim; novo store observou `CLAIMED`, release permitiu novo claim e `attempts=2`. Container removido.

**PASS.**

## Telar — Wave 8 Approval Registry

Worktree `/home/claude/src/worktrees/wave8-asset-intelligence-2026-09-13`, SHA `5348cd09`. Store usa `ON CONFLICT (organization_id, approval_id) DO UPDATE`; leitura filtra tenant e usa `FOR UPDATE`. Migration define unique composto e RLS `using/with check` por `fn_user_org_ids()`.

O teste disponível é `approval-registry.test.ts`, 1 cenário condicionado a `DATABASE_URL`; cria roles/claims `authenticated` e prova cross-tenant. Nesta execução o harness descartável não foi concluído por erro de quoting ao criar a função de claims, portanto o teste RLS não foi executado com sucesso independente.

**PASS-CONDICIONAL** — implementação e política RLS coerentes por inspeção; repetir o teste com função/roles reais para PASS.

`maestri check Fornalha` e `maestri check Telar` estavam sem conexão; SHAs foram confirmados diretamente nos worktrees.

SELF-CHECK: PASS — nenhum segredo exposto, teste PostgreSQL do Job Claim executado e container removido; limitação do RLS registrada sem mascaramento.
