# Re-revisão final — persistência Postgres Wave 9 e Wave 10

Data: 2026-09-13  
Método: inspeção read-only via SSH no worker, dos HEADs atuais, código, migration e boundary de uso. Não foram executados testes, build, migration, merge ou efeitos live.

## HEADs atuais

- Wave 9, `/home/claude/src/worktrees/wave9-product-factory-2026-09-12`: `ce06295820c0cd8f6f5a11625c4d89c471381661` — `feat(wave9): persist repair state in postgres`.
- Wave 10, `/home/claude/src/worktrees/wave10-mobile-delivery-2026-09-13`: `b83cfb74acb55e635a007de14760f75273b38b7a` — `feat(wave10): persist delivery gate state in postgres`.

Migration comum: `supabase/migrations/20260913000000_build_plan_state.sql`, com constraint única `(tenant_id, plan_id, step_id)` e índice parcial de estado `RUNNING`.

## Wave 9 — Repair Loop

**Veredito: BLOCKED — a persistência reduz a race de claim concorrente, mas não fecha terminalidade nem orçamento de retries.**

Evidência:

- `apps/crm/lib/product-factory/build-plan-state-store.ts:3-6` faz `INSERT ... ON CONFLICT` atômico. A segunda chamada concorrente vê `status = 'RUNNING'`, não atualiza e recebe `false`; esse aspecto fecha a race de claim simultâneo.
- `build-plan.ts:64-65` chama `stateStore.claim` antes de executar o passo e rejeita quando já está `RUNNING`.
- Porém, `build-plan-state-store.ts:3` usa `where build_plan_state.status <> 'RUNNING'`. Isso permite reclamar uma linha `BLOCKED` ou `SUCCEEDED`, incrementando attempts, limpando `blocked_at` e voltando a `RUNNING`.
- `build-plan.ts:46-52` ainda depende do `Set` `terminallyBlockedPlans` em memória para o bloqueio local; após restart esse Set desaparece.
- O contador `attempts` usado no limite continua local (`build-plan.ts:66`, loop `:68-76`); o valor persistido é incrementado, mas nunca é lido para impedir que novas chamadas consumam outro `maxAttempts`.
- O teste novo anterior só prova replay sequencial no mesmo processo; não há teste do caminho Postgres `BLOCKED -> claim`, restart ou concorrência real contra o store.

**Conclusão Wave 9:** constraint única e claim atômico são progresso real, mas a transição terminal está aberta. É necessário rejeitar estados `BLOCKED`/`SUCCEEDED` no `claim` e aplicar limite persistido/atômico por plano e passo.

## Wave 10 — Delivery Gate

**Veredito: BLOCKED — a state store impede claim concorrente `RUNNING`, mas não torna o gate terminal nem acopla a aprovação à entrega.**

Evidência:

- `apps/crm/lib/product-factory/delivery.ts:56-70` adiciona `validateDeliveryPlanWithState`; valida primeiro e usa a mesma chave Postgres (`organization_id`, `delivery_plan_id`, `delivery-gate`) para claim/finish.
- Com validação válida, `claim` atômico impede dois `RUNNING` simultâneos; com validação inválida, `:62-64` grava `BLOCKED`.
- Contudo, o mesmo `claim` permissivo do store (`status <> 'RUNNING'`) permite reabrir uma linha `BLOCKED` ou `SUCCEEDED`; uma chamada posterior válida pode limpar `blocked_at` e marcar o gate como `SUCCEEDED` novamente.
- `validateDeliveryPlanWithState` continua apenas validando/gravando estado. Não executa a entrega nem retorna um receipt de entrega; um consumidor pode ignorar o retorno.
- A função não exige `plan.status === "APPROVED"`/`"PACKAGED"` e não adiciona gates de capability, approval, provider/credential, environment ou channel/platform compatibility.
- `finish` (`build-plan-state-store.ts:7-10`) atualiza incondicionalmente a linha por tenant/plano/step; não há guarda contra sobrescrever `SUCCEEDED`/`BLOCKED` ou contra transições inválidas.

**Conclusão Wave 10:** a constraint única fecha apenas a corrida de claim simultâneo. Não fecha o bloqueio anterior de boundary de entrega fail-closed nem impede reabertura de estado terminal.

## Secrets e logging

Busca textual read-only nos arquivos alterados por `sk-`, `api[_-]?key`, `secret`, `password`, `Bearer`, `console.` e `logger.` não encontrou secret hardcoded ou logging sensível.

## Veredito final dos dois bloqueios

- Wave 9 Repair Loop: **BLOCKED** — persistência presente, mas `BLOCKED`/`SUCCEEDED` podem ser reclamados e o limite persistido não é enforced.
- Wave 10 Delivery Gate: **BLOCKED** — claim concorrente melhorado, mas gate terminal e execução obrigatória ainda não existem; estados podem ser reabertos.

Resposta: **não, os dois últimos bloqueios do dia não estão fechados**. A migration e a constraint única são necessárias, mas insuficientes com o `claim` atual e sem uma boundary de entrega efetiva.

SELF-CHECK: PASS — HEADs e migration confirmados, revisão focada na persistência nova, sem testes/build/migration/merge/efeito externo.
