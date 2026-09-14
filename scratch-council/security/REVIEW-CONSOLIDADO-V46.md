# Revisão consolidada — Wave 1 receipts e event log/replay

Data: 2026-09-13  
Método: leitura read-only e teste de integração PostgreSQL no worker.

## Fornalha — Wave 1 receipts/evidence com RLS

`maestri check Fornalha` retornou `No connection`; não apareceu novo commit de receipts/RLS nos worktrees. O estado versionado conhecido permanece `2583449e` em `business-os-wave-1-operating-core-2026-09-11`. A reconfirmação com role não-superuser não pôde ser atribuída a um SHA novo nesta sessão.

**PASS-CONDICIONAL** — implementação anterior e idempotência conhecidas; falta commit/prova RLS não-superuser identificável para fechar definitivamente.

## Telar — Wave 1 event/receipt append e replay idempotente

Peça identificada em `/home/claude/src/worktrees/wave1-job-engine-persistence-2026-09-13`, SHA `f2ef1bc0` (`feat(wave1): persist idempotent job receipts`). `appendJobReceipt` usa unique `(organization_id, job_id, event_id)` e upsert que preserva o receipt original; `listJobReceipts` filtra por tenant e job.

Teste `job-receipt-store.integration.test.ts` executado pelo próprio teste com PostgreSQL descartável: **1 arquivo, 1 teste passou, exit 0**. Duas escritas concorrentes retornaram o mesmo receipt, pool novo reconstruiu o estado e leitura de outro tenant retornou vazio. Container removido no teardown.

**PASS.**

## Veredito

- Wave 1 receipts/RLS Fornalha: **PASS-CONDICIONAL** — novo SHA/prova não identificados.
- Event/receipt append/replay Telar: **PASS**.

SELF-CHECK: PASS — canais maestri indisponíveis registrados, SHA determinado pelo worktree e teste PostgreSQL real executado sem mascaramento.
