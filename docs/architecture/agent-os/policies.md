# Policies

## Purpose

Policies are deterministic controls outside model reasoning. They decide whether a requested capability is allowed, denied, or requires approval.

## Canonical decision

```ts
type PolicyDecision =
  | { kind: 'allow' }
  | { kind: 'deny'; reason: string }
  | { kind: 'require_approval'; reason: string; approvalType: string };
```

## Inputs

Policy evaluation may consider:

- organization/tenant identity;
- agent ID/version;
- autonomy level;
- tool ID/risk;
- user/actor permissions;
- data classification;
- communication consent/state;
- budget/state limits;
- business-specific approval thresholds.

Model-generated claims are never trusted as authorization facts.

## Autonomy levels

```text
OFF
SHADOW
DRAFT
ASSISTED
AUTOPILOT_LOW_RISK
AUTOPILOT_EXPANDED
```

Autonomy is scoped by organization + agent + capability and is rollbackable without deploy.

## Kill switches

The platform must support at least global, tenant, agent and capability kill switches. A kill switch must be enforceable before a side effect.

## Human approval

Approval is a durable state transition, not a long-running HTTP request. A run pauses, persists the approval request, and resumes only after a trusted approval event.

## Phase 5 assisted-autonomy policy

Phase 5 progresses only through `SHADOW -> DRAFT -> ASSISTED`. Promotion is deterministic, evidence-backed, stepwise, and initiated by a trusted human/governance path; a model cannot promote itself.

Risk boundaries remain:

- R0 read capabilities may execute when policy allows them;
- DRAFT suppresses side effects and returns/records a proposal instead;
- ASSISTED R1 requires valid promotion evidence before execution;
- R2 external communication and R3 sensitive commercial capabilities remain behind durable approval;
- R4 destructive/admin capabilities remain non-autonomous and are denied through the Agent OS path;
- runtime kill switches are re-evaluated before a side effect, so a capability can be stopped without deploy.

`AUTOPILOT_LOW_RISK` mechanics may exist for synthetic testing, but Phase 5 does not authorize customer promotion to autopilot. `AUTOPILOT_EXPANDED` remains outside Phase 5.

The authoritative Phase 5 closeout state is recorded in `phase-5-verification.md`. Until fresh verification is produced through an approved runner, Phase 5 is implementation-complete but verification-pending and no final GO is claimed.

## Security principle

Removing a capability from the tool set or denying it in policy is a security boundary. Telling the model “do not do this” is guidance only.