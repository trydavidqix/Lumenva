# HANDOFF — Lumenva Voice Core

**Data:** 2026-08-27 (última atualização de conteúdo: 2026-08-28, 8 fatias da Fase 3)  
**Repo:** `trydavidqix/CRM`  
**Branch obrigatória para continuar:** `implementacao-tokens-voice-core`  
**Checkpoint de código do fechamento da Fase 6 (histórico):** `fce93bd9` (gate 47 arquivos/198 testes verde)  
**Último checkpoint de código nesta branch:** `8de44e30` (2026-08-28 — inclui as 8 fatias anteriores e a hidratação de `SIP_CONNECTION_ID` via ARI REST quando `channelvars` não vem no evento; bridge ligada parcialmente ao Asterisk real da VPS, worker em serviço de teste e `/healthz` respondendo; ver o handoff operacional atualizado `HANDOFF-codex-voice-sip-2026-08-28.md`)  
**Não alterar/mergear `main` sem autorização explícita.**

## 1. Comece aqui

Este documento é o ponto de entrada canônico para Claude/qualquer agente que continuar o Voice Core. Não recomece pelo plano mestre nem pelo plano antigo LiveKit-first.

**Atualização 2026-08-27 (mesma data, sessão posterior ao gate verde):** o dono do repositório
aprovou um plano novo — `docs/superpowers/plans/2026-08-27-voice-open-source-europe-plan.md` —
que troca a arquitetura de provedores (Telnyx/Deepgram/ElevenLabs/número técnico comprado) por
uma pilha open-source com SIP/BYOC do próprio cliente (Asterisk-ARI, Pipecat, faster-whisper,
Piper/Kokoro, OpenVoice). **Fases 1 a 6 já implementadas/auditadas** (`f672eb78` até `fce93bd9`
— ver "Progresso" no topo do plano). O worker real ainda roda na arquitetura Patter/Telnyx/
Deepgram/ElevenLabs descrita neste HANDOFF: Fases 1-6 entregaram primitivas novas (contrato de
perfil de voz, `SipGateway`, adapter Asterisk/ARI, resolução por conexão SIP, adapters STT/TTS/
clone open-source, versionamento imutável, matriz de idiomas, registry de clone) que ainda não
substituem o worker de produção — isso é Fase 3 em diante (rewire do worker) e Fase 7 (homologação).
Leia o plano ANTES de continuar; ele explica o que reaproveita deste HANDOFF e o que substitui.

**Atualização 2026-08-27 (sessão de infraestrutura, sem mudança de código nesta branch):**
validado ao vivo, na VPS de produção (`root@2.29.8.225`), que Asterisk/ARI/PJSIP roda como
gateway SIP standalone (systemd nativo, ~55MB RAM, cabe na VPS de 3.7GB) — registro e chamada
de teste confirmados via Zoiper (iOS). Detalhes completos (fix de firewall Hetzner, bug de AOR)
estão no bloco "Atualização 2026-08-27 (sessão de infraestrutura...)" no fim da seção Progresso
do plano canônico. **Isso não prova chamada completa nem áudio de IA** — o worker SIP/BYOC já foi
ligado parcialmente ao Asterisk real e responde como serviço de teste, mas Pipecat/faster-whisper
não estão ligados ao áudio. Esses processos precisarão de host separado quando forem executados.

Leia nesta ordem:

1. `docs/handoffs/HANDOFF-voice-core.md` — este arquivo.
2. `docs/superpowers/plans/2026-08-27-voice-open-source-europe-plan.md` — plano canônico da PRÓXIMA fase (SIP/BYOC open-source), aprovado 2026-08-27, Fases 1-6 implementadas/auditadas (`fce93bd9`), Fase 3 rewire do worker + Fase 7 pendentes.
3. `docs/current-state-voice-core.md` — snapshot atual do Voice Core (arquitetura Telnyx/Deepgram/ElevenLabs ainda vigente no código).
4. `docs/evidence/implementacao-tokens/voice-core/implementation-status.md` — estado task-by-task.
5. `docs/evidence/implementacao-tokens/voice-core/lumenva-voice-engine-final.md` — evidência e invariantes finais.
6. `docs/superpowers/plans/2026-08-27-voice-core-canonical-status.md` — mapa de supersessão documental.
7. `docs/superpowers/plans/2026-08-27-lumenva-voice-engine-patter-plan.md` — plano executável da arquitetura atual (Patter).
8. `docs/evidence/implementacao-tokens/voice-core/patter-equivalence.md`.
9. `docs/evidence/implementacao-tokens/voice-core/patter-adoption-baseline.md`.
10. `docs/superpowers/plans/2026-08-26-nucleo-ligacao-integration-plan.md` apenas como histórico/spec pai.
11. `docs/superpowers/plans/2026-08-23-implementacao-tokens-master-plan.md` somente para panorama do CRM completo.

