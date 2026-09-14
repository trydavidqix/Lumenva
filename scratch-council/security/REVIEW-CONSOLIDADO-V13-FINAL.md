# Re-revisão final — Wave 9 atomicidade e Wave 10 dependência do mesmo fix

Data: 2026-09-13  
Método: inspeção read-only via SSH no worker, dos HEADs atuais, SQL e código de claim. Não foram executados testes, build, processos concorrentes ou migrations.

## Estado atual

- Wave 9: `/home/claude/src/worktrees/wave9-product-factory-2026-09-12`, HEAD `0b1b9d46493f74d5897a72126f29d9d8cfd1c31b` — `fix(wave9): reserve repair attempts atomically`.
- Wave 10: `/home/claude/src/worktrees/wave10-mobile-delivery-2026-09-13`, HEAD `b83cfb74acb55e635a007de14760f75273b38b7a` — `feat(wave10): persist delivery gate state in postgres`.
- Migration comum presente nas linhas anteriores: `supabase/migrations/20260913000000_build_plan_state.sql`, com unique `(tenant_id, plan_id, step_id)`.

## Wave 9 — Repair Loop

**Veredito: PASS condicional no caminho Postgres; não PASS absoluto enquanto `stateStore` continuar opcional.**

O fix atual melhora os dois bloqueios anteriores:

- `build-plan.ts:70-81` lê o estado persistido antes de decidir; `BLOCKED` é rejeitado e `attempts >= maxAttempts` é convertido em `BLOCKED` persistido.
- `build-plan-state-store.ts:9-11` usa uma única instrução `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`. A atualização só ocorre quando o estado existente não é `RUNNING`; a constraint única serializa o claim por tenant/plano/step. Isso impede dois claims simultâneos da mesma linha `RUNNING`.
- Após cada falha, `build-plan.ts:80` grava `FAILED`; a próxima reserva incrementa `attempts` atomicamente. O limite é lido do contador persistido, não de um contador local.
- Um restart que encontre `BLOCKED` no banco cai em `build-plan.ts:71-72` e não executa o executor novamente.

Ressalvas que impedem “fecha de vez” sem condição:

- `repairFailedBuildPlan` aceita `stateStore?` (`build-plan.ts:49`). Quando omitido, segue o ramo em memória (`:58-67`) com `terminallyBlockedPlans`; restart e concorrência deixam de ter garantia durável.
- O commit atual não adiciona teste de dois processos/duas conexões reais. A atomicidade é inferida da instrução SQL e da constraint; permanece prova de código, não evidência de execução concorrente.
- `finish` pode ser chamado sem guarda de versão/owner; a boundary superior precisa impedir que um executor atrasado sobrescreva estado de outra tentativa.

**Classificação Wave 9:** **PASS CONDICIONAL** se a produção tornar `stateStore` obrigatório e usar Postgres real; **BLOCKED** para uma API que permita fallback silencioso em memória.

## Wave 10 — Delivery Gate

**Veredito: BLOCKED — precisa da mesma implementação atômica/leitura persistida e ainda não a possui no HEAD atual.**

- O `BuildPlanStateStore` em Wave 10 (`build-plan-state-store.ts:3-5`) continua com `where build_plan_state.status <> 'RUNNING'`, sem `get`, sem contador persistido lido e sem reserva de attempts como no Wave 9 final.
- `delivery.ts:59-75` chama `claim` e `finish`, mas não rejeita previamente `BLOCKED`/`SUCCEEDED`; uma chamada posterior pode reabrir o estado terminal.
- A unique constraint reduz duplicidade de linha, mas não corrige a semântica permissiva do `claim` nem cria uma transição terminal imutável.
- A função continua sendo validação + gravação de estado, não uma operação de entrega obrigatória; não exige status `APPROVED`/`PACKAGED` nem receipt/commit da entrega.

**Classificação Wave 10:** **BLOCKED**. Deve importar a versão final do `BuildPlanStateStore`, rejeitar estados terminais no SQL e acoplar o claim/finish à boundary efetiva de delivery. Sem isso, Wave 10 continua com o mesmo bloqueio anterior.

## Secrets e logging

Busca textual read-only nos arquivos novos/modificados por `sk-`, `api[_-]?key`, `secret`, `password`, `Bearer`, `console.` e `logger.` não encontrou secret hardcoded ou logging sensível.

## Veredito final

- Wave 9: **PASS CONDICIONAL** no caminho Postgres atômico; **BLOCKED** se o fallback sem `stateStore` permanecer autorizado ou se a alegada prova concorrente não for realmente executada.
- Wave 10: **BLOCKED**; precisa da mesma correção atômica e da boundary de entrega fail-closed.

Resposta: **não, os dois bloqueios do dia não estão fechados de forma definitiva**. A Wave 9 está tecnicamente próxima do fechamento no caminho Postgres, mas Wave 10 ainda usa o store antigo e a API de Wave 9 ainda permite fallback em memória.

SELF-CHECK: PASS — HEADs atuais, SQL e divergência entre worktrees confirmados; sem testes/build/processos concorrentes/migration/merge/efeito externo.
