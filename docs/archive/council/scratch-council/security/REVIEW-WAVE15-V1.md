# Revisão de segurança — Budget Router Wave 15 (Lótus)

Data: 2026-09-13  
Método: inspeção read-only via SSH no worker, sem build, testes, merge ou efeitos live.

## Estado revisado

Worktree: `/home/claude/src/worktrees/wave15-resource-router-2026-09-13`  
Branch: `wave15/resource-router-2026-09-13`  
HEAD: `fe55385368051df48ec3a74aff1754f53e00533f` — `feat(runtime): add fail-closed budget router`

Arquivos: `apps/crm/lib/memory/budget-router.ts` e `budget-router.test.ts`.

## Orçamento zerado e valores inválidos

**Veredito: PASS local para requisições positivas; sem fail-open óbvio no predicado.**

- `budget-router.ts:12-13` considera válidos apenas números finitos e não negativos.
- `:22-31` nega `taskId` vazio, tokens/custo inválidos ou negativos e saldos inválidos, retornando `allowed: false` com `budget_invalid`.
- `:33-45` nega quando tokens ou custo solicitados excedem o saldo; saldo zero com qualquer requisição positiva resulta em `budget_exhausted`.
- `:47-54` só permite quando ambos os consumos cabem no saldo e devolve os saldos calculados.
- Os testes `budget-router.test.ts:20-34` cobrem tokens/custo esgotados, `NaN`, negativos e infinito.

Observação: uma requisição de tokens `0` e custo `0` é permitida com orçamento zero, pois não consome recurso. Se o contrato exigir negar todo trabalho quando saldo for zero, falta uma guarda explícita; isso não é overspend para uma operação de custo nulo.

## Lacunas de enforcement

**BLOCKED para afirmar controle de orçamento de produção.** `routeBudget` é função pura: não persiste nem reserva saldo. Duas chamadas concorrentes podem ler o mesmo `BudgetState` e ambas receber `allowed: true`, ultrapassando o orçamento real. `tokensRemaining`/`costRemaining` retornados não são escritos de volta pelo router.

Também não há identidade de tenant, actor, currency, idempotency key ou receipt de débito no contrato (`budget-router.ts:1-10`); isolamento e autorização dependem totalmente do chamador. `taskId.trim()` (`:22`) pressupõe string: input runtime não-string lança TypeError em vez de um `BudgetDecision` explícito, caminho fail-closed por exceção mas sem contrato de erro estável.

## Secrets e logging

Busca textual read-only nos dois arquivos por `sk-`, `api[_-]?key`, `secret`, `password`, `Bearer`, `console.` e `logger.` não encontrou secret hardcoded ou logging sensível.

## Veredito final

- Fail-closed com orçamento zero/insuficiente e valores inválidos: **PASS local** para consumos positivos.
- Reserva/decremento atômico, concorrência, tenant/actor e persistência: **NOT_PROVEN/BLOCKED**.
- Secrets hardcoded/log sensível: **nenhum encontrado**.

Conclusão: o predicado nega corretamente o caso comum de orçamento zerado, mas não é um budget gate completo de produção enquanto não houver débito atômico/persistente e boundary de tenant/actor.

SELF-CHECK: PASS — HEAD e arquivos confirmados, revisão read-only, sem testes/build/merge/efeito externo e sem exposição de segredos.
