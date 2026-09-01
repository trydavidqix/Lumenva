# Tools

## Definition

A Tool is a typed executable capability exposed to agents through the Tool Gateway. Tools are not permissions: every invocation is still evaluated by deterministic policy.

## Required metadata

Every agent-visible tool must declare:

- stable tool ID and owner;
- input/output schema;
- risk level;
- whether it has side effects;
- whether idempotency is required;
- timeout and retry behavior;
- tenant scope rules;
- audit fields;
- approval requirements/policy hooks;
- provider/internal implementation adapter.

## Risk model

```text
R0 READ
R1 REVERSIBLE_WRITE
R2 EXTERNAL_COMMUNICATION
R3 SENSITIVE_COMMERCIAL
R4 DESTRUCTIVE_ADMIN
```

R4 is never autonomously executable. R3 requires explicit policy and commonly approval. R2 must respect communication/consent rules. R0/R1 are not automatically safe; tenant and data classification still apply.

## Capability intersection

A tool may execute only when all are true:

```text
agent allowlist
INTERSECT skill requirements
INTERSECT tenant/org capability
INTERSECT runtime availability
AND policy decision == allow
```

A Skill can request a tool but can never grant it.

## MCP

MCP is an adapter into the same Tool Gateway. MCP-exposed capabilities must receive identical policy, risk, tenant, idempotency and audit controls as internal tools. No privileged MCP bypass path is allowed.

## Dynamic exposure

The runtime should expose only the minimal tool subset needed for the current step/task. Owning 20 capabilities does not mean presenting 20 tools to the model every turn.
