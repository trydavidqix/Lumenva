# Re-revisão definitiva — estado atual Wave 9 e Wave 10

Data: 2026-09-13  
Método: inspeção read-only via SSH no worker, dos HEADs atuais, implementação Postgres e testes existentes. Não foram executados testes, build, migration, merge ou efeitos live.

## HEADs confirmados

- Wave 9, `/home/claude/src/worktrees/wave9-product-factory-2026-09-12`: `78a76c40fd975b5b0b0b928fc119cd8fe8ba1016` — `fix(wave9): read repair state from postgres`.
- Wave 10, `/home/claude/src/worktrees/wave10-mobile-delivery-2026-09-13`: `b83cfb74acb55e635a007de14760f75273b38b7a` — `feat(wave10): persist delivery gate state in postgres`.

## Wave 9 — Repair Loop

**Veredito: BLOCKED.** A leitura de estado Postgres fecha o bypass de restart para linhas `BLOCKED`, mas ainda não fecha a race concorrente nem o orçamento global de tentativas.

Evidência:

- `build-plan.ts:70-75` lê a linha persistida antes de decidir; se `status === "BLOCKED"`, rejeita, e se `attempts >= maxAttempts`, marca/retorna bloqueio. Isso cobre restart quando a linha foi realmente persistida como `BLOCKED`.
- `build-plan-state-store.ts:9-10` incrementa attempts com `ON CONFLICT`, mas a cláusula é `where build_plan_state.status='RUNNING'`. Duas chamadas concorrentes podem ler o mesmo contador e ambas executar `recordAttempt`; a constraint única não impede duas atualizações sequenciais da mesma linha `RUNNING`.
- Cada chamada decide o limite com uma leitura seguida de incremento separado (`build-plan.ts:70-77`). Sem uma reserva atômica que combine “verificar limite + incrementar”, concorrência pode ultrapassar `maxAttempts` e executar mais de um executor.
- `terminallyBlockedPlans` ainda existe para o caminho sem `stateStore` (`build-plan.ts:41`, `:58-67`); esse modo continua apenas em memória e não é prova de terminalidade durável.
- A busca no estado atual não encontrou teste de restart contra um `Queryable`/Postgres real; o teste existente anterior cobre somente replay sequencial no mesmo processo.

**Conclusão:** o fix melhora restart com store, mas não fecha o bloqueio completo. Requer claim/reserva transacional atômica por `(tenant, plan, step)`, rejeição terminal de `BLOCKED`/`SUCCEEDED` no SQL e teste concorrente/restart real.

## Wave 10 — Delivery Gate

**Veredito: BLOCKED.** O HEAD atual de Wave 10 não contém a correção final de leitura de estado do Wave 9; ainda usa o `BuildPlanStateStore` antigo e permissivo.

Evidência:

- `build-plan-state-store.ts:3-5` no HEAD `b83cfb74` faz `ON CONFLICT ... where build_plan_state.status <> 'RUNNING'`, permitindo reabrir `BLOCKED` e `SUCCEEDED`, limpar `blocked_at` e voltar a `RUNNING`.
- `delivery.ts:59-75` (`validateDeliveryPlanWithState`) apenas valida e grava estado. Não lê estado terminal antes de decidir, não exige `plan.status` `APPROVED`/`PACKAGED` e não executa a entrega nem produz receipt de delivery.
- Em validação inválida, `delivery.ts:67-69` chama `finish(..., "BLOCKED")` incondicionalmente; isso pode sobrescrever estado sem uma guarda de transição.
- A migration `20260913000000_build_plan_state.sql` fornece constraint única `(tenant_id, plan_id, step_id)`, mas a constraint sozinha não cria terminalidade nem acopla a validação à ação efetiva de entrega.

**Conclusão:** o estado Postgres presente em Wave 10 não é o fix final descrito pelo pedido. O bloqueio de boundary fail-closed e reabertura terminal permanece integralmente aberto.

## Secrets e logging

Busca textual read-only nos arquivos novos/modificados por `sk-`, `api[_-]?key`, `secret`, `password`, `Bearer`, `console.` e `logger.` não encontrou secret hardcoded ou logging sensível.

## Veredito final do dia

- Wave 9 Repair Loop: **BLOCKED** — restart bloqueado quando o estado persistido é consultado, mas race e limite global ainda não são atômicos; modo sem store segue memória local.
- Wave 10 Delivery Gate: **BLOCKED** — worktree não contém a correção final de leitura; claim permissivo e boundary de entrega desacoplada continuam.

Resposta: **não, os dois últimos bloqueios não estão fechados**. A persistência/constraint é necessária, porém o estado atual ainda permite execução concorrente excessiva e reabertura de estados terminais; Wave 10 sequer incorporou a leitura persistida final.

SELF-CHECK: PASS — HEADs atuais e divergência entre worktrees confirmados, revisão read-only, sem testes/build/migration/merge/efeito externo.
