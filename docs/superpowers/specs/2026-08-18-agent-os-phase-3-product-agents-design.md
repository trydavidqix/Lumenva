# Agent OS Phase 3 — Product Agents Design

## Goal

Introduce the first logical product-agent roles on top of the canonical Phase 2 `AgentKernel` without creating a second runtime, enabling customer-facing autonomy, or changing authoritative CRM ownership.

## Architectural decision

Phase 3 uses **one Agent Kernel, many versioned product-agent definitions**. Product agents are configuration plus typed product contracts. They do not call providers, Supabase privileged credentials, n8n, WhatsApp, email, or side-effecting capabilities directly.

The canonical run path remains:

```text
trigger
  -> resolve organization + effective agent version
  -> AgentKernel.run()
  -> authoritative CRM context + derived memory
  -> governed skill activation
  -> governed tool resolution
  -> certified model/runtime adapter
  -> deterministic verification
  -> evidence + derived memory + terminal result
```

`Supervisor` coordinates by returning typed handoff decisions. It does not create a parallel dispatcher and does not directly execute another agent inside its model loop in Phase 3.

## Global constraints

- Branch work is isolated from `main` and production.
- Phase 3 starts and remains `shadow` unless a later explicit GO promotes a role.
- SHADOW must produce zero side effects by deterministic policy, not prompt convention.
- No remote migrations are required for Phase 3 product definitions/contracts.
- Supabase/Postgres remains authoritative business state; memory is derived context only.
- Existing Agent Kernel composition/runtime/policy/tool gateway remain canonical.
- Product-agent code must not import provider-specific invocation APIs.
- R4 destructive/admin actions remain non-autonomous.
- Customer communications remain drafts/recommendations only in Phase 3.
- Every role gets deterministic contract tests and golden cases before Phase 3 GO.

## Product roles

### Supervisor

Purpose: classify incoming work and recommend one specialist handoff.

Output contract:

```ts
interface SupervisorHandoffDecision {
  targetAgent: 'atendimento' | 'sales' | 'retention' | 'escalation' | 'crm_operator' | 'governance_judge';
  reason: string;
  confidence: number;
  requiresHumanEscalation: boolean;
}
```

Rules:

- `confidence` is finite and between 0 and 1.
- Unknown/unsafe/ambiguous work routes to `escalation` with `requiresHumanEscalation: true`.
- Supervisor has no side-effecting tools in Phase 3.
- Supervisor does not dispatch the target itself in SHADOW.

### Atendimento

Purpose: produce a customer-support response recommendation from authoritative CRM/inbox context.

Rules: draft/recommendation only; no message send; no direct CRM mutation.

### Sales

Purpose: qualify a lead and recommend the next commercial action.

Rules: no external send; no discount/contract mutation; sensitive commercial actions remain gated.

### Retention

Purpose: diagnose churn/retention risk and recommend a retention action.

Rules: recommendation only; no outbound communication or commercial commitment.

### Escalation

Purpose: produce a structured human/governed escalation decision when uncertainty, policy, risk, or missing context blocks safe handling.

### CRM Operator

Purpose: propose structured CRM mutations. It is the only Phase 3 role designed to eventually use reversible R1 writes, but remains SHADOW in this phase so no mutation executes.

### Governance/Judge

Purpose: evaluate agent outputs/golden cases against deterministic criteria and produce a typed judgement. It may recommend promotion/blocking but cannot change policy, autonomy, or deployment state itself.

## Canonical product-definition layer

Create a focused `lib/agent-engine/product-agents/` module. It owns stable product role IDs, typed output contracts, versioned `AgentDefinition` values, and pure validation helpers. It must not own execution.

Suggested structure:

```text
lib/agent-engine/product-agents/
  contracts.ts
  definitions.ts
  supervisor.ts
  atendimento.ts
  sales.ts
  retention.ts
  escalation.ts
  crm-operator.ts
  governance-judge.ts
  index.ts
```

Definitions must reuse `AgentDefinition` from `lib/agent-engine/contracts/agent-os.ts` and use `autonomyLevel: 'shadow'`.

## Verification strategy

Each slice follows RED -> GREEN -> REFACTOR. Tests assert real product contracts rather than provider mocks. The Phase 3 suite must prove at minimum:

- all seven stable role IDs are unique;
- all initial definitions are SHADOW;
- Supervisor has no side-effecting tool selectors and validates only known targets;
- ambiguous Supervisor output escalates safely;
- customer-facing roles expose recommendation/draft contracts rather than send operations;
- CRM Operator remains SHADOW and cannot bypass Tool Gateway policy;
- Governance/Judge cannot promote itself or mutate autonomy;
- definitions require certified model capabilities through the existing kernel contract;
- no product role introduces provider-specific runtime calls;
- Phase 2 kernel regressions remain green.

## GO gate

Phase 3 receives GO only when all seven roles have versioned definitions, typed contracts, golden cases, targeted tests, full typecheck/build/test verification on the exact final code SHA, and a controlled Lumenva Vercel Preview reaches READY. No production deployment or autonomy promotion is part of this GO.