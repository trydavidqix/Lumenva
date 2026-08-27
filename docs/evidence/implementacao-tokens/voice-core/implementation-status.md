# Lumenva Voice Engine — estado de implementação e handoff

Plan: `docs/superpowers/plans/2026-08-27-lumenva-voice-engine-patter-plan.md`  
Canonical status: `docs/superpowers/plans/2026-08-27-voice-core-canonical-status.md`  
Parent spec: `docs/superpowers/plans/2026-08-26-nucleo-ligacao-integration-plan.md`  
Master plan: `docs/superpowers/plans/2026-08-23-implementacao-tokens-master-plan.md`  
Branch de trabalho: `implementacao-tokens-voice-core`  
Último checkpoint de código da implementação: `cabfbec422aea370252a6909c28204306177ed65`  
Data: 2026-08-27

## Estado de referência

O Voice Core foi implementado como **canal de voz do Agent OS existente**, não como segunda plataforma de agentes. A arquitetura vigente usa `Lumenva Voice Worker` persistente com Patter como implementation detail de mídia/telefonia, Telnyx como carrier PSTN, Deepgram/ElevenLabs como adapters atuais de STT/TTS e CRM/Agent OS como autoridade de identidade, memória, modelos, tools, políticas, handoff e observabilidade.

A arquitetura antiga que colocava LiveKit no caminho obrigatório foi superada. LiveKit é opcional e reservado ao adapter de atendimento humano no navegador.

`docs/current-state.md` é um snapshot global anterior ao Voice Core. Para estado atual de voz use `docs/current-state-voice-core.md`.

## Tasks do plano Patter

| Task | Estado | Evidência / nota |
|---|---|---|
| 1. Baseline + KEEP/ADAPT/REPLACE/OPTIONAL | IMPLEMENTADA | `patter-adoption-baseline.md` e `patter-equivalence.md`. |
| 2. Fronteira proprietária `VoiceEngine` | IMPLEMENTADA | `lib/voice/engine/**`; contratos provider-neutral. |
| 3. Adapter Patter substituível | IMPLEMENTADA | `lib/voice/patter/adapter.ts` + factory; sem autoridade de Agent OS/LLM/tools. |
| 4. Media pipeline Patter-backed | IMPLEMENTADA | STT/TTS/VAD/barge-in e telemetria atrás de adapters; persistência/dashboard/telemetria Patter desativados. |
| 5. Voice Bridge -> Agent OS canônico | IMPLEMENTADA / ATIVAÇÃO GOVERNADA | Kernel canônico + delivery policy. Agents `shadow/draft/off` não falam externamente. |
| 6. Telnyx -> Lumenva Voice Engine | IMPLEMENTADA / PROVA PSTN EXTERNA PENDENTE | tenant-first, worker persistente e segurança implementados. |
| 7. Transferência humana em duas fases | IMPLEMENTADA / PROVA PSTN EXTERNA PENDENTE | IA só é silenciada após takeover confirmado. |
| 8. LiveKit opcional | IMPLEMENTADA | caminho normal de IA não depende de LiveKit. |
| 9. Recording/métricas/observabilidade | IMPLEMENTADA / VALORES REAIS DEPENDEM DE PSTN | lifecycle/custos normalizados; recording fail-closed. |
| 10. Painel `Agente de Ligação` | IMPLEMENTADA COMO BASE OPERACIONAL | superfície tenant-scoped. |
| 11. Equivalência e remoção segura | IMPLEMENTADA | mídia genérica delegada; contratos CRM específicos preservados. |
| 12. E2E/evidência | IMPLEMENTADA PROVIDER-FREE / PROVA PSTN EXTERNA PENDENTE | simulador determinístico, safety evals, outbound correlation. |

## Hardening final implementado

- outbound público aceita somente `contact_id + agent_id + goal`;
- número bruto, primeira mensagem arbitrária e worker URL não vêm do cliente;
- CRM cria `voice_call_id` antes do dial e correlaciona provider `callId` real no `onCallStart`;
- reservas outbound concorrentes ambíguas para mesmo destino são rejeitadas;
- `voice_worker_endpoints` é service-only com RLS sem tenant policy + `REVOKE ALL` para `anon/authenticated`;
- cada worker envia `technical_phone_e164` em turnos e eventos;
- control plane verifica número técnico -> organização -> direção/call;
- inbound exige `called_number` = número técnico do worker;
- outbound exige `caller_number` = número técnico do worker;
- estados `completed/failed/canceled` não reabrem por evento tardio;
- `provider_call_id` conflitante não substitui o persistido;
- `VOICE_LIVE_ENABLED` é switch operacional, não autorização de Agent OS;
- worker possui healthcheck, non-root runtime e graceful shutdown.

## Gate canônico

```bash
bash scripts/verify-voice-core.sh
```

Inclui typecheck, suíte Voice Core/evals, worker syntax/tests, tenant binding, tenant-filter lint e `next build`.

### Estado do runner em 2026-08-27

O HEAD documental mais recente ainda não possui execução fresca do gate completo. Status observados:

- `Vercel – crm`: `build-rate-limit`;
- `Vercel – lumenva-website`: acesso/team invite.

Não converter isso em “passou” nem “falhou”. O próximo agente deve rodar o gate em runner funcional antes de declarar `final-green`. Checkpoints verdes anteriores estão em `lumenva-voice-engine-final.md`.

## Ativação externa — não é dívida de código

1. promover Product Agents autorizados via governance normal do Agent OS;
2. provisionar Telnyx real + número + conexão/public key;
3. deploy persistente de um Voice Worker por número técnico;
4. registrar número em `voice_phone_numbers` e worker em `voice_worker_endpoints`;
5. configurar Telnyx, `INTERNAL_SECRET`, Deepgram/ElevenLabs ou adapters substitutos;
6. configurar `VOICE_CONTROL_PLANE_URL`, `VOICE_WEBHOOK_HOST`, `TELNYX_PHONE_NUMBER` e portas;
7. executar inbound/outbound PSTN reais;
8. validar transferência humana real;
9. capturar latência/custo/provider IDs reais;
10. manter recording OFF até política/consentimento/disclosure permitirem.

## Regra para o próximo agente

Leia primeiro:

1. `docs/handoffs/HANDOFF-voice-core.md`;
2. `docs/current-state-voice-core.md`;
3. este arquivo;
4. `lumenva-voice-engine-final.md`;
5. `docs/superpowers/plans/2026-08-27-voice-core-canonical-status.md`;
6. plano Patter;
7. só então planos históricos.

Não redesenhar Voice Core a partir de LiveKit-first. Não alterar `main` nem fazer merge sem autorização explícita. Após qualquer mudança relevante, atualizar este arquivo, o handoff e a evidência final.
