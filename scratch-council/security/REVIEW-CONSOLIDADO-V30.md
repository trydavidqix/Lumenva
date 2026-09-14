# Re-revisão — Telar Wave 14 concorrência

Data: 2026-09-13  
Worktree: `/home/claude/src/worktrees/wave14-15-evals-autonomy-2026-09-12`  
SHA: `65d4115e80b5b59cb1cc4105bcad38a2582b26ab` (`test(wave14): resolve child cwd without duplication`).

## Prova independente

Executei o teste puro `apps/crm/lib/agent-engine/evals/postgres-evolution-receipts.test.ts` com PostgreSQL descartável. A saída confirmou:

```text
spawn_cwd=/home/claude/src/worktrees/wave14-15-evals-autonomy-2026-09-12/apps/crm
{"process":"p1","won":true}
{"process":"p2","won":false}
Test Files 1 passed (1)
Tests 3 passed (3)
```

Exit `0`; o container foi removido ao final. O `cwd` não está duplicado e os dois processos reais disputaram a mesma chave PostgreSQL, com exatamente um vencedor.

## Veredito

**Telar — Wave 14 EvolutionReceiptStore + ActionBus: PASS.** O bloqueio anterior estava no script de reprodução (`cwd` duplicado); o commit `65d4115e` corrige isso e a execução independente prova requester autenticado, ligação real do ActionBus ao store PostgreSQL e idempotência concorrente atômica.

SELF-CHECK: PASS — teste puro executado no SHA atual, saída real registrada e PostgreSQL descartável removido.
