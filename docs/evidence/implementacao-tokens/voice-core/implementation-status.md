# Lumenva Voice Engine — estado de implementação e handoff

Plan: `docs/superpowers/plans/2026-08-27-lumenva-voice-engine-patter-plan.md`  
Parent spec: `docs/superpowers/plans/2026-08-26-nucleo-ligacao-integration-plan.md`  
Master plan: `docs/superpowers/plans/2026-08-23-implementacao-tokens-master-plan.md`  
Branch de trabalho: `implementacao-tokens-voice-core`  
Data: 2026-08-27

## Estado de referência

O Voice Core foi implementado como **canal de voz do Agent OS existente**, não como uma segunda plataforma de agentes. A arquitetura vigente usa um `Lumenva Voice Worker` persistente com Patter para mídia/telefonia, Telnyx como carrier PSTN, Deepgram/ElevenLabs como adapters atuais de STT/TTS e o CRM/Agent OS como autoridade de identidade, memória, modelos, ferramentas, políticas, handoff e observabilidade.

A arquitetura antiga que colocava LiveKit no caminho obrigatório foi superada: LiveKit é opcional e reservado ao adapter de atendimento humano no navegador. Não reintroduzir LiveKit como requisito do caminho normal IA <-> cliente.

Último checkpoint de código antes da atualização documental de handoff: `cabfbec422aea370252a6909c28204306177ed65`. O HEAD documental anterior a este handoff era `1c8a95810cb3c7029d36e34fcec011cdf2409ae9`.

## Tasks do plano Patter

| Task | Estado | Evidência / nota |
|---|---|---|
| 1. Baseline + KEEP/ADAPT/REPLACE/OPTIONAL | IMPLEMENTADA | `patter-adoption-baseline.md` e `patter-equivalence.md`; identidade/persistência/segurança CRM preservadas. |
| 2. Fronteira proprietária `VoiceEngine` | IMPLEMENTADA | `lib/voice/engine/**`; contratos provider-neutral. |
| 3. Adapter Patter substituível | IMPLEMENTADA | `lib/voice/patter/adapter.ts` + factory; Patter não recebe autoridade de Agent OS/LLM/tools. |
| 4. Media pipeline Patter-backed | IMPLEMENTADA | STT/TTS/VAD/barge-in e telemetria atrás de adapters; persistência/dashboard/telemetria anônima Patter desativados. |
| 5. Voice Bridge -> Agent OS canônico | IMPLEMENTADA / ATIVAÇÃO GOVERNADA | Kernel canônico + delivery policy. Product Agents em `shadow` continuam corretamente impedidos de falar externamente até promoção normal de autonomia. |
| 6. Telnyx -> Lumenva Voice Engine | IMPLEMENTADA / PROVA PSTN EXTERNA NÃO EXECUTADA | assinatura/replay/normalização, resolução tenant-first e worker persistente implementados. |
| 7. Transferência humana em duas fases | IMPLEMENTADA / PROVA PSTN EXTERNA NÃO EXECUTADA | IA só é silenciada após confirmação do takeover. |
| 8. LiveKit opcional | IMPLEMENTADA | caminho normal de IA não depende de LiveKit; browser-human continua opcional. |
| 9. Recording/métricas/observabilidade | IMPLEMENTADA / VALORES REAIS DEPENDEM DE PSTN | CRM possui lifecycle e métricas normalizadas; recording falha fechado quando disclosure/consentimento é exigido. |
| 10. Painel `Agente de Ligação` | IMPLEMENTADA COMO BASE OPERACIONAL | superfície tenant-scoped; Patter não é exposto como conceito ao tenant. |
| 11. Equivalência e remoção segura de duplicação | IMPLEMENTADA | mídia genérica delegada; contratos CRM específicos preservados. |
| 12. E2E/evidência | IMPLEMENTADA PROVIDER-FREE / PROVA PSTN EXTERNA NÃO EXECUTADA | simulador determinístico, safety evals e testes de correlação outbound existem no gate. |

## Hardening final implementado

- Outbound público aceita somente `contact_id`, Product Agent id e `goal`; não aceita telefone bruto, primeira mensagem arbitrária nem URL de worker.
- CRM cria `voice_call_id` antes do dial e correlaciona o provider `callId` real no `onCallStart`.
- Reservas outbound concorrentes ambíguas para o mesmo destino são rejeitadas.
- `voice_worker_endpoints` é registry service-only com RLS sem policy de tenant e `REVOKE ALL` explícito para `anon` e `authenticated`.
- Cada worker envia `technical_phone_e164` em turnos e eventos de lifecycle.
- O control plane confirma que o número técnico pertence à organização da chamada e corresponde a `called_number` em inbound ou `caller_number` em outbound.
- Chamadas em estado terminal (`completed`, `failed`, `canceled`) não podem ser reabertas por evento atrasado.
- `provider_call_id` conflitante não pode substituir a identidade já persistida da chamada.
- `VOICE_LIVE_ENABLED` é somente switch operacional; nunca substitui autorização do Agent OS.

## Gate canônico

Executar no clone/local com dependências disponíveis:

```bash
bash scripts/verify-voice-core.sh
```

Esse gate inclui typecheck, suíte explícita Voice Core/evals, testes/syntax do worker, contrato de tenant binding, tenant-filter lint e `next build`.

### Estado do runner em 2026-08-27

O HEAD mais recente **não possui uma execução fresca do gate completo**. Os status GitHub/Vercel observados estavam bloqueados externamente:

- `Vercel – crm`: `build-rate-limit`;
- `Vercel – lumenva-website`: acesso/team invite.

Isto não deve ser convertido nem em “testes passaram” nem em “código falhou”. O próximo agente deve executar `bash scripts/verify-voice-core.sh` em um runner funcional antes de declarar o HEAD final-green.

Checkpoints anteriores que tiveram status READY durante a implementação estão registrados em `lumenva-voice-engine-final.md`.

## Ativação externa — não é dívida de código

Os itens abaixo não devem ser tratados como implementação esquecida. São provisionamento/prova real:

1. promover Product Agents autorizados a falar por voz usando a governance normal do Agent OS;
2. provisionar conta/número/conexão/public key Telnyx reais;
3. fazer deploy persistente de um Voice Worker por número técnico e registrar seu `control_url` em `voice_worker_endpoints`;
4. configurar secrets do worker: Telnyx, `INTERNAL_SECRET`, Deepgram e ElevenLabs (ou adapters substitutos);
5. configurar `VOICE_CONTROL_PLANE_URL`, `VOICE_WEBHOOK_HOST`, `TELNYX_PHONE_NUMBER` e portas;
6. executar inbound e outbound PSTN reais;
7. validar transferência humana real;
8. capturar latência/custo/provider IDs reais;
9. manter recording OFF até política/consentimento/disclosure permitirem.

## Regra para o próximo agente

Não redesenhar o Voice Core partindo do plano antigo. Ler nesta ordem:

1. `docs/handoffs/HANDOFF-voice-core.md`;
2. este arquivo;
3. `lumenva-voice-engine-final.md`;
4. plano Patter de 2026-08-27;
5. somente então o plano de integração de 2026-08-26 e o master plan.

Qualquer divergência entre documentos antigos e o código atual deve ser resolvida a favor do código + evidência mais recente, e documentada. Não alterar `main` nem fazer merge sem autorização explícita.