# Re-revisão absoluta — Wave 9 Repair Loop e Wave 10 Delivery Gate

Data: 2026-09-13  
Método: inspeção read-only via SSH no worker dos HEADs atuais e dos fixes solicitados. Não foram executados testes, dois processos, build, migration, merge ou efeitos live.

## HEADs atuais

- Wave 9: `/home/claude/src/worktrees/wave9-product-factory-2026-09-12`, `0b1b9d46493f74d5897a72126f29d9d8cfd1c31b` — `fix(wave9): reserve repair attempts atomically`.
- Wave 10: `/home/claude/src/worktrees/wave10-mobile-delivery-2026-09-13`, `e1c202f370139becb9ad66957e53fdd826cafd71` — `fix(wave10): atomically gate delivery state`.

## Wave 9 — estado Postgres e concorrência

**Veredito: PASS CONDICIONAL — o caminho com `stateStore` fecha terminalidade e reserva concorrente; a API ainda permite fallback não durável.**

- `apps/crm/lib/product-factory/build-plan-state-store.ts:9-12` usa uma única instrução `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`, com atualização permitida somente para estados que não sejam `RUNNING`, `BLOCKED` ou `SUCCEEDED`.
- A constraint única da migration `(tenant_id, plan_id, step_id)` serializa a linha; o segundo processo concorrente não recebe `RETURNING` enquanto o primeiro detém `RUNNING`.
- `build-plan.ts:70-81` lê estado Postgres antes de decidir, rejeita `BLOCKED`, consulta `attempts` persistido, reserva a próxima tentativa atomicamente e grava `FAILED`/`SUCCEEDED`/`BLOCKED`.
- Após restart, `persisted.status === "BLOCKED"` (`:71-72`) impede novo executor; estados `BLOCKED`/`SUCCEEDED` não são reabertos pelo SQL.

Ressalvas para a palavra “absoluto”:

- `stateStore` continua opcional (`build-plan.ts:49`). Sem ele, `:58-67` usa `terminallyBlockedPlans` em memória; restart e concorrência deixam de estar garantidos.
- O commit não contém teste de dois processos reais; a atomicidade é demonstrada por SQL/constraint, não por execução concorrente observada nesta revisão.

**Classificação:** PASS no caminho Postgres obrigatório; BLOCKED se o fallback sem `stateStore` continuar permitido em produção.

## Wave 10 — Delivery Gate final

**Veredito: PASS para os três requisitos específicos do fix; integração de entrega efetiva ainda NOT_PROVEN.**

- `apps/crm/lib/product-factory/build-plan-state-store.ts:9-20` implementa `get` e reserva atômica com `where status not in ('RUNNING','BLOCKED','SUCCEEDED')`; erro `23505` de corrida é convertido em falha de reserva (`:12-14`), não em sucesso.
- `apps/crm/lib/product-factory/delivery.ts:65-68` lê o estado persistido antes de qualquer decisão e rejeita `BLOCKED`/`SUCCEEDED` como terminais.
- `delivery.ts:69-71` exige `plan.status` `APPROVED` ou `PACKAGED`; estados `DRAFT`, `FAILED` e `BLOCKED_EXTERNAL` não passam.
- `delivery.ts:73-84` reserva o gate antes de marcar `SUCCEEDED`; chamadas concorrentes ou replay não recebem autorização quando a reserva falha.
- Testes `product-factory-delivery.test.ts:47-70` cobrem exigência de `APPROVED/PACKAGED` e não reabertura de `BLOCKED/SUCCEEDED` com fake store.

Limite residual: `validateDeliveryPlanWithState` valida e grava `SUCCEEDED`, mas não executa o canal nem produz receipt de entrega (`delivery.ts:59-85`). O gate está fechado; a prova de que toda implementação real de `MANAGED_SERVICE`/preview/app store chama essa boundary permanece NOT_PROVEN.

## Secrets e logging

Busca textual read-only nos arquivos alterados por `sk-`, `api[_-]?key`, `secret`, `password`, `Bearer`, `console.` e `logger.` não encontrou secret hardcoded ou logging sensível.

## Veredito absoluto dos dois bloqueios

- Wave 9: **PASS CONDICIONAL** — atomicidade e terminalidade estão corretas quando Postgres é obrigatório; fallback em memória impede PASS absoluto.
- Wave 10: **PASS** para atomicidade, `APPROVED/PACKAGED` e terminalidade `BLOCKED/SUCCEEDED`; integração com executor/receipt de delivery continua NOT_PROVEN.

Resposta: **não é correto declarar os dois bloqueios absolutamente fechados** enquanto Wave 9 aceitar `stateStore` ausente e não houver prova de dois processos reais. A Wave 10 fechou os requisitos específicos do fix, mas ainda precisa de prova de integração da entrega real para uma promoção de produção.

SELF-CHECK: PASS — HEADs atuais e linhas dos fixes confirmados, revisão read-only, sem testes/build/processos concorrentes/migration/merge/efeito externo.
