# Agent OS Phase 4 — Pre-implementation Inventory

**Scope:** Phase 4 Shadow + Evals only.

**Execution exception:** On 2026-08-18 the project owner explicitly waived the earlier dependency that required the final Phase 3 closure Preview before Phase 4 implementation could start. This waiver applies only to that dependency. All other Phase 4 safety constraints remain in force: all Product Agents stay SHADOW, no production/main changes, no GitHub Actions, no remote migrations, no real external communications, no customer-visible or authoritative CRM side effects, no automatic promotion, and R4 remains non-autonomous.

## Existing assets to reuse

### Product Agent seed dataset

Phase 3 already provides `lib/agent-engine/product-agents/golden-cases.ts` with 13 seed cases covering the seven Product Agents, including Supervisor routing to every specialist and ambiguous fallback. Phase 4 should adapt and expand this dataset rather than replace it.

### Canonical Agent Kernel

Phase 4 eval execution must continue through `AgentKernel.run()` and the existing resolution, context, policy, Tool Gateway, model certification, loop guard, verification and evidence boundaries. No eval-only runtime or direct provider path should be introduced.

### Existing dry-run / run evidence storage

The existing `ai_agent_runs` schema already records tenant, agent/version, status, tokens, cost, latency, step count, tool calls and an `is_dry_run` flag. This is a strong candidate for Phase 4 run attribution and replay evidence. Phase 4 should inventory whether the canonical Agent Kernel currently writes enough metadata there before proposing any schema extension.

### Existing LLM usage storage

The harness already contains `llm_calls`, including organization, job, provider, model, token counts, cost and latency. Phase 4 quality-judge and replay metrics should reuse this attribution path where compatible instead of creating a second model-usage ledger.

### Existing generic metrics storage

The harness already contains a `metrics` table keyed by optional organization, metric name, JSON labels, value and timestamp. Phase 4 aggregate measurements are candidates for this storage because labels can carry non-PII identifiers such as agent ID/version, dataset version, source and model/provider. Do not add a new metrics table unless a concrete requirement cannot be represented safely.

### Existing flywheel judge infrastructure

`lib/agent-engine/flywheel/live.ts` already implements a real-turn judge/distiller loop, model-call attribution, verdict persistence and a mandatory human gate before proposals become behavior. Phase 4 should reuse its model-call/persistence boundaries where appropriate, but the new Governance/Judge role must never override deterministic hard gates or self-promote behavior.

### Existing flywheel verdict/proposal persistence

The repository already has `flywheel_judge_verdicts` and `flywheel_distiller_proposals` persistence paths. These may be reusable for subjective quality evidence and divergence/root-cause proposals, but Phase 4 should not force unrelated eval result shapes into them. Deterministic hard-gate evidence may remain in run/evidence storage if that is the cleaner canonical owner.

## Initial persistence decision

**Default: no migration.** Phase 4 implementation should first map its result model onto existing `ai_agent_runs`, run/evidence telemetry, `llm_calls`, `metrics`, and flywheel judge/proposal storage. A new migration is permitted only if an exact, testable persistence requirement remains impossible after that mapping. No remote migration may be applied as part of this phase without separate approval and verification.

## Historical replay preparation

Historical replay should use an injected read port rather than exposing a concrete Postgres/Supabase client in the eval API. Candidate selection must always receive an explicit `organizationId` and return only rows owned by that tenant.

Recommended replay buckets:

```text
support_basic
commercial_intent
retention_or_cancellation
angry_customer
ambiguous_message
human_escalation
low_context
high_context
policy_sensitive
human_outcome_good
human_outcome_corrected
```

Sampling must be stratified and deterministic enough to reproduce a batch. "Latest N" alone is not acceptable evidence because it can overrepresent one conversation type.

Repository fixtures remain synthetic or sanitized. Raw phone numbers, emails, message bodies containing customer identifiers, credentials, addresses or other direct PII must not be committed as golden fixtures. Historical replay should reference scoped IDs or construct ephemeral sanitized snapshots at runtime.

## Human-vs-agent comparison preparation

Human behavior is evidence, not the final authority. The comparison layer should classify disagreements as:

```text
agent_wrong
human_wrong_or_policy_conflict
both_valid
insufficient_evidence
requires_domain_review
```

Deterministic policy/security rules always outrank the human reference and any LLM judge.

## Metric ownership preparation

Phase 4 must be able to attribute every metric by at least:

```text
agent_id
agent_version
dataset_version
case_source
```

When available, also attribute:

```text
provider
model
organization_id for tenant-scoped internal evidence only
```

Required Phase 4 measures:

```text
routing_accuracy
factual_accuracy
tool_selection_accuracy
policy_compliance
escalation_correctness
structured_output_validity
shadow_side_effect_attempts
shadow_side_effects_executed
provider_fallback_rate
human_agent_divergence_rate
latency_ms
tokens
cost_cents
failure_rate
loop_stop_rate
coverage_by_agent_tag_source
```

No raw customer content belongs in metric labels.

## Safety test matrix prepared for implementation

The deterministic evaluator must eventually prove these hard gates at 100%:

```text
tenant scope preserved
cross-tenant request blocked
required structured output valid
forbidden tool selection rejected
policy cannot be overridden by model/judge
SHADOW executes zero side effects
critical escalation never missed
invalid output cannot complete successfully
credential/admin/destructive path denied
R4 remains non-autonomous
```

Per Product Agent focus:

```text
Supervisor       valid specialist routing; no self-route; safe ambiguity fallback
Atendimento      draft-only; grounded in authoritative CRM facts; no direct send
Sales            qualification/recommendation only; no unsupported commercial promises
Retention        recommendation only; sensitive-commercial escalation where required
Escalation       100% recall for critical cases; required context complete
CRM Operator     proposal-only; reversible R1 shape; zero authoritative mutation in SHADOW
Governance/Judge cannot self-promote, mutate policy or overrule deterministic failure
```

## Current execution state

Task 1 RED exists on branch `agent-os-phase-4-shadow-evals` at commit `c0cfe33e9b5293bc2dd84c2c029454b29716c067`. The production module `lib/agent-engine/evals/contracts.ts` is intentionally absent until the RED can be executed and confirmed. This preserves Superpowers TDD discipline while Vercel quota is unavailable.

## Next executable step

When a technical test environment becomes available, execute the Task 1 RED first. Only after confirming the expected missing-module failure may `lib/agent-engine/evals/contracts.ts` be implemented. Then proceed task-by-task through the approved Phase 4 plan with RED -> verified RED -> minimal GREEN -> verified GREEN.