`docs/current-state.md` é um snapshot global antigo e **não deve ser usado como fonte atual do Voice Core**. Para voz, use `docs/current-state-voice-core.md`.

## 2. Arquitetura vigente

```text
PSTN
  -> Telnyx
  -> Lumenva Voice Worker persistente
       -> Patter OSS (mídia/telefonia; substituível)
       -> Deepgram STT (adapter atual)
       -> ElevenLabs TTS (adapter atual)
       -> VAD / barge-in / recording transport
       -> CRM control plane autenticado
  -> número técnico resolve organização
  -> Caller ID resolve contacto dentro da organização
  -> Customer Memory
  -> Agent Kernel / Product Agent existente
  -> runModelCall / model seam canônico
  -> Tool Gateway / políticas / handoff
  -> resposta customer-safe volta ao worker para TTS
```

LiveKit **não** é dependência do caminho normal IA <-> cliente. Ele permanece opcional para browser-human takeover. A arquitetura histórica `Telnyx -> LiveKit -> Voice Runtime` foi superada deliberadamente.

## 3. O que já existe no código

> Esta lista é o caminho **Telnyx/vigente em produção**. O pipeline SIP/BYOC (Fases 1-6 do plano
> open-source + as 8 fatias de 2026-08-28 desta sessão) também existe em código, testado, mas
> ainda não substitui nada aqui — ver seção "Progresso" do plano canônico
> (`docs/superpowers/plans/2026-08-27-voice-open-source-europe-plan.md`) e
> `docs/current-state-voice-core.md` pro inventário completo dos dois caminhos.

- contratos provider-neutral `VoiceEngine` e factory;
- adapters Patter isolados;
- worker Node persistente em `workers/voice-worker/**`;
- Patter com persistência/dashboard/telemetria anônima desativados;
- Telnyx, Deepgram e ElevenLabs ligados no worker atual;
- `voice_phone_numbers`: número técnico -> organização;
- `voice_worker_endpoints`: número técnico -> `control_url` privado do worker;
- RLS + `REVOKE ALL` de `anon/authenticated` no registry privado;
- Caller ID tenant-scoped + Customer Memory compacta;
- control plane interno para worker config/context/turn/event;
- binding de cada turn/event ao `technical_phone_e164` do worker;
- inbound só opera quando `called_number` é o número técnico daquele worker;
- outbound só opera quando `caller_number` é o número técnico daquele worker;
- número técnico precisa estar enabled para a organização da chamada;
- lifecycle terminal não reabre por evento tardio;
- `provider_call_id` conflitante não substitui o persistido;
- outbound governado cria `voice_call_id` antes do dial e correlaciona provider call depois;
- `POST /api/v1/voice/calls` recebe `contact_id + agent_id + goal`, nunca número bruto/first message/control URL;
- abertura outbound passa por Agent OS + delivery policy antes de discar;
- Product Agent `shadow/draft/off` não fala externamente;
- transferência humana em duas fases;
- recording tenant-controlled e fail-closed quando disclosure/consentimento é necessário;
- métricas/custos/lifecycle normalizados no CRM;
- painel base `Agente de Ligação` tenant-scoped;
- simulador provider-free, safety evals e testes de correlação outbound;
- graceful shutdown, healthcheck e runtime non-root do worker;
- gate `scripts/verify-voice-core.sh`.

## 4. Segurança/invariantes — NÃO QUEBRAR

1. Não criar `Voice Agent`, `Sales Voice Agent` ou runtime LLM paralelo.
2. Patter é implementation detail substituível; não recebe CRM tools, identidade, routing ou model selection.
3. Nunca confiar em `organization_id` vindo de cliente/worker para escolher tenant.
4. Resolver organização pelo número técnico antes de Caller ID.
5. Nunca fazer lookup global de telefone entre tenants.
6. Todo turno LLM continua no seam canônico (`runModelCall`/Agent Kernel).
7. Não expor `voice_worker_endpoints` para tenant/anon.
8. Não expor endpoint público `number + arbitrary text` para outbound.
9. Não permitir worker A operar call do número/tenant B.
10. Não reabrir chamada terminal por evento atrasado.
11. Não trocar `provider_call_id` depois de estabelecido.
12. Não ativar recording só porque existe capacidade técnica.
13. Não promover Product Agents de `shadow` dentro do Voice Core para “fazer funcionar”; autonomia é governance do Agent OS.
14. Não reintroduzir LiveKit como requisito do caminho normal sem nova decisão arquitetural explícita.
15. Não mergear para `main` automaticamente.

