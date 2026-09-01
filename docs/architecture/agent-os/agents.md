# Agents

## Definition

An Agent is a logical decision-making role, not a deployment unit. Multiple logical agents may execute in the same runtime/process through the same Agent Kernel.

## Canonical run boundary

Phase 2 establishes `AgentKernel.run()` as the single canonical orchestration boundary for governed Agent OS runs. Product agents do not call providers or side-effecting tools directly; they are resolved as versioned definitions and executed through the kernel's internal ports.

The public kernel contract stays provider-agnostic. Vercel AI SDK 7 is an initial inner-loop adapter behind `KernelRuntimePort`, not part of an Agent's public definition or the Agent Kernel API.

A valid run is scoped to one organization, one effective agent version and one durable run/trace/correlation identity. Tenant mismatch, missing/disabled agents, invalid versions and lack of a certified compatible model fail closed before autonomous tool work.

## Required definition fields

Every production-capable agent definition must identify:

- stable agent ID;
- immutable/versioned agent version;
- objective and explicit non-goals;
- autonomy level;
- allowed skill selectors;
- allowed tool/capability selectors;
- model capability requirements rather than hard-coded provider where possible;
- loop/budget limits;
- escalation behavior;
- memory read/write policy;
- approval policy;
- eval suite/version used for promotion.

## Initial logical product agents

The target first set is intentionally small:

```text
Supervisor
Atendimento
Sales
Retention
Escalation
CRM Operator
Governance/Judge
```

Memory, Analytics, Integrations and Model Router are services/capabilities, not agents by default.

## Lifecycle

```text
OFF -> SHADOW -> DRAFT -> ASSISTED -> AUTOPILOT_LOW_RISK -> AUTOPILOT_EXPANDED
```

Promotion is scoped by organization + agent + capability. Rollback must not require a deploy.

Phase 2 does not promote customer-facing autonomy. SHADOW side-effecting calls are denied by deterministic policy and R4 destructive/admin tools remain non-autonomous at every autonomy level.

## Supervisor pattern

Supervisor owns routing/coordination. Direct free-form agent-to-agent chatter is not the primary internal architecture. Specialists return structured results to the supervisor/kernel. A2A is reserved for genuinely independent/distributed agent services.

## Run completion

An agent never declares itself successful merely by text. Terminal success requires deterministic verification through the kernel's verification port before execution is completed. A verified completion records evidence, permitted derived memory and business events; failed verification cannot return `completed`.

Canonical terminal and non-terminal states, budgets, retries, checkpoints and resume rules are defined by the shared contracts and execution docs.
