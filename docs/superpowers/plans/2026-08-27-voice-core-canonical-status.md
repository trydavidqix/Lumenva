# Voice Core — status canônico e mapa de supersessão

**Data:** 2026-08-27  
**Repo:** `trydavidqix/CRM`  
**Branch vigente:** `implementacao-tokens-voice-core`  
**Último checkpoint de código desta implementação (Telnyx/Deepgram/ElevenLabs):** `cabfbec422aea370252a6909c28204306177ed65`  
**Último checkpoint do repositório (Fase 1/2 do plano open-source, aditivas):** `ad8e027d`  
**Não mergear para `main` sem autorização explícita.**

## Por que este documento existe

O Voice Core nasceu a partir do plano mestre de `implementacao-tokens` e do plano de integração de 2026-08-26, mas a arquitetura evoluiu durante a implementação após a avaliação do Patter OSS. Este documento resolve qualquer divergência entre planos históricos e o código/evidência atuais.

**Atualização 2026-08-27 (mesmo dia, sessão posterior ao gate verde):** o dono do repositório
aprovou `docs/superpowers/plans/2026-08-27-voice-open-source-europe-plan.md` como o plano canônico
para a PRÓXIMA fase do Voice Core — Telnyx/Deepgram/ElevenLabs/número técnico dão lugar a
Asterisk-ARI/SIP-BYOC/faster-whisper/Piper-Kokoro/OpenVoice. **Fase 1 e Fase 2 já implementadas**
(`f672eb78`, `ad8e027d`): perfil de voz no `VoiceEngine`, adapter Pipecat scaffold, `SipGateway`,
adapter Asterisk/ARI, resolução conexão→número→organização. São primitivas novas, aditivas — o
worker de PRODUÇÃO ainda roda a arquitetura Telnyx/Deepgram/ElevenLabs descrita abaixo, sem
nenhuma mudança. Não redesenhar/descartar os contratos e testes existentes ao seguir esse plano;
o `VoiceEngine` provider-neutral é reaproveitado, não recriado.

Para decisões de Voice Core, a ordem de autoridade documental é:

1. `docs/handoffs/HANDOFF-voice-core.md`
2. `docs/superpowers/plans/2026-08-27-voice-open-source-europe-plan.md` — plano canônico da PRÓXIMA fase (SIP/BYOC open-source), aprovado 2026-08-27, Fase 1/2 implementadas (`ad8e027d`), Fase 3+ pendente
3. `docs/evidence/implementacao-tokens/voice-core/implementation-status.md`
4. `docs/evidence/implementacao-tokens/voice-core/lumenva-voice-engine-final.md`
5. este documento — descreve a arquitetura ATUALMENTE implementada (Telnyx/Deepgram/ElevenLabs)
6. `docs/superpowers/plans/2026-08-27-lumenva-voice-engine-patter-plan.md`
7. `docs/superpowers/plans/2026-08-26-nucleo-ligacao-integration-plan.md` — histórico/spec pai
8. `docs/superpowers/plans/2026-08-23-implementacao-tokens-master-plan.md` — panorama maior do CRM

Código + evidência recente vencem qualquer texto histórico divergente.

## Arquitetura vigente

```text
PSTN
  -> Telnyx
  -> Lumenva Voice Worker persistente
       -> Patter OSS como implementation detail de mídia
       -> Deepgram STT (adapter atual)
       -> ElevenLabs TTS (adapter atual)
       -> VAD / barge-in / recording transport
       -> CRM control plane autenticado
  -> número técnico resolve organização
  -> Caller ID tenant-scoped
  -> Customer Memory
  -> Agent Kernel / Product Agents canônicos
  -> runModelCall / model seam canônico
  -> Tool Gateway / policies / handoff
  -> texto customer-safe volta ao worker para TTS
```

### LiveKit

**SUPERSEDED:** qualquer desenho histórico que torne LiveKit obrigatório no caminho normal IA <-> cliente.

**VIGENTE:** LiveKit é opcional e reservado ao browser-human takeover. Chamada normal de IA não depende de LiveKit.

### Patter

**VIGENTE:** Patter é uma implementação substituível dentro do Lumenva Voice Worker. Não é fonte de verdade, não escolhe tenant, não recebe CRM tools, não escolhe LLM e não governa autonomia.

### Agent OS

**VIGENTE:** voz é apenas mais um canal do Agent OS. Não existe `Voice Agent`, `Sales Voice Agent` ou segundo runtime LLM.

## Mapa de supersessão dos planos históricos

### Plano mestre — 2026-08-23

O panorama de produto continua válido. Para a parte de voz, aplicar estas correções:

