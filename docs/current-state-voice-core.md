# Estado atual — Voice Core

**Data:** 2026-08-27  
**Repo:** `trydavidqix/CRM`  
**Branch:** `implementacao-tokens-voice-core`  
**Escopo:** somente Núcleo de Ligação / Lumenva Voice Engine.

> `docs/current-state.md` é um snapshot global mais antigo do CRM e não representa o estado atual do Voice Core. Para voz, este arquivo + `docs/handoffs/HANDOFF-voice-core.md` são as referências atuais.

**Atualização 2026-08-27:** Fase 1 e Fase 2 do plano open-source SIP/BYOC
(`docs/superpowers/plans/2026-08-27-voice-open-source-europe-plan.md`) já foram implementadas
(`f672eb78`, `ad8e027d`) — perfil de voz no `VoiceEngine`, adapter Pipecat scaffold, `SipGateway`,
adapter Asterisk/ARI, resolução conexão→número→organização, migration `voice_sip_connections`.
São primitivas novas, aditivas — **o worker de produção descrito abaixo continua rodando
Patter/Telnyx/Deepgram/ElevenLabs sem nenhuma mudança**; a substituição do worker é Fase 3+.

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
- healthcheck, non-root e graceful shutdown do worker;
- cliente ARI real do Asterisk (REST + WebSocket), `lib/voice/sip/asterisk-ari-client.ts`
  (`createAsteriskAriConnection`), implementando `AriClient` e estendendo com `AriConnection` —
  ver nota 2026-08-28 no plano canônico e `workers/voice-sip-worker/README.md`. Testado contra
  servidor ARI falso local real (não mock de função); sem Asterisk real conectado nesta sessão.

## Verificação

Gate canônico:

```bash
bash scripts/verify-voice-core.sh
```

Há checkpoints anteriores verdes documentados em `docs/evidence/implementacao-tokens/voice-core/lumenva-voice-engine-final.md`.

Gate rodado localmente em `ad8e027d` (2026-08-27): typecheck limpo, 35 arquivos/124 testes
(vitest) verdes, worker 3/3 verde, `lint:tenant-filter` ok, `next build` limpo. O runner Vercel
segue bloqueado externamente por `build-rate-limit`/team-invite — irrelevante enquanto a
verificação local continuar sendo a prova primária (`docs/current-state.md` §10).

Gate rerodado localmente em 2026-08-28 (após o cliente ARI): typecheck limpo, gate completo
(`bash scripts/verify-voice-core.sh`) verde incluindo o teste novo
(`lib/voice/sip/asterisk-ari-client.test.ts`, 8 testes contra servidor HTTP+WS local real) e o
smoke test do listener (`npx tsx workers/voice-sip-worker/ari-listener.smoke.mjs`), sem tocar
`main.mjs`. Estado: `IMPLEMENTED` + `VERIFIED PROVIDER-FREE` para essa fatia — nunca
`VERIFIED LIVE`, não há Asterisk real alcançável desta sessão.

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

O próximo agente deve começar em `docs/handoffs/HANDOFF-voice-core.md` e seguir pra Fase 3 do
plano open-source (runtime Pipecat + faster-whisper + Piper/Kokoro + OpenVoice) — é onde o worker
de produção finalmente troca de carrier. Não redesenhar o núcleo a partir do plano histórico
LiveKit-first. Não mergear/ativar Telnyx real sem decidir antes se ainda vale a pena, dado que o
plano aprovado substitui essa arquitetura por SIP/BYOC.