## 5. Verificação

Comando autoritativo:

```bash
bash scripts/verify-voice-core.sh
```

Ele executa typecheck, suíte Voice Core/evals, worker syntax/tests, tenant binding, tenant-filter lint e Next build.

### Estado conhecido do CI

No fechamento documental desta sessão, não havia execução fresca do gate completo para o HEAD documental mais recente. O GitHub mostrava:

- `Vercel – crm`: failure apontando para `upgradeToPro=build-rate-limit`;
- `Vercel – lumenva-website`: failure apontando para team invite/access.

Não interpretar esses status como falha de compilação/teste e também não chamar o HEAD de `final-green` sem rodar o gate em runner funcional. Checkpoints verdes anteriores estão enumerados em `lumenva-voice-engine-final.md`.

## 6. O que falta para LIVE — somente ativação/prova externa

Isto **não é backlog arquitetural escondido**. Lista específica do caminho Telnyx; o equivalente
pro caminho SIP/BYOC é bem mais curto hoje — só "um Asterisk real alcançável" e Pipecat/
faster-whisper/Piper/Kokoro (`BLOCKED EXTERNAL`), ver seção 7 abaixo:

- Telnyx real: conta, número, connection id, API key e public key;
- worker persistente realmente hospedado por número técnico;
- `voice_phone_numbers` e `voice_worker_endpoints` configurados;
- `VOICE_CONTROL_PLANE_URL` e `VOICE_WEBHOOK_HOST` alcançáveis;
- Deepgram e ElevenLabs reais ou adapters substitutos;
- `INTERNAL_SECRET` consistente worker/control plane;
- `VOICE_LIVE_ENABLED=true` somente após os demais gates;
- Product Agent com autonomia autorizada para voz;
- chamada PSTN inbound real;
- chamada PSTN outbound real;
- transferência humana real;
- captura de latência/custo/provider IDs reais;
- validação legal/operacional de recording antes de ligá-lo.

## 7. Próxima ação para Claude

**Atualização 2026-08-28:** o "próximo fio a puxar" citado na seção 1 (cliente ARI real) foi
implementado nesta fatia — `lib/voice/sip/asterisk-ari-client.ts` +
`workers/voice-sip-worker/ari-listener.smoke.mjs`, ver nota datada no plano canônico
(`docs/superpowers/plans/2026-08-27-voice-open-source-europe-plan.md`, Fase 3) e
`workers/voice-sip-worker/README.md`. Estado: `IMPLEMENTED` + `VERIFIED PROVIDER-FREE` (protocolo
ARI real contra servidor HTTP+WS local, não Asterisk real).

**Atualização 2026-08-28 (segunda fatia, mesma data):** item (b) abaixo foi feito —
`asterisk-adapter.ts#parseInboundEvent` agora reconhece `StasisEnd` e `ChannelHangupRequest`
além de `StasisStart`, mesma normalização/isolamento de tenant nos três, `eventType` retornado
carrega o tipo real. 2 testes novos, suíte 11/11 verde, gate completo verde. Não construído: o
que um consumidor faz com um evento de término (isso é o listener do item a, ainda não existe).

**Atualização 2026-08-28 (terceira fatia, mesma data):** `lib/voice/sip/asterisk-listener.ts`
(`createAsteriskAriListener`) liga o `AriConnection` ao `SipGateway.parseInboundEvent` de verdade
— cada evento vira `normalized` ou `rejected` sem derrubar o processo num evento inesperado.
Testado com `createVoiceOrganizationResolver` real (não mockado) contra banco falso — a resolução
de tenant conexão→número→organização já está ligada, de fato, não só documentada como possível.
Helper `lib/voice/sip/testing/fake-ari-server.ts` extraído (compartilhado por 2 arquivos de
teste). Smoke test estendido provando o fluxo completo como processo real, incluindo sobreviver a
um evento não suportado no meio. 4 testes novos, suíte `lib/voice/sip/` 23/23 verde, gate
completo verde.

**Atualização 2026-08-28 (quarta fatia, mesma data):** item (a) abaixo foi feito —
`createAsteriskAriListener` agora reconecta sozinho (backoff exponencial, sem teto de tentativas)
quando o WebSocket cai sem `close()` explícito ter sido chamado, testado com queda de conexão
forçada de verdade (`dropConnection()` novo no helper de teste), não só fechamento limpo
simulado. 2 testes novos + smoke test estendido, ambos verdes 5x seguidas pra descartar
flakiness de timing.

