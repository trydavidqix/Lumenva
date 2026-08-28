# Voice SIP Worker (Fase 3, scaffold — não é o worker de produção)

**Status: nada aqui está em produção.** O worker real continua sendo
`workers/voice-worker/main.mjs` (Patter/Telnyx/Deepgram/ElevenLabs) — não toque nele a partir
deste diretório sem uma decisão explícita de troca de arquitetura.

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
3. ~~Encaminhar eventos normalizados pra o CRM~~ — **feito, ponta a ponta** (2026-08-28).
   `/context` e `/event` aceitam o caminho SIP/BYOC (fatias 5/6), e agora
   `lib/voice/sip/brain-client.ts` + `lib/voice/sip/event-forwarder.ts` (fatia 7) fazem essas
   chamadas de verdade a partir de um evento normalizado do listener — provado como processo real
   contra Asterisk falso + CRM falso no `ari-listener.smoke.mjs`. **O que ainda falta**: nada
   disto está fiado a um processo de produção de longa duração — é a peça de orquestração
   testada, mas ainda "na bancada", não "ligada na tomada" (isso é o item 4 abaixo).
4. Decisão de build: `asterisk-ari-client.ts`, `asterisk-listener.ts`, `brain-client.ts` e
   `event-forwarder.ts` são TypeScript; os workers em `workers/**` rodam sem step de build
   (`node main.mjs` puro). Rodar via `tsx` em produção é uma opção mais leve que criar um
   pipeline de build novo pros workers (e é o que os smoke tests já fazem) — mas isso é uma
   decisão de infraestrutura explícita a tomar antes de virar processo de produção, não algo
   resolvido implicitamente por este scaffold. É dentro dela que um `main.mjs`/`.ts` de verdade
   (lendo env vars, com loop de vida longa, tratando erros de rede sem derrubar o processo)
   usaria o forwarder do item 3.
5. Pipecat/faster-whisper/Piper/Kokoro/OpenVoice reais — **`BLOCKED EXTERNAL`**. São processos
   Python/ML sem contrato de servidor documentado neste repo; rodá-los exige um host GPU/CPU
   dedicado (a VPS de produção atual, 2 CPU/3.7GB RAM, já foi validada como insuficiente pra
   Pipecat/faster-whisper — ver `docs/handoffs/HANDOFF-voice-core.md`). Nenhum cliente concreto
   foi implementado pra eles nesta tarefa; tentar fingir um sem processo real do outro lado
   produziria código não verificável, o que a doutrina do projeto trata como falso-verde.
6. Nenhum `docker-compose`/systemd/Dockerfile pro Asterisk existe neste repo — a instância de
   teste na VPS foi configurada manualmente fora do Git (ver HANDOFF).

## Próxima ação

Ver `docs/handoffs/HANDOFF-voice-core.md` seção "Próxima ação" e
`docs/superpowers/plans/2026-08-27-voice-open-source-europe-plan.md` (Fase 3) pra o estado
atualizado depois desta fatia.
