# Revisão consolidada V63 — Wave 9 Repair Loop final

Data: 2026-09-13  
Escopo: revalidação independente do repair loop concorrente do Telar e atualização da contagem das 16 Waves.

## Identidade

- Worktree: `/home/claude/src/worktrees/wave9-product-factory-2026-09-12`
- SHA: `4b7e0543264b89a076f47fff221457160b9553aa` (`fix(wave9): reject concurrent repair reentry`)
- Histórico imediato: `0b1b9d46` (reserva atômica de tentativas), `78a76c40` (leitura do estado no PostgreSQL).
- Worktree sem alterações reportadas por `git status --short`.

## Prova independente

Teste executado por mim:

```text
apps/crm/tests/integration/product-factory-repair-postgres.test.ts
```

Procedimento: iniciei PostgreSQL 16 descartável no worker, apliquei `supabase/migrations/20260913000000_build_plan_state.sql`, exportei `DATABASE_URL` para essa instância e executei Vitest a partir da raiz da worktree com `--config apps/crm/vitest.config.ts`. O container foi removido no `trap` de teardown.

Saída real relevante:

```text
✓ apps/crm/tests/integration/product-factory-repair-postgres.test.ts (1 test) 67ms
Test Files 1 passed (1)
Tests 1 passed (1)
EXIT:0
```

O teste usa dois `repairFailedBuildPlan` concorrentes sobre o mesmo `(tenant, plan, step)`, bloqueia a execução do primeiro, exige que o segundo rejeite com `already RUNNING`, libera o primeiro e confirma `BLOCKED`, `attempts=1` e apenas uma execução. A consulta final vem do PostgreSQL, não de memória local.

## Revisão do mecanismo

- `BuildPlanStateStore.recordAttempt` faz `UPDATE ... WHERE status NOT IN ('RUNNING','BLOCKED','SUCCEEDED')` e fallback `INSERT ... ON CONFLICT DO NOTHING`; a constraint única é `(tenant_id, plan_id, step_id)`.
- Estado `RUNNING` impede reentrada concorrente; `BLOCKED` e `SUCCEEDED` não são reabertos.
- Ao atingir o limite, `finish(..., 'BLOCKED')` persiste `blocked_at`; uma chamada posterior lê o estado persistido e falha terminalmente.
- Não foram observados secrets hardcoded ou logs de dados sensíveis nesta peça.

## Veredito

**PASS — Wave 9 Repair Loop.**

A correção está comprovada por PostgreSQL real e concorrência real via `Promise` concorrente: exatamente um worker executa, o segundo é rejeitado, `BLOCKED` é terminal e `attempts=1` sobrevive fora da memória do processo.

## Contagem final das 16 Waves

O V61 registrava 14/16 Waves com pelo menos uma peça crítica em PASS real; Waves 6 e 9 eram as únicas sem PASS real. Com este PASS independente da Wave 9, a contagem passa a:

**16 de 16 Waves com pelo menos uma peça crítica em PASS real.**

Isso não converte automaticamente todas as peças de cada Wave em prontas para produção: permanecem válidos os condicionais e `NOT_PROVEN` registrados nos consolidados anteriores e em `CONFORMIDADE-GERAL-16-WAVES-2026-09-13.md`.

SELF-CHECK: PASS
