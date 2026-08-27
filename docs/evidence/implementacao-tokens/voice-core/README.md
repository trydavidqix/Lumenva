# Voice Core Evidence — índice canônico

Evidência da implementação na branch `implementacao-tokens-voice-core`.

## Leia nesta ordem

1. `docs/handoffs/HANDOFF-voice-core.md` — ponto de entrada para Claude/próximo agente.
2. `docs/current-state-voice-core.md` — snapshot atual de voz.
3. `implementation-status.md` — estado task-by-task e distinção entre código e ativação externa.
4. `lumenva-voice-engine-final.md` — arquitetura final, invariantes, checkpoints e DoD realista.
5. `docs/superpowers/plans/2026-08-27-voice-core-canonical-status.md` — mapa de supersessão dos planos históricos.
6. `patter-adoption-baseline.md` — KEEP/ADAPT/REPLACE/OPTIONAL.
7. `patter-equivalence.md` — equivalência e decisões de substituição/retenção.

## Hierarquia documental

- Estado atual Voice Core: `docs/current-state-voice-core.md`.
- Status canônico/supersessão: `docs/superpowers/plans/2026-08-27-voice-core-canonical-status.md`.
- Plano vigente da implementação de voz: `docs/superpowers/plans/2026-08-27-lumenva-voice-engine-patter-plan.md`.
- Spec original/histórica: `docs/superpowers/plans/2026-08-26-nucleo-ligacao-integration-plan.md`.
- Master plan/panorama: `docs/superpowers/plans/2026-08-23-implementacao-tokens-master-plan.md`.
- Branch pai conceitual: `implementacao-tokens`.
- Branch isolada vigente: `implementacao-tokens-voice-core`.
- `main` não é integration target sem autorização explícita.

`docs/current-state.md` é um snapshot global antigo e não deve ser usado para decidir o estado atual do Voice Core.

O plano de 2026-08-26 contém arquitetura histórica com LiveKit obrigatório. Essa parte foi superada: LiveKit é opcional para browser-human takeover; o caminho normal usa Lumenva Voice Worker + Patter + Telnyx e termina no Agent OS canônico.

## Gate canônico

```bash
bash scripts/verify-voice-core.sh
```

Cobre TypeScript, testes/evals focados de voz, syntax/tests do worker, tenant binding, tenant isolation lint e Next build.

**Importante:** o HEAD documental mais recente precisa de execução fresca desse comando antes de qualquer agente afirmar `final-green`. Em 2026-08-27 o runner Vercel estava bloqueado por `build-rate-limit` no CRM e por acesso/team invite no projeto secundário. Isso é bloqueio de runner, não evidência de aprovação ou reprovação do código.

## Invariantes que não podem regredir

- voz é canal do Agent OS, não novo Agent OS;
- organização é resolvida pelo número técnico antes do Caller ID;
- Customer Memory é compartilhada com outros canais;
- todo LLM passa pelo seam/model router canônico;
- Patter não recebe tools nem autoridade de negócio;
- outbound é governado por `contact + agent + goal`, nunca `number + arbitrary text` público;
- worker é preso ao seu número técnico/tenant em todo turno e lifecycle;
- `voice_worker_endpoints` é service-only;
- terminal call state e `provider_call_id` são imutáveis contra eventos tardios/conflitantes;
- recording é opt-in/fail-closed;
- LiveKit não volta ao caminho obrigatório sem nova decisão arquitetural explícita.
