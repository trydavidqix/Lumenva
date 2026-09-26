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
- tooling/agent-loop/budget limits;
- escalation behavior;
- memory read/write policy;
- approval policy;
- eval suite/version used for promotion.

## Phase 3 product-agent layer

Phase 3 adds a focused `lib/agent-engine/product-agents/` layer on top of the existing kernel. It owns product role IDs, typed output contracts, immutable versioned definitions, golden cases and two narrow Kernel adapters: product-agent resolution and deterministic product-output verification. It does **not** own model execution, context loading, tool execution, durable execution, policy, approvals, memory persistence or provider invocation.

The initial stable IDs are:

```text
supervisor
atendimento
sales
retention
escalation
crm_operator
governance_judge
```

All seven initial definitions are version `1.0.0`, require structured-output capability and remain `SHADOW`. Their Phase 3 `allowedTools` lists are empty, so the product roles cannot request direct side effects. Existing deterministic SHADOW policy remains an additional kernel/tool-gateway safety boundary.

`createProductAgentResolver()` adapts an organization-scoped binding lookup into the existing Kernel `resolveAgent` port. It accepts only known product IDs, exact effective versions and matching bindings. Tenant mismatch and disabled-agent behavior are still enforced by the canonical kernel resolution path; unknown IDs or version drift fail closed.

`createProductAgentVerificationPort()` adapts the seven role-specific output validators into the existing `KernelVerificationPort`. A malformed product output cannot become a successful kernel completion. In particular, malformed Supervisor output fails deterministic verification and does not proceed to permitted memory write/completion.

These adapters make the product definitions executable through the canonical Agent Kernel without adding a second dispatcher or runtime. Phase 3 does not switch the existing production route to these product agents and does not promote customer-facing autonomy.

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

Their Phase 3 boundaries are:

- **Supervisor:** returns one structured specialist handoff. It cannot route to itself. Invalid or ambiguous output normalizes/fails toward escalation and human review; it does not dispatch another agent itself in SHADOW.
- **Atendimento:** produces a support response draft/recommendation only; it cannot send a message.
- **Sales:** produces lead qualification and a next-action recommendation/draft only; it cannot commit discounts, contracts or outbound sends.
- **Retention:** diagnoses bounded retention risk and recommends a human-reviewed action; it cannot make commercial commitments or contact a customer.
- **Escalation:** produces an explicit human-escalation package with priority and required context.
- **CRM Operator:** produces typed proposals for reversible CRM operations only. Phase 3 executes no CRM mutation; any later R1 execution must still pass the canonical Tool Gateway/policy path after an explicit promotion decision.
- **Governance/Judge:** evaluates outputs/golden cases and returns a non-binding governance recommendation. It cannot mutate policy, autonomy or deployment state.

Memory, Analytics, Integrations and Model Router are services/capabilities, not agents by default.

## Golden cases

`PRODUCT_AGENT_GOLDEN_CASES` provides deterministic Phase 3 coverage for every product role. Supervisor cases cover all six specialist targets plus a malformed/ambiguous fail-closed fallback; each specialist has at least one representative output that must satisfy its typed product contract.

Golden cases are an initial deterministic contract gate, not permission to promote autonomy. Phase 4 expands SHADOW/eval measurement before any move toward DRAFT or ASSISTED.

## Phase 4 SHADOW + eval architecture

Phase 4 adds `lib/agent-engine/evals/` as a focused evaluation boundary. It is not a second Agent Engine. Every executable eval still enters through the canonical `AgentKernel` using an explicit `eval_replay` trigger.

The evaluation order is deterministic-first and subjective-second:

1. tenant scope, structured output, tool selection, policy, SHADOW zero-side-effects, escalation, cross-tenant isolation, invalid-output blocking and R4 non-autonomy are evaluated as hard gates;
2. role-specific Product Agent validators enforce the Phase 3 output contracts and SHADOW boundaries;
3. optional quality judgement may score groundedness/quality only after deterministic evidence exists;
4. a quality judge can never convert a deterministic hard-gate failure into a pass.

Phase 4 supports two evidence sources:

- versioned synthetic/sanitized golden cases;
- tenant-scoped historical replay selected through an injected read-only port.

Historical replay candidates from another organization are discarded even if a faulty adapter returns them. Obvious direct email/phone fields are removed before replay artifacts leave the sampler. Repository fixtures must remain synthetic/sanitized; raw customer transcripts are not committed as eval evidence.

Human-reference behavior is evidence, not authority. `classifyDivergence()` distinguishes agent error, human/policy conflict, both-valid alternatives, insufficient evidence and domain-review cases. Deterministic policy always wins over a historical human action.

The Phase 4 quantitative gate is deliberately conservative. Hard safety/policy gates, SHADOW zero-side-effects, required structured output and critical escalation recall require 100%. Supervisor routing, tool selection, non-critical escalation and factual accuracy target at least 95%; specialist quality pass rate targets at least 90%. A weak individual agent cannot be hidden by a passing global average. Required historical evidence that is missing yields `INCOMPLETE`, not GO.

The existing flywheel remains a separate reusable learning/judge service with a human-gated proposal boundary. Phase 4 uses provider-agnostic injected quality-judge contracts rather than coupling eval contracts to the flywheel's current Anthropic/model-specific implementation. Existing flywheel behavior is not rewritten by Phase 4.

Phase 4 itself does not promote any Product Agent. All seven definitions remain `SHADOW`, direct Product Agent `allowedTools` remain empty, and any future DRAFT/ASSISTED promotion belongs to the separately governed Phase 5.

## Lifecycle

```text
OFF -> SHADOW -> DRAFT -> ASSISTED -> AUTOPILOT_LOW_RISK -> AUTOPILOT_EXPANDED
```

Promotion is scoped by organization + agent + capability. Rollback must not require a deploy.

Phase 2, Phase 3 and Phase 4 do not promote customer-facing autonomy. SHADOW side-effecting calls are denied by deterministic policy and R4 destructive/admin tools remain non-autonomous at every autonomy level.

## Supervisor pattern

Supervisor owns routing/coordination. Direct free-form agent-to-agent chatter is not the primary internal architecture. Specialists return structured results to the supervisor/kernel. A2A is reserved for genuinely independent/distributed agent services.

## Run completion

An agent never declares itself successful merely by text. Terminal success requires deterministic verification through the kernel's verification port before execution is completed. A verified completion records evidence, permitted derived memory and business events; failed verification cannot return `completed`.

Canonical terminal and non-terminal states, budgets, retries, checkpoints and resume rules are defined by the shared contracts and execution docs.
