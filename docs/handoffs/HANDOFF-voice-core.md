# HANDOFF — Lumenva Voice Core

**Data:** 2026-08-27  
**Repo:** `trydavidqix/CRM`  
**Branch obrigatória para continuar:** `implementacao-tokens-voice-core`  
**Último checkpoint de código da implementação:** `cabfbec422aea370252a6909c28204306177ed65`  
**Não alterar/mergear `main` sem autorização explícita.**

## 1. Comece aqui

Este documento é o ponto de entrada canônico para Claude/qualquer agente que continuar o Voice Core. Não recomece pelo plano mestre nem pelo plano antigo LiveKit-first.

**Atualização 2026-08-27 (mesma data, sessão posterior ao gate verde):** o dono do repositório
aprovou um plano novo — `docs/superpowers/plans/2026-08-27-voice-open-source-europe-plan.md` —
que troca a arquitetura de provedores (Telnyx/Deepgram/ElevenLabs/número técnico comprado) por
uma pilha open-source com SIP/BYOC do próprio cliente (Asterisk-ARI, Pipecat, faster-whisper,
Piper/Kokoro, OpenVoice). **É plano registrado, ainda não implementado** — o código descrito neste
HANDOFF continua sendo o estado real do código nesta data. Leia esse plano ANTES de abrir
qualquer Fase nova; ele explica explicitamente o que reaproveita deste HANDOFF e o que substitui.

Leia nesta ordem:

1. `docs/handoffs/HANDOFF-voice-core.md` — este arquivo.
2. `docs/superpowers/plans/2026-08-27-voice-open-source-europe-plan.md` — plano canônico da PRÓXIMA fase (SIP/BYOC open-source), aprovado 2026-08-27, ainda não implementado.
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
- `supabase/migrations/20260827013000_0128_voice_phone_numbers.sql`
- `supabase/migrations/20260827014500_0129_voice_worker_endpoints.sql`
- `supabase/migrations/20260827020000_0130_voice_worker_endpoint_privileges.sql`
- `scripts/verify-voice-core.sh`

## 9. Definition of Done neste ponto

**Código do núcleo:** fronteiras e invariantes implementados.  
**Verificação do HEAD:** gate fresco obrigatório antes de declarar final-green.  
**Produção LIVE:** somente após PSTN real + transferência + métricas reais + governance/recording aprovados.

Esses estados são diferentes. Não colapsá-los em “pronto/não pronto”.
