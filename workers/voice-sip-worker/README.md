# Voice SIP Worker (Fase 3 — código completo, ainda não implantado)

**Status: nada aqui está em produção.** O worker real continua sendo
`workers/voice-worker/main.mjs` (Patter/Telnyx/Deepgram/ElevenLabs) — não toque nele a partir
deste diretório sem uma decisão explícita de troca de arquitetura. `main.mjs` deste diretório é um
processo real e testado (não mais um scaffold), mas nunca rodou contra um Asterisk de verdade nem
foi implantado em lugar nenhum.

## O que existe hoje

- `ari-listener.smoke.mjs` — script de fumaça (não um servidor de produção) que prova, como
  processo Node real via `npx tsx ari-listener.smoke.mjs`, o fluxo
  conectar → receber `StasisStart` → `answer` → `close` contra um servidor ARI falso local
  (HTTP + WebSocket reais, mesmo formato de `lib/voice/sip/asterisk-ari-client.test.ts`). Não há
  Asterisk real nesta prova — é `IMPLEMENTED` + `VERIFIED PROVIDER-FREE`, nunca `VERIFIED LIVE`.
- O cliente ARI real (REST + WebSocket) vive em `lib/voice/sip/asterisk-ari-client.ts`
  (`createAsteriskAriConnection`), implementando a interface `AriClient` já definida em
  `lib/voice/sip/asterisk-adapter.ts` e estendendo com `AriConnection`
  (`connectEvents`/`answer`/`hangup`) sem alterar aquele arquivo nem seus testes existentes.
- `lib/voice/sip/asterisk-listener.ts` (`createAsteriskAriListener`) já liga o `AriConnection` ao
  `SipGateway.parseInboundEvent` — consome o stream ARI e produz
  `{status: "normalized", event}` ou `{status: "rejected", error, raw}` por evento, sem derrubar
  o loop num evento inesperado. Testado com o resolver de tenant real
  (`createVoiceOrganizationResolver`) contra um banco falso — prova de verdade da resolução
  conexão→número→organização, não mock da função. Reconecta sozinho com backoff exponencial
  (sem teto de tentativas) quando o WebSocket cai sem `close()` explícito ter sido chamado —
  testado com queda de conexão forçada de verdade (`dropConnection()` em
  `lib/voice/sip/testing/fake-ari-server.ts`), não só simulação de fechamento limpo.
  `ari-listener.smoke.mjs` já exercita tudo isso como processo real (conectar → normalizar →
  sobreviver a evento não suportado → normalizar → reconectar sozinho após queda → normalizar →
  fechar).
- `lib/voice/sip/brain-client.ts` (`createSipVoiceBrainClient`) — cliente HTTP real
  (`resolveContext`/`recordEvent`) pra `/api/internal/voice/context`/`event`, sibling TypeScript
  de `workers/voice-worker/brain-client.mjs`. `lib/voice/sip/event-forwarder.ts`
  (`createSipEventForwarder`) liga um evento normalizado do listener a esse cliente:
  `StasisStart→active`, `StasisEnd`/`ChannelHangupRequest→completed`, sempre resolvendo o
  `voice_call_id` de novo via `/context` (idempotente, sem cache local) antes de gravar o evento.
  `ari-listener.smoke.mjs` agora prova o pipeline inteiro — Asterisk falso → listener → forwarder
  → CRM falso — como processo real, incluindo os dois eventos do mesmo canal resolvendo o mesmo
  `voice_call_id` via HTTP de verdade.
- **`main.mjs` (`createVoiceSipWorker`) — o entrypoint de produção de verdade.** Lê env vars
  (`ARI_BASE_URL`/`ARI_USERNAME`/`ARI_PASSWORD`/`ARI_APP_NAME`/`SIP_OUTBOUND_CONTEXT`/
  `VOICE_CONTROL_PLANE_URL`/`INTERNAL_SECRET`/`SUPABASE_DB_URL`/`PORT`), monta
  ARI→gateway→listener→forwarder, expõe `GET /healthz`
  (`processedEvents`/`rejectedEvents`/`forwardFailures`), nunca derruba o loop numa falha de
  encaminhamento (loga e segue), desliga gracioso em `SIGTERM`/`SIGINT`. Roda via
  `npx tsx workers/voice-sip-worker/main.mjs` a partir da raiz do repo — decisão de build tomada
  (ver item 4 abaixo). **Decisão explícita, documentada no cabeçalho do arquivo**: diferente do
  worker Telnyx, este processo lê Postgres diretamente (`createVoiceOrganizationResolver` via
  `createPool`, não um `pg.Pool` cru) pra validar a conexão SIP localmente antes de qualquer
  chamada de rede — não existe endpoint HTTP leve só pra esse check hoje; fica marcado como ponto
  a revisar. `main.smoke.mjs` prova tudo isso com **Postgres nativo real** (disponível nesta
  sessão), não só Asterisk/CRM falsos — schema mínimo semeado, `main.mjs` real de ponta a ponta:
  env → ARI real → SQL real → HTTP real → `/healthz` real → shutdown real. Pula sozinho (exit 0)
  sem `SUPABASE_DB_URL` setado.

