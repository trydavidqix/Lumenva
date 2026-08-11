# HANDOFF — AI Platform

**Date:** 2026-08-11
**Branch:** `ai-platform-foundation`
**Status:** Fases 0–1 com `GO`; Fase 2 implementada até a Tarefa 8, sem gate de release
**Base branch SHA when created:** `4fa4ca9a7042b88d6de35e411e4375213fb26d93`

## Estado atual

Além do pacote de arquitetura e planos, a implementação já contém:

- Fase 0: contratos, flags tenant-aware, kill switches, projection ledger, Golden Dataset e gate `GO`;
- Fase 1: tracing LangSmith opcional e sanitizado, avaliador local e gate `GO`; LangSmith continua OFF;
- Fase 2, Tarefas 1–8: contrato e sanitização de memória, adapter REST Mem0, compose opcional isolado, projeção assíncrona idempotente, provider de contexto em shadow e fusão de prompt fail-closed.

O estado verificável da Fase 2 está em [`../evidence/ai-platform/phase-2-status.md`](../evidence/ai-platform/phase-2-status.md). Isto **não** é um gate: Mem0 não foi iniciado, não recebeu chave, não foi ativado em SHADOW/CANARY/ON e não houve alteração de produção.

Faltam a Tarefa 9 (lifecycle/rebuild LGPD) e a Tarefa 10 (gate da Fase 2), além da validação real do profile `ai-memory` no Windows. Não inicie a Fase 3 antes de um gate da Fase 2 com decisão explícita.

## Start here

```text
CODEX-AI-PLATFORM.md
  -> docs/superpowers/specs/2026-08-10-ai-platform-master-design.md
  -> docs/superpowers/specs/2026-08-10-ai-platform-qa-release-gates.md
  -> docs/superpowers/plans/2026-08-10-ai-platform-execution-index.md
  -> Phase 0 plan
```

## Plans

```text
docs/superpowers/plans/
├── 2026-08-10-ai-platform-execution-index.md
├── 2026-08-10-ai-platform-phase-0-foundation.md
├── 2026-08-10-ai-platform-phase-1-observability.md
├── 2026-08-10-ai-platform-phase-2-mem0.md
├── 2026-08-10-ai-platform-phase-3-knowledge.md
├── 2026-08-10-ai-platform-phase-4-graphiti.md
├── 2026-08-10-ai-platform-phase-5-guardrails.md
├── 2026-08-10-ai-platform-phase-6-n8n.md
└── 2026-08-10-ai-platform-phase-7-langgraph.md
```

## Important existing-system facts the implementation must respect

- The CRM already has durable memory (`org_memory`, `lead_notes`, checkpoints/state). Mem0 supplements it; it does not replace it.
- The CRM already has knowledge/RAG with pgvector and active-version safety. LlamaIndex supplements ingestion; it does not replace it.
- The CRM already has `event_log`, workers and an automation engine. n8n sits outside that core.
- The CRM already has native deterministic guardrails. External Guardrails are optional.
- The CRM already has a single LLM seam (`runModelCall`), which is the preferred observability/evaluation integration point.
- Tenant BYOK provider credentials already exist encrypted in PostgreSQL. Do not move them all to Infisical.
- MCP bearer tokens already carry org/scopes/role from `api_tokens`; use that for n8n instead of service role.

## Próximo ponto de parada

Não há bloqueio de código conhecido nas Tarefas 1–8. As pendências são deliberadas:

- Tarefa 9: apagar/reconstruir projeções semânticas com rastreabilidade LGPD;
- Tarefa 10: executar e registrar o gate da Fase 2;
- Windows: validar o Docker Compose do profile `ai-memory`, o health/bootstrap e o comportamento real do cabeçalho `Idempotency-Key`.

O Mac não deve instalar nem executar Docker para estas pendências. A feature do CRM permanece `OFF` até decisão humana posterior baseada no gate.

## Codex operating mode

Recommended execution mode: Superpowers subagent-driven development, one task at a time, with review/gate between tasks.

For each task:

```text
read exact task
 -> write failing test
 -> prove failure
 -> implement minimal change
 -> prove tests
 -> inspect diff
 -> commit only task scope
```

For each phase:

```text
all tasks
 -> full verification
 -> evidence file
 -> GO / NO-GO
 -> only then next phase
```

## What Codex must NOT do automatically

- merge to `main`;
- deploy experimental providers globally;
- mutate production Supabase just because migration files exist;
- create paid resources;
- turn SHADOW into CANARY/ON without gate evidence;
- expose Mem0/Graphiti/FalkorDB/Guardrails dashboards publicly;
- give n8n service-role access;
- use Mem0/Graphiti as official state;
- migrate every normal agent turn to LangGraph;
- remove failing tests to achieve green CI.

## Human checkpoints

A human decision is required before:

- any paid plan/card/billing resource;
- destructive production operation;
- canary/global activation that affects real customers;
- material provider/license change;
- final merge of the initiative to `main`.

## End condition

The implementation initiative ends only when `docs/evidence/ai-platform/final-initiative-gate.md` exists from Phase 7 execution and contains a justified `GO`, or when the team intentionally stops with a documented `NO-GO`/optional provider left OFF.
