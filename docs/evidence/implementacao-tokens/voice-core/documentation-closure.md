# Voice Core — documentation closure

**Data:** 2026-08-27  
**Branch:** `implementacao-tokens-voice-core`

Este arquivo existe para eliminar ambiguidade documental antes da continuação por Claude/qualquer outro agente.

## Documentos vigentes

| Documento | Papel |
|---|---|
| `docs/handoffs/HANDOFF-voice-core.md` | Entrada canônica para continuação. |
| `docs/current-state-voice-core.md` | Snapshot atual do Voice Core. |
| `docs/evidence/implementacao-tokens/voice-core/implementation-status.md` | Estado task-by-task. |
| `docs/evidence/implementacao-tokens/voice-core/lumenva-voice-engine-final.md` | Evidência técnica e Definition of Done. |
| `docs/superpowers/plans/2026-08-27-voice-core-canonical-status.md` | Mapa de supersessão e arquitetura vigente. |
| `docs/superpowers/plans/2026-08-27-lumenva-voice-engine-patter-plan.md` | Plano que originou a implementação atual. |
| `docs/evidence/implementacao-tokens/voice-core/patter-adoption-baseline.md` | Baseline histórico da adoção Patter. |
| `docs/evidence/implementacao-tokens/voice-core/patter-equivalence.md` | Evidência de equivalência/reuso. |
| `docs/evidence/implementacao-tokens/voice-core/README.md` | Índice de toda a evidência. |

## Documentos históricos — não são backlog vigente

### `docs/superpowers/plans/2026-08-26-nucleo-ligacao-integration-plan.md`

Preservado como spec/histórico. Os checkboxes `[ ]` e a arquitetura LiveKit-first **não representam trabalho pendente atual**. A implementação foi redirecionada formalmente para o plano Patter/Lumenva. Consulte `2026-08-27-voice-core-canonical-status.md` para o mapa exato de supersessão.

### `docs/superpowers/plans/2026-08-23-implementacao-tokens-master-plan.md`

Continua sendo panorama de produto do CRM. A parte de voz é conceitual/histórica e foi refinada pela arquitetura Lumenva Voice Engine. O master plan não deve sobrescrever a spec atual de voz.

### `docs/current-state.md`

É snapshot global anterior. Não representa o estado atual do Voice Core. Use `docs/current-state-voice-core.md`.

## Sobre os checkboxes do plano Patter

O arquivo `2026-08-27-lumenva-voice-engine-patter-plan.md` foi escrito antes da execução e mantém checkboxes de planejamento originais. **Não usar esses `[ ]` como fonte de estado.**

A fonte de estado task-by-task é `implementation-status.md`, que classifica cada task como:

- `IMPLEMENTADA`;
- `IMPLEMENTADA / ATIVAÇÃO GOVERNADA`;
- `IMPLEMENTADA / PROVA PSTN EXTERNA PENDENTE`;
- `IMPLEMENTADA PROVIDER-FREE / PROVA PSTN EXTERNA PENDENTE`.

Isso preserva o plano original como registro de intenção e mantém o estado de execução separado da história do documento.

## Pendência de código vs ativação externa

Não há backlog arquitetural de Voice Core escondido na documentação atual. O que resta antes de `VERIFIED LIVE` é explicitamente externo/operacional:

- runner funcional para gate fresco do HEAD;
- Telnyx/número/credenciais reais;
- worker persistente hospedado;
- STT/TTS reais ou adapters substitutos;
- Product Agent promovido pela governance normal;
- PSTN inbound/outbound real;
- transfer real;
- custos/latências reais;
- política de recording/consentimento.

Nenhum desses itens autoriza alterar os invariantes arquiteturais para “terminar” mais rápido.

## Estado do CI no fechamento

O status GitHub/Vercel mais recente observado estava bloqueado por infraestrutura:

- `Vercel – crm`: `build-rate-limit`;
- `Vercel – lumenva-website`: team invite/access.

Por isso o HEAD documental mais recente não deve ser chamado `final-green` sem uma nova execução de:

```bash
bash scripts/verify-voice-core.sh
```

## Instrução final para Claude

Começar pelo `HANDOFF-voice-core.md`, não pelos planos históricos. Se o gate fresco passar, seguir para ativação/provisionamento real. Se falhar por código, corrigir na mesma branch e atualizar os documentos vigentes acima. Não mergear `main` sem autorização explícita.