## Bridge RTP bidirecional

`lib/voice/sip/rtp-media-bridge.ts` abre um endpoint UDP local, cria um bridge `mixing` no
ARI, cria um canal `externalMedia` com `direction=both`/`format=ulaw` e adiciona o canal da
chamada e o canal externo ao mesmo bridge. O adapter encaminha bytes RTP opacos nos dois
sentidos; codec, VAD, STT, TTS e diálogo continuam responsabilidade do runtime de mídia/Pipecat
e do Agent OS existente. `rtp-media-bridge.test.ts` usa sockets UDP reais e prova envio/recepção
bidirecional, além da ordem dos comandos ARI. Estado: `IMPLEMENTED` + `VERIFIED PROVIDER-FREE`.

## O que falta pra isto virar um worker de verdade

Isto é lista, não segredo escondido — cada item exige infraestrutura que não existe nesta sessão:

1. ~~Reconexão automática do WebSocket~~ — **feito** (2026-08-28): `createAsteriskAriListener`
   reconecta sozinho com backoff exponencial quando a conexão cai sem `close()` explícito. Falta
   ainda: o processo de longa duração de verdade que registre o app Stasis real (não
   `voicecore-test` de teste) contra um Asterisk verdadeiro — o que existe hoje só reconecta
   contra o mesmo endpoint configurado na criação, não descobre um Asterisk novo.
2. ~~Ligar esse listener a `resolveOrganizationByConnection`~~ — **feito** (2026-08-28):
   `asterisk-listener.ts` já usa o `SipGateway` (que já chama `resolveOrganizationByConnection`
   internamente) pra cada evento, testado contra o resolver real.
3. ~~Encaminhar eventos normalizados pra o CRM~~ — **feito, ponta a ponta, e ligado num processo
   real** (2026-08-28). `/context` e `/event` aceitam o caminho SIP/BYOC (fatias 5/6),
   `lib/voice/sip/brain-client.ts` + `lib/voice/sip/event-forwarder.ts` (fatia 7) fazem as
   chamadas de verdade, e `main.mjs` (fatia 8, abaixo) os usa como processo de longa duração de
   verdade — não é mais peça solta "na bancada".
4. ~~Decisão de build~~ — **feita e implementada** (2026-08-28): `tsx` direto, sem pipeline de
   build novo. `main.mjs` é o entrypoint real (item acima). Consequência dessa escolha, também
   explícita: este processo **não roda como container standalone leve** igual o worker Telnyx —
   precisa do checkout completo do repo + `node_modules` da raiz + `tsx`. Não há `Dockerfile`
   pra isto ainda; criar um (se algum dia fizer sentido) teria que empacotar o repo inteiro, não
   só este diretório.
5. Pipecat/faster-whisper/Piper/Kokoro/OpenVoice reais — **`BLOCKED EXTERNAL`**. São processos
   Python/ML sem contrato de servidor documentado neste repo; rodá-los exige um host GPU/CPU
   dedicado (a VPS de produção atual, 2 CPU/3.7GB RAM, já foi validada como insuficiente pra
   Pipecat/faster-whisper — ver `docs/handoffs/HANDOFF-voice-core.md`). Nenhum cliente concreto
   foi implementado pra eles nesta tarefa; tentar fingir um sem processo real do outro lado
   produziria código não verificável, o que a doutrina do projeto trata como falso-verde.
   O adapter RTP fornece o contrato de transporte, mas não prova áudio live: falta runtime
   externo compatível que consuma/produza RTP e Asterisk real com chamada SIP/BYOC. Sem esses
   processos e credenciais autorizadas, live media permanece `BLOCKED EXTERNAL`/`NOT_PROVEN`;
   nenhum deploy ou teste na VPS foi executado.
6. Nenhum `docker-compose`/systemd/Dockerfile pro Asterisk existe neste repo — a instância de
   teste na VPS foi configurada manualmente fora do Git (ver HANDOFF). `main.mjs` nunca foi
   apontado pra esse Asterisk real nem pra nenhum outro — só pro servidor falso local do smoke
   test.

## Próxima ação

Ver `docs/handoffs/HANDOFF-voice-core.md` seção "Próxima ação" e
`docs/superpowers/plans/2026-08-27-voice-open-source-europe-plan.md` (Fase 3) pra o estado
atualizado depois desta fatia.
