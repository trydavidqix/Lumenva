# Lumenva Agent OS

## Purpose

This directory is the canonical architecture contract for the Lumenva Agent Operating System. It does not replace `CLAUDE.md`, `AGENTS.md`, domain specs, database doctrine, or the existing `lib/agent-engine`; it defines how those pieces compose into one governed agent platform.

## Canonical vocabulary

- **Agent** — decides what should happen within an explicit objective, capability set, budget and policy boundary.
- **Skill** — versioned procedural knowledge describing how to perform a class of task. A skill cannot grant itself tools or permissions.
- **Tool** — typed executable capability. Side effects are explicit, risk-classified, idempotent where retry is possible, and policy-checked outside the model.
- **Policy** — deterministic decision returning allow, deny or require-approval. Prompt text is never a security boundary.
- **Workflow** — durable sequence/state machine used when a task needs persistence, waits, approval, checkpoint/resume or multi-step recovery.
- **Event** — immutable business fact recorded in `event_log`.
- **Job** — work that needs processing. `job_queue`/future queue adapters are execution infrastructure, not business history.
- **Memory** — derived persistent context. It never overrides authoritative CRM/Postgres state.
- **Run** — auditable execution of a specific agent version against a trigger and tenant.

## Ownership hierarchy

```text
Supabase/Postgres         authoritative business state
        |
    event_log             business facts
        |
 execution layer          jobs/checkpoints/retries
        |
   Agent Kernel           orchestrates one run
   /   |    |    \
context skills tools models
          |
       policies
          |
       side effects
```

## Phase 2 canonical runtime

`lib/agent-engine/kernel/agent-kernel.ts` owns the canonical `AgentKernel.run()` orchestration. Its construction boundary is `createAgentKernelComposition()` in `lib/agent-engine/kernel/composition.ts`.

The Phase 2 modules have one responsibility each:

- `resolution.ts` — fail-closed agent/tenant/effective-version resolution before identity, context or runtime work; durable execution identity remains behind the identity port.
- `context-loader.ts` — authoritative CRM context remains distinct from derived memory; bounded skill loading applies tenant visibility, ACTIVE lifecycle, agent allowlist and progressive-disclosure limits.
- `runtime-adapter.ts` — certified capability-compatible model selection and provider-agnostic invocation/fallback behind `KernelRuntimePort`; fallback preserves run/trace/correlation identity and emits explicit events.
- `agent-kernel.ts` — bounded loop, Tool Gateway calls, approval pause, retry/failure classification, checkpoint/resume, verification, evidence, permitted memory writes and explicit termination.
- `composition.ts` — canonical wiring of those internal ports/adapters without enabling product autonomy.

The Agent Kernel does not own CRM truth, policy rules, provider-specific SDK types, or side effects. It composes those existing Phase 1 capabilities through ports. Product autonomy remains OFF/SHADOW until a later phase explicitly promotes it.

Verification evidence for the completed Phase 2 gate is recorded in `docs/architecture/agent-os/phase-2-verification.md`.

## Non-negotiable invariants

1. Do not create a second Agent Engine beside `lib/agent-engine`.
2. Agents never receive unrestricted `service_role` access.
3. Tenant identity comes from trusted server context, never model output.
4. All side-effecting capabilities pass through deterministic policy and idempotency controls.
5. New autonomy starts OFF/SHADOW and is promotable/rollbackable by tenant, agent and capability.
6. Provider/model/runtime choice is replaceable behind internal contracts.
7. `n8n` remains an integration edge, not source of truth or reasoning core.
8. External memory/graph systems are projections, not transactional authority.
9. Learning produces candidates; candidates require eval/promotion gates before ACTIVE behavior.
10. Evidence, not model self-report, moves runs/workflows to terminal success.

## Technology decisions

**Core now:** existing Agent Engine, Supabase/Postgres, `event_log`, `job_queue`/workers, Vercel AI SDK 7 inner loop, MCP/controlled APIs, n8n at the edge.

**Selective adapters:** LangGraph for genuinely stateful durable workflows requiring checkpoint/pause/resume.

**Reference/future adapters:** OpenAI Agents SDK, Claude/other agent SDKs, Hermes patterns.

**Deferred benchmark:** Inngest and Vercel Workflow after real SHADOW/ASSISTED workloads exist.

## Program phases

See `docs/superpowers/plans/2026-08-17-agent-os-master-implementation-plan.md` for the approved implementation program and gates.
