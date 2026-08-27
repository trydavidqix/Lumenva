# Estado atual — Voice Core

**Data:** 2026-08-27  
**Repo:** `trydavidqix/CRM`  
**Branch:** `implementacao-tokens-voice-core`  
**Escopo:** somente Núcleo de Ligação / Lumenva Voice Engine.

> `docs/current-state.md` é um snapshot global mais antigo do CRM e não representa o estado atual do Voice Core. Para voz, este arquivo + `docs/handoffs/HANDOFF-voice-core.md` são as referências atuais.

## Estado resumido

O Voice Core foi implementado como canal de voz do Agent OS existente. O CRM continua sendo a fonte de verdade para tenant, cliente, memória, agentes, modelos, tools, políticas, handoff e auditoria.

```text
Cliente/PSTN
  -> Telnyx
  -> Lumenva Voice Worker persistente
       -> Patter OSS (mídia)
       -> Deepgram STT
       -> ElevenLabs TTS
  -> CRM control plane autenticado
  -> tenant por número técnico
  -> Caller ID tenant-scoped
  -> Customer Memory
  -> Agent Kernel/Product Agents
  -> runModelCall / policies / Tool Gateway
  -> resposta customer-safe -> TTS
```

LiveKit não participa do caminho normal de IA; permanece opcional para takeover humano no navegador.

## Implementado

- `VoiceEngine` provider-neutral e factory;
- Patter encapsulado como implementation detail substituível;
- worker persistente em `workers/voice-worker/**`;
- Telnyx + Deepgram + ElevenLabs no adapter atual;
- tenant resolution por `voice_phone_numbers`;
- registry privado `voice_worker_endpoints` com RLS e revogação explícita de tenant roles;
- Caller ID tenant-scoped + Customer Memory;
- control plane interno worker -> CRM;
- binding de worker ao seu número técnico em turnos e lifecycle;
- Agent Kernel canônico para voz, sem segundo LLM runtime;
- delivery governance: `off/shadow/draft` não falam externamente;
- outbound governado por `contact_id + agent_id + goal`;
- correlação outbound `voice_call_id -> provider_call_id`;
- transferência humana em duas fases;
- lifecycle terminal imutável e provider_call_id protegido;
- gravação fail-closed por política;
- métricas/custos provider-neutral;
- painel base `Agente de Ligação`;
- simulador provider-free + safety evals;
- healthcheck, non-root e graceful shutdown do worker.

## Verificação

Gate canônico:

```bash
bash scripts/verify-voice-core.sh
```

Há checkpoints anteriores verdes documentados em `docs/evidence/implementacao-tokens/voice-core/lumenva-voice-engine-final.md`.

O HEAD mais recente ainda precisa de execução fresca do gate completo. O runner Vercel observado estava bloqueado externamente por `build-rate-limit` no CRM e team invite/access no projeto secundário. Não interpretar isso como teste verde ou vermelho.

## Ativação externa pendente

Não é dívida arquitetural de código:

- credenciais/conta/número Telnyx reais;
- deploy persistente do Voice Worker;
- Deepgram/ElevenLabs reais ou adapters substitutos;
- URLs públicas/control-plane e secrets;
- promoção de Product Agents pela governance normal;
- `VOICE_LIVE_ENABLED=true` somente após gates;
- chamada PSTN inbound/outbound real;
- transferência humana real;
- medição real de custo/latência;
- autorização legal/operacional de recording.

## Próxima ação

O próximo agente deve começar em `docs/handoffs/HANDOFF-voice-core.md`, rodar o gate em um runner funcional e, se o código permanecer verde, seguir para provisionamento/ativação real. Não redesenhar o núcleo a partir do plano histórico LiveKit-first.
