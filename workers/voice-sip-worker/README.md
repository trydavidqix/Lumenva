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
3. Encaminhar eventos normalizados pra o CRM — **contrato HTTP completo** (2026-08-28, decisão do
   dono do repo: estender as rotas existentes, nas duas pontas). `app/api/internal/voice/context`
   agora aceita `connection_id` (cria a row `voice_calls` com `provider='asterisk'`, mesma regra
   de direção do resto), e `app/api/internal/voice/event` aceita `connection_id` + `phone_e164`
   pra atualizar essa mesma row — testado (`route.test.ts` nos dois diretórios, pool falso, mesmo
   padrão usado em outras rotas do repo). **O que ainda falta**: ninguém chama essas rotas de
   verdade — `asterisk-listener.ts` continua só produzindo `NormalizedSipCallEvent` em memória;
   ligá-lo a essas duas rotas HTTP é trabalho do processo de produção real (item 4 abaixo), não
   uma lacuna de contrato.
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
