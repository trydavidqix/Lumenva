# AI Platform — Execution Index

**Branch:** `ai-platform-foundation`
**Entry point:** `CODEX-AI-PLATFORM.md`  
**Master spec:** `docs/superpowers/specs/2026-08-10-ai-platform-master-design.md`  
**QA gates:** `docs/superpowers/specs/2026-08-10-ai-platform-qa-release-gates.md`

## Estado de execução em 2026-08-15

| Fase | Estado | Evidência atual | Limite para avançar |
|---|---|---|---|
| 0 | `GO` | [`phase-0-gate.md`](../../evidence/ai-platform/phase-0-gate.md) | concluída |
| 1 | `GO` | [`phase-1-gate.md`](../../evidence/ai-platform/phase-1-gate.md) | concluída; LangSmith continua OFF |
| 2 | `GO`, FECHADA | [`phase-2-status.md`](../../evidence/ai-platform/phase-2-status.md), [`phase-2-mem0-gate.md`](../../evidence/ai-platform/phase-2-mem0-gate.md) | Tarefas 1–10 concluídas, gate completo. `SHADOW` verificado ponta a ponta (mensagem real → consumer real → Mem0 real) escopado a 1 org de teste descartável; nenhum tenant real promovido. Sem bloqueio técnico restante para a decisão de produto de promoção real |
| 3 | `GO`, FECHADA | [`phase-3-knowledge-gate.md`](../../evidence/ai-platform/phase-3-knowledge-gate.md) | Tarefas 1–9 concluídas via subagent-driven-development (implementação + review por task + fix rounds), seguidas de revisão final whole-branch (2 Important + 10 Minor, todos corrigidos), re-verificação completa na árvore mesclada (`typecheck`/`lint`/`lint:channels`/`test:unit` 321/321·3287/3287/`test:db` 72/72·480+1 skip/`ai:eval:local`/`build` todos verdes) e re-review escopada do fix wave (13/13 endereçado, zero breakage). `native` continua default; LlamaIndex OFF/SHADOW por feature flag. Publicada em `origin/main` |
| 4 | `GO`, FECHADA | [`phase-4-graphiti-gate.md`](../../evidence/ai-platform/phase-4-graphiti-gate.md) | Tarefas 1–10 concluídas via subagent-driven-development, seguidas de revisão final whole-branch ("With fixes": 5 Important, todos corrigidos e re-verificados por sabotagem real), re-verificação completa (`typecheck`/`lint`/`lint:channels`/`test:unit` 332/332·3457/3457/`test:db` 72/72·480+1 skip todos verdes). Desvio de arquitetura aprovado pelo humano: sidecar trocado de FalkorDB para Neo4j (imagem oficial do Graphiti só suporta Neo4j — confirmado por issue pública upstream getzep/graphiti#749). Limitação LGPD conhecida e documentada: redact por contato não remove fatos já projetados no Neo4j (API do Graphiti só deleta grupo inteiro) — decisão de compliance pendente antes de habilitar `SHADOW` para tenant real. Caminho de leitura (`GraphitiContextProvider`) ainda não conectado no worker de produção — nenhuma métrica de `SHADOW` é coletada hoje. Fica em `SHADOW`/OFF por padrão (nenhuma linha em `ai_platform_feature_flags` = off). Publicada em `origin/main` |
| 5–7 | não iniciadas | — | gate da fase anterior e aprovação humana aplicável |

Esta tabela é um snapshot operacional. Os planos preservam tarefas/checklists originais e não são reescritos como histórico de execução.

## Purpose

This file is the execution map for Codex. It does not replace the phase plans. It prevents the implementation agent from guessing which plan comes next, which gates are blocking, or which external systems are optional.

## Mandatory execution order

| Order | Plan | Primary deliverable | Default end mode | Hard dependency |
|---|---|---|---|---|
| Gate 0 / Phase 0 | `2026-08-10-ai-platform-phase-0-foundation.md` | green baseline, contracts, flags, projection ledger, Golden Dataset, secrets operating model | external providers OFF | none |
| Phase 1 | `2026-08-10-ai-platform-phase-1-observability.md` | LangSmith adapter, redaction, baseline/evaluation | SHADOW/OFF | Phase 0 GO |
| Phase 2 | `2026-08-10-ai-platform-phase-2-mem0.md` | Mem0 projection + context provider + rebuild | SHADOW | Phase 1 GO |
| Phase 3 | `2026-08-10-ai-platform-phase-3-knowledge.md` | Obsidian publish flow + optional LlamaIndex adapter | native default; LlamaIndex OFF/SHADOW | Phase 2 stable in SHADOW |
| Phase 4 | `2026-08-10-ai-platform-phase-4-graphiti.md` | Graphiti/FalkorDB projection + temporal retrieval + rebuild | SHADOW | Phase 3 GO |
| Phase 5 | `2026-08-10-ai-platform-phase-5-guardrails.md` | gap analysis + optional external validator | OFF unless measured benefit | Phase 4 GO |
| Phase 6 | `2026-08-10-ai-platform-phase-6-n8n.md` | n8n adapter over existing automation/MCP boundaries | OFF/CANARY | Phase 5 resolved |
| Phase 7 | `2026-08-10-ai-platform-phase-7-langgraph.md` | one proposal-approval HITL workflow | SHADOW/CANARY | Phase 6 GO or n8n intentionally OFF |

## Blocking rule

At the end of every phase:

```text
run tests
  -> write evidence
  -> classify P0/P1/P2
  -> GO or NO-GO
```

- P0 open => `NO-GO`.
- P1 open => `NO-GO` for promotion/next phase unless the P1 belongs to an explicitly optional feature that remains OFF and the evidence explains why it is safe to continue independent work.
- P2 may remain only with issue/evidence and no hidden impact on a later dependency.

## Human approval stops

Codex must stop the affected task and request human action when any of these occurs:

1. a required service/resource is paid or requires billing/card/upgrade;
2. a production secret/account must be created interactively and cannot be safely automated;
3. a destructive production operation is required;
4. promotion from SHADOW to CANARY/ON is being considered without prior gate evidence;
5. a provider/license choice materially changes cost or legal/deployment terms;
6. the only way to proceed would weaken security, remove a failing test, bypass RLS, expose a private service, or alter source-of-truth boundaries.

Independent tasks may continue after recording the blocker.

## Cross-phase contracts that must not drift

### Source of truth

```text
PostgreSQL/Supabase = official state
Mem0               = semantic projection
Graphiti/FalkorDB   = graph projection
pgvector            = official knowledge index
LangSmith           = telemetry/eval
n8n                 = integration
LangGraph           = complex workflow executor
```

### Rollout

```text
OFF -> SHADOW -> CANARY -> ON
```

No provider invents a fifth mode.

### Authority domains

Canonical values:

```text
commercial_status
customer_preference
consent
legal
product_policy
relationship
behavior
operational_state
```

Do not rename per subsystem.

### Memory risk

Canonical values:

```text
low
medium
high
```

`high` means derived context can inform a confirmation/handoff but cannot itself authorize the sensitive action.

### Projection idempotency

Every derived write uses:

```text
event/source identity
organization_id
source_version
projection type/provider
idempotency_key
```

and is tracked in `ai_projection_ledger`.

### Tenant identity

`organization_id` is derived from trusted CRM auth/event/token/job state. It is never accepted from an LLM response or arbitrary integration payload as authorization.

## External dependency matrix

| Component | Required for core CRM? | Initial deployment | If unavailable |
|---|---:|---|---|
| LangSmith | no | external account/API, optional | tracing/eval export disabled |
| Mem0 | no | self-host sidecar/profile | native memory only |
| LlamaIndex | no | library in CRM worker | native ingestion/RAG |
| Obsidian | no | human desktop vault | other knowledge sources continue |
| Graphiti | no | self-host sidecar/profile | no graph context |
| FalkorDB | no | self-host sidecar/profile | Graphiti disabled |
| Guardrails AI | no | only if gap analysis justifies | native guardrails only |
| n8n | no | standalone self-host stack | integration delivery retries/disabled |
| LangGraph | no | TypeScript library + Postgres checkpointer | native agent runtime/manual workflow |
| Infisical | no for product semantics | secrets management control plane | documented fallback/break-glass; no secret in Git |
| KeePassXC | human only | local vault | apps unaffected |

## Expected branch evolution

Phase commits should remain reviewable. Do not squash the whole initiative into one implementation commit while working. Suggested commit namespaces:

```text
fix:                baseline repairs
feat(ai-platform):  shared foundation
feat(ai-observability): LangSmith/tracing
test(ai-platform):  Golden Dataset/evals
feat(memory):       Mem0
feat(knowledge):    publication/LlamaIndex
feat(graph):        Graphiti/FalkorDB
feat(guardrails):   optional external validation
feat(n8n):          CRM integration boundary
feat(workflows):    LangGraph pilot
ops(...):           compose/runbooks
docs(...):          evidence/gates
```

## Completion definition

This initiative is not complete because files/plans exist. It is complete only after implementation and the final initiative gate in Phase 7 says `GO` with evidence.

Optional providers are allowed to remain `OFF` if their experiment does not prove enough value. “We evaluated it and did not activate it” is a valid professional outcome; forcing every named tool into production is not.
