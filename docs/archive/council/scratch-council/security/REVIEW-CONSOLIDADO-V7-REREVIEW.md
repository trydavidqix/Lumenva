# Re-revisão read-only — estado atual dos fixes Wave 9, 10 e 12

Data: 2026-09-13  
Escopo: somente os três fixes que fecharam bloqueios anteriores. Worktrees e SHAs atuais confirmados no worker; sem build, testes, merge, deploy ou efeitos live.

## Wave 9 — Repair Loop terminal

Worktree: `/home/claude/src/worktrees/wave9-product-factory-2026-09-12`  
HEAD: `fd6e3f3d9f1ab596dbbf7121ec008cde6881ad63` — `fix(wave9): persist terminal repair blocks`

**Veredito: BLOCKED — o fix fecha apenas reentrada sequencial no mesmo processo, não terminalidade durável nem concorrente.**

Evidência atual:

- `apps/crm/lib/product-factory/build-plan.ts:40-52` calcula uma chave e rejeita plano já `BLOCKED_EXTERNAL`, passo `BLOCKED` ou chave presente em `terminallyBlockedPlans`.
- `:37-38` implementa `terminallyBlockedPlans` como `new Set<string>()` em memória do módulo.
- `:73` adiciona a chave ao Set ao esgotar tentativas.
- O teste novo `apps/crm/tests/unit/product-factory-build-plan.test.ts:75-88` confirma que o plano original e um replay sequencial com a mesma chave não executam novamente.

O bloqueio anterior não está totalmente fechado: o Set desaparece ao reiniciar o processo/worker e não é um estado persistido por `build_plan_id`/idempotency key. Duas chamadas concorrentes podem passar pela checagem antes de qualquer uma inserir a chave no Set e ambas executar o executor. O teste novo não cobre restart, persistência, concorrência ou race.

**Classificação: BLOCKED.** Necessita store durável e operação atômica/lock (ou transação idempotente) que reserve o orçamento e o estado terminal antes da execução.

## Wave 10 — Delivery gate fail-closed

Worktree: `/home/claude/src/worktrees/wave10-mobile-delivery-2026-09-13`  
HEAD: `affbc7516bab6be3beff03164496272d87322e95` — `fix(wave10): fail closed unknown delivery channels`

**Veredito: BLOCKED — fecha somente o caso de canal desconhecido; não fecha a boundary de entrega.**

Evidência atual:

- `apps/crm/lib/product-factory/delivery.ts:27-38` adiciona `DELIVERY_CHANNELS` e rejeita qualquer canal fora da allowlist com `unsupported delivery channel`.
- O teste `apps/crm/tests/unit/product-factory-delivery.test.ts:27-35` prova rejeição de `FUTURE_CHANNEL`.
- O teste `:20-25` percorre os cinco canais conhecidos e confirma que a mesma validação de evidência é aplicada.

O bloqueio anterior permanece:

- `validateDeliveryPlan` continua sendo somente predicado; não há executor/dispatcher que impeça entrega quando o retorno é inválido.
- Nenhuma checagem exige `plan.status === "APPROVED"` ou `"PACKAGED"`; `DRAFT`, `FAILED` e `BLOCKED_EXTERNAL` continuam não rejeitados pela função.
- Não há gate específico de capability/approval/provider/credential/environment nem compatibilidade canal/plataforma.

**Classificação: BLOCKED.** O unknown-channel bypass foi fechado, mas não é seguro afirmar que nenhum canal entrega sem gate até existir uma boundary de execução fail-closed.

## Wave 12 — Freshness Engine / data futura

Worktree: `/home/claude/src/worktrees/wave12-marketing-content-2026-09-13`  
HEAD: `532ff4bad1f32c48e6cd895607df3bf86de60c4b` — `fix(marketing): reject future content timestamps`

**Veredito: PASS para o bloqueio específico de timestamp futuro.**

Evidência atual:

- `apps/crm/lib/knowledge/freshness-engine.ts:20-24` agora exige `generatedMs <= nowMs` além de timestamps finitos antes de classificar como `current`; data futura cai em `stale`.
- O teste novo `apps/crm/lib/knowledge/freshness-engine.test.ts:38-44` usa `generatedAt` em `2026-09-14` com `now` em `2026-09-13` e exige `stale`.
- Timestamps inválidos já caíam em `stale` por `Number.isFinite(generatedMs)` (`:19-24`), portanto não há retorno ao fail-open anterior.

O fix fecha o bloqueio concreto identificado na revisão V5. Permanecem fora deste fix a durabilidade do ledger em memória e a prova de integração sistêmica, mas não impedem o veredito PASS para a condição de data futura.

## Veredito consolidado

- Wave 9 Repair Loop terminal: **BLOCKED** — Set apenas em memória e sem proteção concorrente.
- Wave 10 delivery gate: **BLOCKED** — allowlist de canais corrigida, mas execução/status/gates de aprovação continuam desacoplados.
- Wave 12 Freshness Engine: **PASS** — `generatedMs <= nowMs` e teste regressivo fecham o fail-open de data futura.

SELF-CHECK: PASS — estados atuais e SHAs confirmados, revisão nova focada nos fixes, sem mutação remota e sem execução de testes/build.
