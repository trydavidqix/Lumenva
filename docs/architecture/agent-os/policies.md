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

## Security principle

Removing a capability from the tool set or denying it in policy is a security boundary. Telling the model “do not do this” is guidance only.