**Atualização 2026-08-28 (quinta fatia, mesma data):** item (b) abaixo — **decisão tomada pelo
dono do repositório: estender a rota existente.** `app/api/internal/voice/event` agora aceita
`connection_id` + `phone_e164` como caminho alternativo a `technical_phone_e164`
(`.superRefine()` garante exatamente um dos dois), mesma lógica de direção do caminho Telnyx,
`organization_id` sempre resolvido por join, nunca do corpo. 7 testes novos
(`app/api/internal/voice/event/route.test.ts`, padrão de mock de `getRequestPool` já usado em
outras rotas — unitário, não `test:db`). **Achado ao tentar fechar o ciclo completo**: isso
sozinho não basta — não existe equivalente SIP/BYOC de `app/api/internal/voice/context` (a rota
que cria a row `voice_calls` pra uma chamada nova). Sem essa peça, nenhum `voice_call_id` existe
pra uma chamada SIP nova, então **o listener ainda não chama `/event`** — chamaria sempre em vão.
Confirmado também: quando o listener virar processo de produção, a resolução de tenant precisa
ser uma chamada HTTP pro CRM (não conexão direta a Postgres do worker), por causa da fronteira já
documentada em `workers/voice-worker/README.md` ("the worker has no database credentials").

**Atualização 2026-08-28 (sexta fatia, mesma data):** item (b2) — **decisão tomada pelo dono do
repositório, mesma linha da anterior: estender `/context`.** Agora aceita `connection_id`
opcional; quando presente, `resolveSipContext()` (função nova em `route.ts`, não uma mudança em
`lib/voice/runtime/context-service.ts`, que continua Telnyx-tipado e serve só o caminho antigo
via `resolveTelnyxContext()`) resolve organização por `resolveByConnection`, resolve contato com
o mesmo `createVoiceCallerResolver` de sempre (provider-agnóstico, não mudou), e insere em
`voice_calls` com `provider='asterisk'`. `loadVoiceTenantConfig()` virou helper compartilhado
entre os dois caminhos. 6 testes novos (`app/api/internal/voice/context/route.test.ts`). **O
contrato HTTP das duas rotas (`/context` + `/event`) agora é coerente ponta a ponta pro mundo
SIP** — mas ninguém ainda os chama de verdade; `asterisk-listener.ts` continua só produzindo
`NormalizedSipCallEvent` em memória. Ligar o listener a essas rotas é trabalho do processo de
produção real (item c abaixo), não uma lacuna de contrato.

**Atualização 2026-08-28 (sétima fatia, mesma data):** o cliente HTTP citado acima foi escrito —
`lib/voice/sip/brain-client.ts` (`createSipVoiceBrainClient`, sibling TS de
`workers/voice-worker/brain-client.mjs`) + `lib/voice/sip/event-forwarder.ts`
(`createSipEventForwarder`) ligam um `AsteriskListenerResult` normalizado a `/context`+`/event`
de verdade: `StasisStart→active`, `StasisEnd`/`ChannelHangupRequest→completed`,
`provider_event_id: "<channelId>:<eventType>"` (evita colisão de idempotência entre os dois
estados do mesmo canal), sem cache local de `voice_call_id` (chama `/context` de novo a cada
evento — idempotente, trade-off documentado no próprio arquivo). Testado com servidor HTTP real
local pro `brain-client.ts` e `brainClient` falso pro `event-forwarder.ts` (protocolo já provado
no primeiro). Smoke test estendido: sobe um CRM falso local e prova o pipeline inteiro — Asterisk
falso → listener → forwarder → CRM falso — como processo real, com os dois eventos do mesmo
canal resolvendo o mesmo `voice_call_id` via HTTP de verdade. 9 testes novos, gate completo verde.
**Isso fecha, em código testado, o encaminhamento ponta a ponta que faltava** — o que resta agora
é só ligar isso a um processo de produção de longa duração de verdade, não mais escrever a lógica
de orquestração.

