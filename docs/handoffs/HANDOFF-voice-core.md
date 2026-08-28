# HANDOFF — Lumenva Voice Core

**Data:** 2026-08-27  
**Repo:** `trydavidqix/CRM`  
**Branch obrigatória para continuar:** `implementacao-tokens-voice-core`  
**Último checkpoint de código da implementação:** `fce93bd9` (Fase 6 do plano open-source, gate 47 arquivos/198 testes verde)  
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

**Atualização 2026-08-27 (sessão de infraestrutura, sem mudança de código neste repo):**
validado ao vivo, na VPS de produção (`root@2.29.8.225`), que Asterisk/ARI/PJSIP roda como
gateway SIP standalone (systemd nativo, ~55MB RAM, cabe na VPS de 3.7GB) — registro e chamada
de teste confirmados via Zoiper (iOS). Detalhes completos (fix de firewall Hetzner, bug de AOR)
estão no bloco "Atualização 2026-08-27 (sessão de infraestrutura...)" no fim da seção Progresso
do plano canônico. **Isso não avança nenhuma Fase de código** — não há nenhum processo Pipecat
ligado a esse Asterisk ainda; a chamada de teste cai em `Stasis app 'voicecore-test' doesn't
exist` de propósito, porque nada está escutando. Pipecat/faster-whisper NÃO cabem nessa VPS —
vão precisar de host separado quando a Fase 3 virar processo vivo.

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

Isto **não é backlog arquitetural escondido**:

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

O próximo fio agora é: (b2) criar o equivalente SIP/BYOC de `/context` (nova decisão de
produto/arquitetura, mesma natureza da anterior); (c) decidir como o processo roda em produção
sem pipeline de build novo (`tsx` direto é a opção mais leve, ver README); (d) ligar isso a um
Asterisk real quando houver um alcançável pela sessão; (e) o que existe hoje reconecta contra o
mesmo endpoint configurado na criação — não há descoberta de um Asterisk diferente nem
alerta/observabilidade se ficar reconectando repetidamente, isso pertence ao processo de produção
real que ainda não existe. Pipecat/faster-whisper/Piper/Kokoro seguem `BLOCKED EXTERNAL` — não
tentar implementar cliente concreto pra eles sem primeiro confirmar, numa sessão dedicada, que dá
pra rodar o processo real (Python/modelo) no ambiente disponível.

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
