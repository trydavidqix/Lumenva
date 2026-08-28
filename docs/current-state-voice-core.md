# Estado atual — Voice Core

**Data:** 2026-08-28 (atualizado após 6 fatias da Fase 3, mesmo dia)  
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
  testado contra servidor ARI falso local real (não mock de função); sem Asterisk real conectado
  nesta sessão;
- `lib/voice/sip/asterisk-adapter.ts#parseInboundEvent` reconhece `StasisStart`, `StasisEnd` e
  `ChannelHangupRequest` (antes só o primeiro) — mesma normalização/isolamento de tenant nos três;
- `lib/voice/sip/asterisk-listener.ts` (`createAsteriskAriListener`) liga o `AriConnection` ao
  `SipGateway.parseInboundEvent` de verdade: consome o stream ARI e produz
  `{status: "normalized", event}` ou `{status: "rejected", error, raw}` por evento sem derrubar o
  loop num evento inesperado; testado com `createVoiceOrganizationResolver` **real** (não
  mockado) contra banco falso — resolução conexão→número→organização provada de ponta a ponta;
- reconexão automática do WebSocket do listener com backoff exponencial (sem teto de tentativas)
  quando a conexão cai sem `close()` explícito — testado com queda de conexão forçada de verdade
  (`socket.terminate()`), não só fechamento limpo simulado;
- `app/api/internal/voice/event` aceita `connection_id` + `phone_e164` como caminho alternativo a
  `technical_phone_e164` (Telnyx) — `.superRefine()` garante exatamente um dos dois,
  `organization_id` nunca vem do corpo, só do join (`voice_sip_connections` →
  `voice_phone_numbers`), mesma lógica de direção do caminho Telnyx;
- `app/api/internal/voice/context` aceita `connection_id` opcional — cria a row `voice_calls`
  (`provider='asterisk'`) pra uma chamada SIP nova, via `resolveSipContext()` (função nova em
  `route.ts`; `lib/voice/runtime/context-service.ts` continua Telnyx-tipado, intocado, servindo
  só o caminho antigo). Com isso, `/context` + `/event` juntos formam um contrato HTTP coerente
  ponta a ponta pro mundo SIP — mas nenhum processo ainda os chama de verdade.

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

Gate rerodado localmente 6 vezes em 2026-08-28, uma por fatia (cliente ARI → reconhecimento de
mais eventos ARI → listener ligado ao resolver real → reconexão automática → extensão de
`/event` → extensão de `/context`) — verde em todas, sempre incluindo os testes novos da fatia e
sem regressão nos anteriores. Estado final desta sessão: `IMPLEMENTED` + `VERIFIED PROVIDER-FREE`
em cada peça — **nunca `VERIFIED LIVE`**, não há Asterisk real nem processo Pipecat/faster-whisper/
Piper/Kokoro alcançável desta sessão (sandbox sem GPU, sem rede até a VPS de produção).

Detalhe por fatia (commits em `implementacao-tokens-voice-core`, todos com nota datada
correspondente em `docs/superpowers/plans/2026-08-27-voice-open-source-europe-plan.md`):

1. `8f888ccd` — `asterisk-ari-client.ts` + testes reais HTTP+WS + smoke `.mjs` via `tsx`.
2. `eb0abcc0` — `StasisEnd`/`ChannelHangupRequest` reconhecidos em `asterisk-adapter.ts`.
3. `cecdf0e1` — `asterisk-listener.ts` ligado ao resolver de tenant real; helper de servidor ARI
   falso extraído pra `lib/voice/sip/testing/fake-ari-server.ts`.
4. `c71748fd` — reconexão automática com backoff exponencial, testada com queda forçada real.
5. `2eb7a8d4` — `app/api/internal/voice/event` aceita `connection_id`+`phone_e164` (decisão do
   dono do repositório: estender a rota existente em vez de criar uma nova).
6. `84f395b5` — `app/api/internal/voice/context` aceita `connection_id` (mesma decisão: estender
   em vez de criar rota nova); contrato HTTP `/context`+`/event` fica coerente ponta a ponta pro
   mundo SIP.

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

O próximo agente deve começar em `docs/handoffs/HANDOFF-voice-core.md` (seção "Próxima ação",
atualizada 2026-08-28). Resumo do que bloqueia progresso de código agora, em ordem:

1. **Nenhuma decisão de produto pendente pro contrato HTTP** — `/context` e `/event` já aceitam
   o caminho SIP/BYOC (`connection_id`), decisão do dono do repositório tomada e implementada
   nas fatias 5 e 6. O que falta agora é só código: escrever o cliente HTTP que faz o
   `asterisk-listener.ts` chamar essas duas rotas de verdade (hoje ele só produz
   `NormalizedSipCallEvent` em memória) — isso é parte natural da decisão de build/deploy do
   item 2, não uma decisão de produto nova.
2. Decisão de build/deploy do processo de produção (`tsx` direto vs. pipeline de build novo pros
   workers) — ver `workers/voice-sip-worker/README.md` — e, dentro dela, o cliente HTTP do item 1.
3. Ligar tudo isso a um Asterisk real quando houver um alcançável pela sessão.
4. Pipecat/faster-whisper/Piper/Kokoro/OpenVoice seguem `BLOCKED EXTERNAL` — não implementar
   cliente concreto pra eles sem primeiro confirmar, numa sessão dedicada com GPU/host adequado,
   que dá pra rodar o processo real.

Não redesenhar o núcleo a partir do plano histórico LiveKit-first. Não mergear/ativar Telnyx real
sem decidir antes se ainda vale a pena, dado que o plano aprovado substitui essa arquitetura por
SIP/BYOC. Não mergear/ativar nada desta branch pra `main` sem autorização explícita.