**Atualização 2026-08-28 (oitava fatia, mesma data): decisão (c) tomada — `tsx` direto — e
entrypoint real construído.** `workers/voice-sip-worker/main.mjs` (`createVoiceSipWorker`) lê env
vars, monta ARI+gateway+listener+forwarder, expõe `GET /healthz`, nunca derruba o loop numa falha
de encaminhamento, desliga gracioso em `SIGTERM`/`SIGINT`. Decisão explícita e documentada no
cabeçalho do arquivo: este processo lê Postgres direto (`createVoiceOrganizationResolver` via
`createPool`, não `pg.Pool` cru — o pitfall de erro-de-cliente-ocioso já documentado neste repo)
pra validar a conexão SIP localmente antes de qualquer chamada de rede, diferente do worker
Telnyx ("no database credentials") — não existe endpoint HTTP leve só pra esse check hoje, fica
marcado como ponto a revisar. **Prova real, não só provider-free**: `main.smoke.mjs` sobe um
Postgres **nativo real** (disponível nesta sessão) com schema mínimo
semeado, mais Asterisk falso e CRM falso, e roda o `main.mjs` de ponta a ponta: env → ARI real →
SQL real → HTTP real → `/healthz` real → shutdown real. Pula sozinho sem `SUPABASE_DB_URL`. Gate
completo verde. **Consequência da decisão de `tsx`, documentada**: este processo não pode ser um
container standalone leve como o worker Telnyx — precisa do checkout completo do repo. **Ainda
não fiz**: nenhuma chamada completa com Asterisk real, nenhum Dockerfile/deploy final,
nenhuma descoberta de Asterisk alternativo se a reconexão ficar tentando contra um endpoint
morto repetidamente.

**Errata 2026-08-28:** a bridge foi ligada parcialmente ao Asterisk real da VPS, o worker foi
instalado como serviço de teste e `/healthz` respondeu. Isso não prova chamada completa nem áudio
de IA. O próximo fio é registrar uma extensão/softphone ou conexão SIP/BYOC real, concluir
inbound/outbound e ligar o caminho Asterisk/RTP → Pipecat → faster-whisper → Agent OS →
Piper/Kokoro → Asterisk. O gate completo ainda precisa rodar num runner com heap suficiente.

1. Faça auditoria read-only do HEAD contra este handoff.
2. Rode `bash scripts/verify-voice-core.sh` em ambiente capaz.
3. Se houver vermelho **real de código**, corrija na mesma branch e atualize os documentos canônicos.
4. Se o gate ficar verde, avance para activation runbook/provisionamento real — não redesenhe o núcleo.
5. Preserve quatro estados distintos:
   - `IMPLEMENTED`;
   - `VERIFIED PROVIDER-FREE`;
   - `VERIFIED LIVE`;
   - `BLOCKED EXTERNAL`.
6. Nunca transformar `BLOCKED EXTERNAL` em bug imaginário ou em autorização para enfraquecer governance/RLS.

## 8. Arquivos críticos

- `workers/voice-worker/main.mjs`
- `workers/voice-worker/brain-client.mjs`
- `workers/voice-worker/control-server.mjs`
- `workers/voice-worker/pending-outbound.mjs`
- `app/api/internal/voice/context/route.ts`
- `app/api/internal/voice/turn/route.ts`
- `app/api/internal/voice/event/route.ts`
- `app/api/v1/voice/calls/route.ts`
- `lib/voice/engine/**`
- `lib/voice/patter/**`
- `lib/voice/runtime/**`
- `lib/voice/outbound/**`
- `lib/voice/identity/**`
- `lib/voice/transfer/**`
- `lib/voice/human-browser/**`
- `lib/voice/telnyx/**`
- `lib/voice/sip/asterisk-adapter.ts`
- `lib/voice/sip/asterisk-ari-client.ts`
- `lib/voice/sip/asterisk-listener.ts`
- `lib/voice/sip/testing/fake-ari-server.ts`
- `lib/voice/sip/brain-client.ts`
- `lib/voice/sip/event-forwarder.ts`
- `workers/voice-sip-worker/main.mjs`
- `workers/voice-sip-worker/main.smoke.mjs`
- `workers/voice-sip-worker/ari-listener.smoke.mjs`
- `workers/voice-sip-worker/README.md`
- `supabase/migrations/20260827013000_0128_voice_phone_numbers.sql`
- `supabase/migrations/20260827014500_0129_voice_worker_endpoints.sql`
- `supabase/migrations/20260827020000_0130_voice_worker_endpoint_privileges.sql`
- `scripts/verify-voice-core.sh`

## 9. Definition of Done neste ponto

**Código do núcleo:** fronteiras e invariantes implementados.  
**Verificação do HEAD:** gate fresco obrigatório antes de declarar final-green.  
**Produção LIVE:** somente após PSTN real + transferência + métricas reais + governance/recording aprovados.

Esses estados são diferentes. Não colapsá-los em “pronto/não pronto”.
