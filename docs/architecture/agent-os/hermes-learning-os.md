# Hermes Learning OS

## Status

Canonical learning architecture for the branch `design/hermes-unified-learning-os-2026-09-13`.

> Maestri orchestrates; Lumenva governs; the execution runtime executes; Hermes learns and proposes.

Hermes is not a second Agent Engine. It is the governed learning plane built on top of the existing Lumenva Flywheel. It observes bounded execution outcomes, creates or enriches improvement candidates, requires fresh evaluation evidence, and hands candidates to the existing approval/promotion path.

## Authority model

- Postgres/Lumenva remains the authoritative business state.
- `organization_id` is always server-derived or read from trusted persisted rows.
- Runtime, memory, retrieval and research stores are projections and evidence sources, never business authority.
- Hermes cannot expand its own permissions, activate changes, bypass policy, or self-promote.
- Business KPI gains never bypass safety or policy checks.

## Canonical flow

```text
Maestri
  ↓ mission/workforce orchestration
Lumenva Business OS
  ↓ policy / risk / approval / evidence / budget
Execution runtime (native today; Mastra-compatible boundary)
  ↓ sanitized observations
Hermes Learning OS
  ↓
normalize + sanitize
  ↓
cluster
  ↓
same-tenant research retrieval
  ↓
transferred evidence => mustRetest
  ↓
candidate manifest
  ↓
regression / golden / safety / shadow / business / cost-latency evals
  ↓
PASS | FAIL | NOT_EXECUTED | NOT_PROVEN | BLOCKED
  ↓
existing approval / promotion queue
  ↓
shadow / draft / monitoring
  ↓
keep or rollback
```

## Core components

### Existing Flywheel — canonical nucleus

The existing Flywheel remains the learning nucleus. Hermes extends it rather than introducing another learning engine. Existing clustering, proposal persistence, validation, rollout, monitoring and human approval behavior remain the compatibility base.

### Scientific research memory

`hermes_research_experiments` stores append-only experiment history. Knowledge transfer is same-tenant only and is advisory: every retrieved experiment is returned with `mustRetest: true`.

Design lineage: Helixforge V3 research-memory and cross-project experiment patterns.

### Capability trust

`hermes_capability_identities` binds trust to capability kind, canonical identity, content fingerprint, permission fingerprint and immutable revision when available. Changes in content, permissions or revision invalidate reusable trust.

Design lineage: Adaptive Expert capability fingerprinting and trust invalidation.

### Outcome ledger

`hermes_outcomes` links technical quality, latency, cost and optional business KPI observations to a run/mission/subject. KPI evidence is informative and may influence recommendations, but cannot approve or activate a candidate.

Design lineage: EINVIRKI outcome/KPI loops.

### Improvement candidates

Hermes supports existing Flywheel proposal kinds plus governed candidates for prompts, workflows, agent definitions, model policy, resource routing, memory/context policy, infrastructure and strategy. Candidate manifests include rollback target, eval requirements, risk and promotion policy references.

Design lineage: Alfred evidence-only improvement proposals.

### Provider-neutral runtime observations

Native, Mastra or external runtimes feed a single sanitized observation contract. Runtime choice is replaceable; learning semantics do not depend on one provider.

## Evidence states

Hermes uses explicit evidence states:

- `PASS` — current candidate has fresh supporting evidence.
- `FAIL` — executed and failed.
- `NOT_EXECUTED` — suite did not run.
- `NOT_PROVEN` — information exists but is not current proof for this candidate.
- `BLOCKED` — suite could not run because of a real blocker.

Old transferred success evidence is never treated as a current `PASS`.

## Promotion invariants

1. Model/Hermes cannot self-promote.
2. No direct jump to ACTIVE from a generated candidate.
3. Fresh evidence is required for the current candidate.
4. Safety/policy regressions dominate KPI improvements.
5. Critical safety regression chooses the safe rollback path.
6. Promotion remains bounded by existing autonomy policy and human/system authority.

## Tenant isolation

All durable Hermes stores contain `organization_id`, have RLS enabled, and repository reads/writes explicitly filter the trusted tenant when using administrative clients. Similarity or identical fingerprints across tenants never authorize cross-tenant retrieval.

## Scheduling

Hermes reuses the existing Flywheel scheduling boundary. It must not create a second scheduler. Periodic learning remains bounded by explicit signal, cluster, candidate, retrieval, eval, token, cost, runtime and no-progress budgets.

## UI/API

Hermes exposes read-only learning state through the existing AI evolution / Command surfaces. Raw transcripts, secrets and unredacted evidence payloads are not default UI material. There is deliberately no Hermes activation endpoint.

## Runtime migration compatibility

The execution runtime may migrate from the native Agent Kernel toward Mastra behind the runtime boundary. Hermes consumes normalized runtime observations and therefore does not need to change ownership or authority when that migration happens.

## Non-goals

- No second Agent Engine.
- No autonomous policy mutation.
- No direct production activation by Hermes.
- No replacement of Postgres/CRM truth with memory or research state.
- No cross-tenant learning corpus.
- No raw PII/secrets in learning artifacts.

## Design lineage

Helixforge, Adaptive Expert, EINVIRKI and Alfred are reference/design lineages only. They are not runtime dependencies of Lumenva Business OS.
