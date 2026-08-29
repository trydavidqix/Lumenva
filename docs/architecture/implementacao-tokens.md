# Implementação Tokens — Arquitetura Convergida

## Objetivo

Convergir o CRM operacional atual com os contratos de governança do Agent OS sem substituir o caminho de produção já provado para WhatsApp/multimodal, e então adicionar memória estruturada, roteamento free-first, voz e telefonia sobre as mesmas fronteiras de segurança, tenancy e observabilidade.

## Invariantes

1. **Uma fonte de verdade operacional:** Postgres/CRM continua autoritativo para cliente, lead, pedido, pagamento, consentimento, disponibilidade e status comercial.
2. **Um hot path de atendimento:** `lib/agent-engine/agent/inbound-turn.ts` continua sendo o runtime de turno; Agent Kernel governa/adapta esse caminho, não cria um segundo loop de atendimento.
3. **Um seam de LLM:** toda chamada de modelo passa por `lib/agent-engine/edge/llm/run-model-call.ts`.
4. **Um caminho de envio:** comunicação externa usa ChannelAdapter/Tool Gateway/guardrails atuais; Product Agents não enviam por SDK/provider próprio.
5. **Memória é projeção:** Customer Memory e memória semântica são contexto derivado, nunca autorização para alterar fatos comerciais autoritativos.
6. **Tenant first:** todo dado tenant-aware carrega `organization_id`; RLS e filtros explícitos de service role são obrigatórios.
7. **Policy fora do modelo:** decisões `allow | deny | require_approval`, kill switches, risco R0–R4 e idempotência são determinísticos.
8. **Sem bypass MCP:** MCP é adapter do mesmo Tool Gateway e recebe as mesmas políticas.
9. **Fallback explícito:** troca de provider/modelo é observável; nunca silenciosa.
10. **Evidência por SHA:** uma fase só fecha com testes executados no estado exato da branch convergida.

## Arquitetura alvo

```text
WhatsApp (WAHA/Meta) ─┐
                      ├─> Channel/Identity Resolver ─> Customer Memory
Telefone ─ Telnyx ─ LiveKit ─┘                         │
                                                       v
                                                Agent Kernel
                                                       │
                           ┌───────────────────────────┼───────────────────────────┐
                           v                           v                           v
                     Product Agents               Policy Engine               Evals
                           │                           │
                           └──────────────> Tool Gateway <──────────────┐
                                              │                        │
                              CRM / Orders / ETA / Human / Media       │
                                              │                        │
                                              └────> canonical LLM seam│
                                                        │              │
                                                  Free-first Router ───┘
                                                        │
                                             provider adapters/certification
```

## Fonte por subsistema

### CRM atual vence

- WhatsApp/WAHA/Meta e multimodal;
- channel adapters;
- `inbound-turn` e workers atuais;
- `runModelCall`, BYOK, budget, cache, usage/cost/latency;
- semantic memory, compaction, checkpoints e lazy notes;
- handoff/casos humanos e retomada;
- guardrails, RAG, observabilidade existente;
- multi-tenancy/RLS.

### Agent OS é port seletivo

- run-status/loop-budget/tool-risk/ExecutionPort contracts;
- Agent Kernel ports/composition/resolution;
- Product Agent definitions e validators;
- Policy/Approval/Autonomy/Tool Gateway invariants;
- Shadow/Evals e golden/adversarial cases.

### Agent OS Phase 7 não é runtime canônico

O `UnifiedModelClient` experimental da Phase 7 não substitui `runModelCall`. O durable benchmark Phase 7 continua referência até existir gate conclusivo; `event_log`/`job_queue`/workers atuais permanecem o execution adapter inicial.

## Sequência de convergência

1. Congelar baseline e mapa de branches.
2. Portar contratos Agent OS mínimos.
3. Portar Kernel como camada de governança.
4. Portar Product Agents como definições governadas.
5. Convergir policy/approval/autonomy/tool gateway.
6. Portar shadow/evals.
7. Fechar regressão da Fase 1 antes de schema de Customer Memory.

## Regras para memória e custo

- Quick memory deve ser bounded e pequena o suficiente para entrar em todos os turnos.
- Histórico detalhado, notas completas e pedidos antigos são lidos sob demanda via tools R0.
- Contexto autoritativo sempre prevalece sobre memória derivada.
- Router escolhe primeiro por capability/policy/privacy/availability; custo é critério posterior.
- Free-first significa preferência por custo zero/menor **entre opções elegíveis**, com fallback explícito configurado.

## Regras para voz/telefonia

- Voz reutiliza identidade, memória, Kernel, Tool Gateway e Router do WhatsApp.
- Telnyx/LiveKit são adapters de transporte, não um segundo cérebro.
- Caller ID resolve organização/cliente por fonte confiável antes de carregar memória.
- Transferência humana de voz deve reutilizar o ciclo de escalonamento/caso humano, adaptando o transporte.
