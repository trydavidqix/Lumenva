# Voice Core Evidence — índice canônico

Evidência da implementação na branch `implementacao-tokens-voice-core`.

## Leia nesta ordem

1. `docs/handoffs/HANDOFF-voice-core.md` — ponto de entrada para continuação por outro agente.
2. `implementation-status.md` — estado task-by-task e distinção entre código implementado e ativação externa.
3. `lumenva-voice-engine-final.md` — arquitetura final, invariantes, checkpoints e Definition of Done realista.
4. `patter-adoption-baseline.md` — baseline e classificação KEEP/ADAPT/REPLACE/OPTIONAL.
5. `patter-equivalence.md` — equivalência e decisões de substituição/retenção.

## Hierarquia documental

- Master plan: `docs/superpowers/plans/2026-08-23-implementacao-tokens-master-plan.md`.
- Spec original do núcleo: `docs/superpowers/plans/2026-08-26-nucleo-ligacao-integration-plan.md`.
- Plano vigente da implementação de voz: `docs/superpowers/plans/2026-08-27-lumenva-voice-engine-patter-plan.md`.
- Branch pai conceitual: `implementacao-tokens`.
- Branch isolada desta implementação: `implementacao-tokens-voice-core`.
- Integration target deste trabalho **não é `main`** sem autorização explícita.

O plano de 2026-08-26 contém arquitetura histórica com LiveKit no caminho obrigatório. Essa parte foi deliberadamente superada pelo plano Patter de 2026-08-27 e pelo código atual: LiveKit é opcional para browser-human takeover; o caminho normal usa Lumenva Voice Worker + Patter + Telnyx e continua terminando no Agent OS canônico.

## Gate canônico

```bash
bash scripts/verify-voice-core.sh
```

O gate cobre TypeScript, testes/evals focados de voz, syntax/tests do worker, tenant binding, tenant isolation lint e Next.js build.

**Importante:** o HEAD atual precisa de uma execução fresca desse comando antes de qualquer agente afirmar `final-green`. Em 2026-08-27 o runner Vercel estava bloqueado por `build-rate-limit` no projeto CRM e por acesso/team invite no projeto secundário. Isso é bloqueio de runner, não evidência de aprovação ou reprovação do código.

## Invariantes que não podem regredir

- voz é canal do Agent OS, não um novo Agent OS;
- organização é resolvida antes do Caller ID;
- Customer Memory é compartilhada com os outros canais;
- todo LLM passa pelo seam/model router canônico;
- Patter não recebe tools nem autoridade de negócio;
- outbound é governado por contact + agent + goal, nunca `number + arbitrary text` público;
- worker é preso ao seu número técnico/tenant em todo turno e lifecycle;
- `voice_worker_endpoints` é service-only;
- terminal call state e `provider_call_id` são protegidos contra eventos tardios/conflitantes;
- recording é opt-in/fail-closed;
- LiveKit não volta ao caminho obrigatório sem nova decisão arquitetural explícita.