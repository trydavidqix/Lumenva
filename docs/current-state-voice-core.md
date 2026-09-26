# Estado atual — Voice Core

**Data:** 2026-08-28 (atualizado após validação parcial na VPS, mesmo dia)  
**Repo:** `trydavidqix/CRM`  
**Branch:** `implementacao-tokens-voice-core`  
**Escopo:** somente Núcleo de Ligação / Lumenva Voice Engine.

> `docs/current-state.md` é um snapshot global do CRM. Para voz, este arquivo + `docs/handoffs/HANDOFF-voice-core.md` são referências do Voice Core. O handoff `docs/handoffs/HANDOFF-codex-voice-sip-2026-08-28.md` contém a atualização operacional mais recente desta branch.

> **Errata operacional 2026-08-28:** a afirmação histórica abaixo de que esta sessão não alcançava Asterisk real ficou superada. A branch foi ligada a um Asterisk real na VPS: ARI autenticou, o worker foi executado como serviço de teste e `/healthz` respondeu. Isso prova bridge/sinalização parcial, não chamada completa nem áudio de IA.

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

**O diagrama acima é o que roda em produção hoje.** Em paralelo, aditivo e ainda não implantado,
existe o pipeline SIP/BYOC completo (código pronto e testado, ver "Implementado" abaixo):

```text
Cliente/PSTN
  -> conexão SIP/BYOC verificada (voice_sip_connections)
  -> Asterisk/ARI (real na VPS; servidor falso usado nos testes automatizados)
  -> workers/voice-sip-worker/main.mjs (createVoiceSipWorker)
       -> AriConnection (REST+WS real)
       -> SipGateway (valida/normaliza, isolamento de tenant)
       -> AsteriskAriListener (consome eventos, reconecta sozinho)
       -> SipEventForwarder -> brain-client
  -> app/api/internal/voice/context + /event (aceitam connection_id)
  -> mesmo CRM/Agent OS de sempre
```

Diferença chave: nenhum runtime de áudio de IA (Pipecat/faster-whisper/Piper/Kokoro) está ligado
ainda. A bridge hoje prova eventos/telefonia/CRM parcialmente; a substituição de mídia/STT/TTS
continua pendente.

## Implementado

- `VoiceEngine` provider-neutral e factory;
- Patter encapsulado como implementation detail substituível;
  - worker persistente em `apps/voice-worker/**`;
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
  testado contra servidor ARI falso local real e ligado a Asterisk real na VPS;
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
  ponta a ponta pro mundo SIP;
- `lib/voice/sip/brain-client.ts` (`createSipVoiceBrainClient`) + `lib/voice/sip/event-forwarder.ts`
  (`createSipEventForwarder`) ligam um evento normalizado do listener a `/context`+`/event` de
  verdade via HTTP — `StasisStart→active`, `StasisEnd`/`ChannelHangupRequest→completed`,
  idempotente (sem cache local de `voice_call_id`, resolvido de novo a cada evento). Provado como
  pipeline completo (Asterisk falso → listener → forwarder → CRM falso) num processo Node real no
  smoke test, com os dois eventos do mesmo canal resolvendo o mesmo `voice_call_id` via HTTP;
- `workers/voice-sip-worker/main.mjs` (`createVoiceSipWorker`) — **o entrypoint de produção de
  verdade**, não mais scaffold: lê env vars, monta ARI+gateway+listener+forwarder, expõe
  `GET /healthz`, nunca derruba o loop numa falha de encaminhamento, desliga gracioso em
  `SIGTERM`/`SIGINT`. Decisão de build tomada: `tsx` direto (sem pipeline de build novo pros
  workers) — consequência documentada: não pode ser container standalone leve como o worker
  Telnyx, precisa do checkout completo do repo. Resolução de tenant local via Postgres direto
  (`createVoiceOrganizationResolver` por `createPool`, não `pg.Pool` cru — evita o pitfall de
  erro-de-cliente-ocioso já documentado no repo), decisão explícita e documentada no cabeçalho do
  arquivo (diferente do worker Telnyx, que não tem credencial de banco). **Provado com Postgres
  nativo real** (disponível nesta sessão) — `main.smoke.mjs` semeia schema mínimo e roda o
  `main.mjs` de ponta a ponta: env → ARI real → SQL real → HTTP real → `/healthz` real → shutdown
  real. Pula sozinho sem `SUPABASE_DB_URL`. Na VPS, o worker também foi executado como serviço
  de teste e respondeu `/healthz`; a chamada completa com áudio ainda não foi provada.

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

Gate rerodado localmente 8 vezes em 2026-08-28, uma por fatia (cliente ARI → reconhecimento de
mais eventos ARI → listener ligado ao resolver real → reconexão automática → extensão de
`/event` → extensão de `/context` → cliente HTTP + forwarder → entrypoint real) — verde em
todas, sempre incluindo os testes novos da fatia e sem regressão nos anteriores. Estado final
desta sessão: `IMPLEMENTED` + `VERIFIED PROVIDER-FREE` em cada peça, com a fatia 8 também
`VERIFIED` contra **Postgres real** (não fake). A bridge foi ligada a Asterisk real na VPS e o
worker respondeu no serviço de teste. Continua **não `VERIFIED LIVE`**: não há chamada telefónica
completa nem processo Pipecat/faster-whisper/Piper/Kokoro ligado ao áudio.

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
7. `00c44c48` — `brain-client.ts` + `event-forwarder.ts` ligam o listener às duas rotas de
   verdade; pipeline completo provado como processo real no smoke test.
8. `b46ea128` — `workers/voice-sip-worker/main.mjs`, entrypoint de produção real; decisão de
   build (`tsx`) tomada; provado com Postgres nativo real, não só fake.

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

1. **Bridge de sinalização já ligada parcialmente a Asterisk real.** Falta registrar um softphone
   ou conexão SIP/BYOC real e concluir uma chamada inbound/outbound com trace completo.
2. **Maior pendência de implementação:** ligar o caminho de áudio Asterisk/RTP → Pipecat →
   faster-whisper → Agent OS → Piper/Kokoro → Asterisk. Os adapters existem; os processos live e
   media bridge ainda não estão ligados.
3. Melhorias de robustez não-bloqueantes: alerta/observabilidade se o listener ficar reconectando
   repetidamente contra um endpoint morto; descoberta de um Asterisk alternativo (hoje reconecta
   só contra o mesmo endpoint configurado na criação).
4. OpenVoice e catálogo/UI de voz continuam pendentes: preview, consentimento, revogação,
   eliminação e clonagem devem ser implementados antes de oferecer essas opções ao cliente.

Não redesenhar o núcleo a partir do plano histórico LiveKit-first. Não mergear/ativar Telnyx real
sem decidir antes se ainda vale a pena, dado que o plano aprovado substitui essa arquitetura por
SIP/BYOC. Não mergear/ativar nada desta branch pra `main` sem autorização explícita.