- Fase 5: STT/TTS/VAD/barge-in ficam atrás do Lumenva Voice Engine/Patter-backed worker; não construir media runtime paralelo sem necessidade demonstrada.
- Fase 6: substituir o caminho obrigatório `Telnyx -> LiveKit -> Voice Agent` por `Telnyx -> Lumenva Voice Worker/Patter -> Agent OS`.
- LiveKit Cloud passa a ser opcional para takeover humano no navegador.
- Fase 7 Caller ID continua válida, com regra mais forte: número técnico Telnyx resolve organização **antes** do telefone do cliente.
- Fase 10 transferência humana continua válida, mas usa semântica em duas fases: bridge confirmada primeiro, IA silenciada depois.
- Fase 13 painel continua válida e já possui base `Agente de Ligação` tenant-scoped.
- Fases de observabilidade/evals continuam válidas e agora incluem custos/latências/lifecycle de voz.

O master plan continua sendo o panorama do CRM; ele **não** é a spec executável atual do Voice Core.

### Plano de integração — 2026-08-26

É uma spec histórica útil para contratos, persistência, config, tenant identity e objetivo de não duplicar Agent OS. Foram superados:

- Task 6: LiveKit não é transporte obrigatório da IA.
- Task 7: Telnyx não precisa routear inbound para LiveKit no caminho default.
- Task 9: transferência humana não depende obrigatoriamente de LiveKit; transport é provider-neutral e confirma takeover antes de silenciar IA.
- Definition of Done que exige `estabelecer sessão LiveKit` para chamada normal foi substituída pela DoD do plano Patter/evidência final.

### Plano Patter — 2026-08-27

É o plano executável mais recente. As 12 tasks possuem estado detalhado em `implementation-status.md`. Não usar os checkboxes `[ ]` do documento original como indicador de pendência: o estado canônico task-by-task está no arquivo de status/evidência, pois a implementação evoluiu em commits posteriores.

## Estado de implementação

- VoiceEngine provider-neutral: implementado.
- Patter adapter/factory: implementado.
- Voice Worker persistente: implementado.
- Telnyx tenant-first: implementado.
- Caller ID + Customer Memory: implementado.
- Agent Kernel bridge + delivery governance: implementado.
- Product Agents `shadow/draft/off`: fail-closed para TTS.
- Outbound governado: implementado; cliente não fornece número bruto ou mensagem arbitrária.
- Pending outbound correlation: implementada.
- Transferência humana em duas fases: implementada.
- LiveKit opcional: implementado como fronteira de browser takeover.
- Recording/métricas/lifecycle: implementados com fail-closed de consent/disclosure.
- Painel base `Agente de Ligação`: implementado.
- Simulador provider-free/evals: implementados.
- Worker healthcheck/non-root/graceful shutdown: implementados.
- Binding worker -> número técnico -> organização -> call: implementado.
- `voice_worker_endpoints`: service-only, RLS + `REVOKE ALL` para tenant roles.
- Terminal lifecycle e provider_call_id: protegidos contra evento tardio/conflitante.

## Verificação

Comando autoritativo:

```bash
bash scripts/verify-voice-core.sh
```

Checkpoints verdes anteriores estão documentados em `lumenva-voice-engine-final.md`.

O HEAD documental/código mais recente ainda exige uma execução fresca do gate completo antes de ser chamado `final-green`. No fechamento desta sessão o runner Vercel estava bloqueado por:

- CRM: `build-rate-limit`;
- projeto secundário: team invite/access.

Isso é bloqueio externo de runner, não resultado de teste.

## O que é ativação externa, não dívida de implementação

- provisionar Telnyx real e número técnico;
- hospedar Voice Worker persistente por número técnico;
- registrar `voice_phone_numbers` e `voice_worker_endpoints`;
- configurar Telnyx/Deepgram/ElevenLabs/INTERNAL_SECRET/URLs;
- promover Product Agents autorizados pela governance normal;
- ativar `VOICE_LIVE_ENABLED` somente depois dos gates;
- executar PSTN inbound/outbound real;
- validar transfer real;
- capturar latência/custo/provider IDs reais;
- recording somente após política/consentimento/disclosure aplicáveis.

Esses itens não autorizam enfraquecer RLS, delivery policy, tenant binding ou autonomia.

## Regra para Claude/qualquer próximo agente

1. Trabalhar na `implementacao-tokens-voice-core`.
2. Ler `docs/handoffs/HANDOFF-voice-core.md` primeiro.
3. Rodar o gate completo em runner funcional antes de declarar verde.
4. Não redesenhar o Voice Core com base no plano antigo.
5. Não promover agents de `shadow` para fazer teste passar.
6. Não expor worker URL, número arbitrário ou first message arbitrária ao cliente.
7. Não mergear `main` sem autorização explícita.
8. Atualizar `implementation-status.md`, `lumenva-voice-engine-final.md` e `HANDOFF-voice-core.md` após qualquer mudança relevante.
