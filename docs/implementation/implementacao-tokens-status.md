# Implementação Tokens — Status

Branch: `implementacao-tokens`

## Estado global

- Execução: **IN_PROGRESS**
- Estratégia: inline, sem subagents, sem merge para `main`.
- Fonte de verdade operacional: CRM atual da branch `implementacao-tokens`/`main`.
- Agent OS: reaproveitamento seletivo por módulo; merge bruto proibido.
- Critério de conclusão: evidência executável fresca por fase no estado exato da branch.

## Baseline de convergência

| Ref | SHA observado | Papel |
|---|---|---|
| `implementacao-tokens` | `1daa09c732932fc072601fc68743b338a179e62b` | branch de implementação; contém o plano inline |
| `main` | `3cd5c48ab08e9dbeed3d95896b7a0bbf1df7e35d` | runtime operacional atual |
| `agent-os-phase-3-product-agents` | `fee440134759c10345b19cead15fb5019ff32683` | Kernel + Product Agents + contratos |
| `agent-os-phase-4-shadow-evals` | `63181a1687833ed07ba994918e962d7352cfeb7c` | Shadow/Evals |
| `agent-os-phase-5-assisted-autonomy` | `7ca817c2f267ea44a96f16c2a9235f3f917657f8` | Policy/Approval/Autonomy/Tool Gateway hardening |
| `agent-os-phase-6-learning-flywheel` | `c89260f2eca600407b0d1381b11b85d4383304a8` | Learning Flywheel; uso posterior à base estável |
| `agent-os-phase-7-durable-benchmark` | `f40725a38c372383be300215c90e5b122f7d9410` | durable benchmark, multi-turn memory e router experimental |

## Matriz de fonte por módulo

| Módulo | Fonte vencedora | Decisão |
|---|---|---|
| WhatsApp/WAHA/Meta/multimodal | CRM atual | preservar; não substituir |
| Channel abstraction | CRM atual | preservar |
| Runtime `inbound-turn` | CRM atual | permanece hot path |
| LLM seam `runModelCall` | CRM atual | único seam de provider/modelo |
| Memória semântica atual | CRM atual | evoluir para Customer Memory estruturada |
| Handoff/casos humanos | CRM atual | Product Agent escalation deve adaptar a este ciclo |
| Multi-tenancy/RLS | CRM atual | invariante obrigatória |
| Guardrails/RAG | CRM atual | preservar e compor com Agent OS |
| Agent OS contracts | Agent OS Phase 3/5 | portar apenas invariantes ausentes |
| Agent Kernel | Agent OS Phase 3 | portar como governança, não runtime paralelo |
| Product Agents | Agent OS Phase 3 | portar definições/validadores em SHADOW/DRAFT-safe |
| Policy/Approval/Autonomy | Agent OS Phase 5 | portar/adaptar ao runtime atual |
| Shadow/Evals | Agent OS Phase 4 | portar/adaptar tipos atuais |
| Learning Flywheel | Agent OS Phase 6 | adiar ativação até a base convergida estar estável |
| Durable engine benchmark | Agent OS Phase 7 | não adotar engine novo enquanto gate seguir incompleto |
| Router Phase 7 | Agent OS Phase 7 | aproveitar conceitos/testes, não o `UnifiedModelClient` antigo |

## Conflitos conhecidos

- `main` e todas as branches Agent OS relevantes estão divergidas; merge bruto é inseguro.
- As próprias branches Agent OS divergem entre si; não existe uma única branch canônica completa.
- Colisão de migration: Agent OS Phase 7 possui `20260819130000_0123_agent_memory_tables.sql`, enquanto o CRM atual já usa outra migration `0123`; qualquer schema novo receberá timestamp/número único.
- `UnifiedModelClient` da linha Phase 7 não substitui `runModelCall`: o seam atual já possui BYOK por org, budgets, cache, tracing, métricas e providers Anthropic/OpenAI/Google.
- Product Agent `escalation` não pode criar estado paralelo de handoff.

## Progresso por fase

| Fase | Status | Observação |
|---|---|---|
| 1 — CRM + Agent OS convergence | IN_PROGRESS | Task 1 baseline em registro; execução de comandos depende de runner de checkout autenticado |
| 2 — Customer Memory | NOT_STARTED | depende da Fase 1 |
| 3 — Free-first Router | NOT_STARTED | depende da Fase 2 |
| 4 — WhatsApp 24/7 | NOT_STARTED | depende das fases 1–3 |
| 5 — Voice local | NOT_STARTED | |
| 6 — Telnyx/LiveKit | NOT_STARTED | |
| 7 — Caller recognition | NOT_STARTED | |
| 8 — Commercial tools | NOT_STARTED | |
| 9 — Orders + ETA | NOT_STARTED | |
| 10 — Human transfer | NOT_STARTED | |
| 11 — Media generation | NOT_STARTED | |
| 12 — Multiempresa hardening | NOT_STARTED | |
| 13 — Control plane UI | NOT_STARTED | |
| 14 — Evals/security | NOT_STARTED | |
| 15 — Observability/optimization | NOT_STARTED | |

## Regra de evidência

Nunca converter histórico de outra branch em `PASS` da branch convergida. Histórico é referência; fechamento requer execução fresca no SHA final de cada fase.
