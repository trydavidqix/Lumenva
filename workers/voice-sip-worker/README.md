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

## O que falta pra isto virar um worker de verdade

Isto é lista, não segredo escondido — cada item exige infraestrutura que não existe nesta sessão:

1. Um processo listener de longa duração que registre o app Stasis real (não `voicecore-test` de
   teste) contra um Asterisk de verdade, mantenha a conexão WS viva com reconexão, e trate todos
   os tipos de evento ARI relevantes (`StasisStart`, `StasisEnd`, `ChannelHangupRequest`) — hoje
   `asterisk-adapter.ts#parseInboundEvent` só reconhece `StasisStart`.
2. Ligar esse listener a `resolveOrganizationByConnection` (`lib/voice/identity/resolve-organization.ts`)
   pra resolução real de tenant por conexão SIP verificada — o listener nunca deve confiar em
   `organization_id` vindo do payload do Asterisk.
3. Encaminhar eventos normalizados pra `app/api/internal/voice/event` (mesmo padrão de auth
   `x-internal-secret` que `workers/voice-worker/brain-client.mjs` já usa) — reaproveitar esse
   padrão, não inventar um novo.
4. Decisão de build: `asterisk-ari-client.ts` é TypeScript; os workers em `workers/**` rodam sem
   step de build (`node main.mjs` puro). Rodar via `tsx` em produção é uma opção mais leve que
   criar um pipeline de build novo pros workers — mas isso é uma decisão de infraestrutura
   explícita a tomar antes de virar processo de produção, não algo resolvido implicitamente por
   este scaffold.
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
