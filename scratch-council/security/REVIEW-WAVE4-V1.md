# Review de segurança — Wave 4 Event → Wake V1

Data: 2026-09-12  
Alvo: commit Fornalha `825324ad` (`feat(wave4): add fail-safe event wake`), worktree `wave4/browsermesh-wake-2026-09-12`.

## Escopo

Revisão estática read-only via SSH no worker `claude@192.168.1.78`, usando `~/.ssh/lumenva_worker`. Arquivos: `apps/crm/lib/agent-engine/wave4/event-wake.ts` e `event-wake.test.ts`. Nenhum código/teste/build foi executado; nenhum merge ou efeito externo.

## Veredito

**FAIL / BLOCKED para boundary exposta.** O caminho sem worker apto é queueable e não lança, mas o evento não tem autenticação/autorização de origem suficiente para impedir wake forjado.

### Fila e tratamento de ausência

**PASS local:** quando não há capability, tenant ou policy match, `wakeEvent()` retorna `status: "QUEUED"` com o evento e motivo (`event-wake.ts:33-48`). O teste cobre capability ausente, tenant mismatch e lista de workers vazia (`event-wake.test.ts:13-21`). Não há descarte silencioso nem `throw` nesse caminho nominal.

Limite: para `event`/`policy` ausentes ou malformed, a função também retorna `QUEUED` carregando o valor recebido (`:33-38`), inclusive `undefined` em runtime. Isso evita crash, mas pode enfileirar envelope inválido; a fila/caller precisa validar schema antes de persistir.

### Evento forjado / autorização

**FAIL — não há actor, assinatura, source ou idempotency key no `WakeEvent`.** O contrato contém apenas `event_id`, `organization_id`, `required_capability` e `payload` (`:3-8`). Qualquer caller que consiga invocar a função pode fabricar um evento com `organization_id` igual ao da policy e uma capability válida; a função o encaminhará ao worker. `WakePolicy` valida apenas organization e uma allowlist opcional de worker IDs (`:18-20`, `:46-48`), não a autoridade do emissor.

Mesmo com capability do worker validada e `available === true`, isso não prova que o evento foi emitido por actor autorizado nem que o actor tinha a capability. O teste não cobre actor ausente/mismatch, assinatura inválida, replay de `event_id` ou origem não confiável.

### Conclusão e ação

O algoritmo fecha o caso “sem worker apto” como `QUEUED`, mas não fecha a fronteira de confiança. Antes de promoção, adicionar validação upstream/na função para actor autenticado, organization derivada de fonte confiável, capability autorizada do actor, assinatura/source e idempotência/replay; rejeitar envelopes inválidos em vez de enfileirá-los cegamente. Manter teste de fila e acrescentar cenários de evento forjado e payload/schema inválido.

SELF-CHECK: PASS — inspeção read-only, sem secrets expostos, sem execução, merge ou download.
