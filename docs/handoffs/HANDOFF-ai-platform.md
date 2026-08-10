# HANDOFF — AI Platform

**Date:** 2026-08-10  
**Branch:** `gpt-ai-platform`  
**Status:** PLANNED — NOT IMPLEMENTED  
**Base branch SHA when created:** `4fa4ca9a7042b88d6de35e411e4375213fb26d93`

## What is finished

The architecture/planning package for the AI Platform initiative has been written on this branch.

It includes:

- Codex execution rules;
- master architecture;
- QA/release gates;
- detailed Phase 0–7 implementation plans;
- test strategy;
- security/privacy boundaries;
- multi-tenant requirements;
- failure/rollback behavior;
- cost approval stops;
- rollout modes;
- explicit anti-patterns.

No product feature described by those plans should be assumed implemented merely because this handoff exists.

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

## First blocking problem to solve

The planning-time base `main@4fa4ca9` had a Vercel production build failure after recent website commits. The observed failure was a missing import/module around:

```text
website/app/api/contact/route.ts
@/lib/contact-form
```

Phase 0 Task 1 requires reproducing and fixing the actual merge/module root cause before any AI-platform implementation.

Do not hide this baseline failure with ignored TypeScript errors, removed build paths or deleted tests.

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
