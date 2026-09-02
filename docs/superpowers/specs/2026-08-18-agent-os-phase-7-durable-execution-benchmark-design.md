# Agent OS Phase 7 Durable Execution Benchmark Design

**Status:** Approved design for planning. Benchmark only; no migration or production rollout is authorized by this phase.

## Goal

Compare the existing Deskcomm durable execution stack against Inngest and Vercel Workflow using the same deterministic synthetic workload, failure schedule and evidence contract, then produce one evidence-backed recommendation: `KEEP_CURRENT`, `ADOPT_INNGEST`, `ADOPT_VERCEL_WORKFLOW`, or `NO_GO`.

Phase 7 does not migrate the Agent OS. Any later adoption requires a separate approved migration phase.

## Why this phase exists

Deskcomm already has durable execution primitives around Postgres/Supabase, `event_log`, `job_queue`, workers, Agent OS execution/checkpoint/idempotency/approval contracts and observability. External workflow runtimes are only justified if they materially improve correctness, recovery, operability or maintainability without weakening multi-tenant safety or increasing unacceptable lock-in.

## Benchmark competitors

Exactly three engines are benchmarked as first-class competitors:

1. `current` — existing Deskcomm event/job/worker execution path.
2. `inngest` — isolated Inngest benchmark adapter.
3. `vercel_workflow` — isolated Vercel Workflow benchmark adapter.

No competitor is treated as the expected winner. `KEEP_CURRENT` is a successful Phase 7 outcome.

## Architectural boundary

Add an isolated benchmark subsystem under `lib/agent-engine/durable-benchmark/`. It owns benchmark-only contracts, synthetic scenarios, fault injection, engine adapters, evidence normalization, hard gates and scoring. It does not create another Agent Kernel, another CRM source of truth, or a replacement production scheduler.

The benchmark runner invokes a common adapter contract so every engine receives the same scenario version, synthetic tenant identity, input, failure schedule, approval decisions and idempotency keys.

Conceptual flow:

```text
Versioned Scenario
  -> Benchmark Harness
     -> Current Deskcomm Adapter
     -> Inngest Adapter
     -> Vercel Workflow Adapter
  -> Normalized Evidence
  -> Hard Gates
  -> Weighted Score
  -> Decision
```

Provider-specific SDK objects may exist only inside the corresponding adapter. Shared benchmark contracts remain provider-neutral.

## Synthetic-only workload

The benchmark uses no customer history and no real customer-visible effect. All tenant IDs, run IDs, payloads, approvals and effect records are synthetic.

The canonical journey is:

```text
START
 -> step A succeeds
 -> step B receives deterministic transient failure
 -> retry step B succeeds
 -> request synthetic approval
 -> pause
 -> simulate process interruption
 -> resume after synthetic approval
 -> step C attempts the same synthetic effect twice
 -> idempotency allows exactly one committed effect
 -> step D completes
 -> evidence and metrics collected
END
```

The synthetic side effect is an in-memory/test-store or isolated benchmark record such as incrementing a keyed counter. It must never send WhatsApp/email, mutate authoritative CRM state, call a real customer webhook or create a production job.

## Versioned scenario suite

Phase 7 starts with eight deterministic scenarios:

1. `happy_path`
2. `transient_retry`
3. `retry_exhausted`
4. `approval_pause_resume`
5. `process_crash_recovery`
6. `duplicate_delivery_idempotency`
7. `approval_denied_or_expired`
8. `tenant_isolation`

Each scenario has a stable ID, version, synthetic organization IDs, deterministic fault schedule, expected terminal state and expected effect count.

The same scenario definition must be consumed by all three adapters; provider-specific branches are forbidden in scenario expectations.

## Common adapter contract

The benchmark contract should expose a small provider-neutral surface similar to:

```ts
export type DurableBenchmarkEngineId = 'current' | 'inngest' | 'vercel_workflow';

export interface DurableBenchmarkAdapter {
  readonly engineId: DurableBenchmarkEngineId;
  run(input: DurableBenchmarkRunInput): Promise<DurableBenchmarkRunResult>;
}
```

`DurableBenchmarkRunInput` carries the scenario, synthetic organization scope, stable run identity and fault schedule. `DurableBenchmarkRunResult` carries normalized lifecycle events, retries, approval/pause/resume evidence, effect attempts/commits, recovery evidence, terminal state, timing and engine metadata.

## Deterministic fault injection

Fault injection is controlled by the benchmark harness, never random by default. A fault plan identifies the exact logical step and occurrence to fail, crash or duplicate.

Required injected conditions:

- transient step failure;
- permanent/retry-exhaustion failure;
- worker/process interruption after a durable checkpoint;
- duplicate event/delivery;
- approval wait;
- approval rejection;
- approval expiration;
- cross-tenant access attempt.

A seeded stress mode may be added later, but deterministic golden scenarios remain the promotion gate.

## Hard gates

An engine is disqualified from `ADOPT` if any required run demonstrates:

- cross-tenant state read/write;
- more than one committed synthetic effect for the same idempotency key;
- lost run after a recoverable process interruption;
- resume at the wrong logical step;
- progress beyond an approval boundary without a valid approval;
- progress after approval rejection or expiration;
- retries above the scenario limit;
- a terminal failure reported as successful completion;
- missing durable evidence needed to reconstruct the run.

These gates are evaluated before weighted scoring. Speed or cost cannot compensate for a hard-gate failure.

## Weighted score

Only engines that pass all mandatory hard gates are scored:

```text
reliability              40%
durability               20%
observability            15%
operational simplicity   10%
performance               5%
cost                      5%
lock-in / maintainability 5%
```

Quantitative sub-scores must have explicit formulas and raw numerators/denominators. Qualitative operational/lock-in scores require a documented rubric rather than free-form preference.

## Adoption rule

An external engine can receive `ADOPT_*` only if all are true:

1. it passes every hard gate;
2. the current engine also has a complete benchmark result, so the comparison is meaningful;
3. its weighted score exceeds the current engine by at least 10 percentage points;
4. no safety or required capability is weaker than current;
5. the result is reproducible across the required repeated runs.

Otherwise the decision is `KEEP_CURRENT`. If evidence is incomplete or no engine satisfies minimum correctness, the decision is `NO_GO`/`INCOMPLETE` as appropriate.

## Loads and repetition

Run the suite at three controlled profiles:

- `small`: correctness-oriented, minimal concurrency;
- `medium`: representative concurrent synthetic runs;
- `stress`: bounded concurrency sufficient to expose recovery/idempotency behavior without becoming a load-testing project.

Every golden scenario is repeated multiple times per engine/profile. Exact counts are frozen in the implementation plan and evidence document so results cannot be cherry-picked.

## Observability and evidence

Every engine emits normalized benchmark evidence sufficient to reconstruct:

- scenario/version;
- engine/version;
- synthetic organization/run IDs;
- ordered logical steps;
- retry attempts and reasons;
- checkpoint/pause/resume transitions;
- approval decision and expiry state;
- fault injections;
- synthetic effect attempts and committed count;
- recovery after interruption;
- terminal state;
- duration and per-step timing;
- provider/runtime request identifiers when safe;
- estimated/measured execution cost where available.

Repository evidence contains no secrets, real tenant identifiers, raw provider credentials or customer PII.

## Current-engine fairness

The existing Deskcomm stack is implemented through an adapter that reuses existing execution, queue, idempotency, approval and observability boundaries. The benchmark must not artificially cripple it or bypass capabilities already available to production code.

Likewise, external engines may use their documented durable primitives, but must not receive an easier scenario or relaxed gate.

## Inngest isolation

Inngest code and dependencies remain behind `durable-benchmark/adapters/inngest/`. The feature is OFF by default and benchmark-only. It must not become the runtime for normal Agent OS jobs during Phase 7.

A real-engine comparison requires an isolated test/dev Inngest environment. If the required external account/credentials are not already available to the autonomous execution environment, Phase 7 records that engine as `INCOMPLETE`; it must not substitute a fake adapter and call it a real provider benchmark.

## Vercel Workflow isolation

Vercel Workflow code and dependencies remain behind `durable-benchmark/adapters/vercel-workflow/`. Execution is limited to a controlled non-production Vercel project/preview environment. No production deployment or customer traffic is authorized.

## No-terminal verification strategy

The implementation must not require the user to run PowerShell, VS Code or any local terminal command.

Verification is designed around:

1. focused Vitest/typecheck/build commands executed by an autonomous controlled runner;
2. controlled Vercel Preview deployments for code-level gates when quota is available;
3. isolated external-engine test environments invoked by the benchmark itself for real Inngest/Vercel Workflow measurements;
4. repository evidence generated from machine-readable benchmark results.

GitHub Actions is not a required runner. If an external service prerequisite is genuinely unavailable, the system must report `INCOMPLETE` rather than ask the user to manually run tests.

## Safety constraints

- Never modify `main` during planning or implementation.
- No production deployment.
- No remote database migration is required by the benchmark design.
- No real customer communications.
- No authoritative CRM mutation.
- No real secrets committed to the repository.
- Benchmark feature OFF by default and fail-closed.
- Tenant isolation is a hard gate.
- R4 remains non-autonomous.
- Existing Agent Kernel/Product Agent behavior is not promoted or changed by this phase.
- No automatic migration after a winning benchmark.

## Dependency boundary

The Agent OS master plan says the durable-runtime benchmark should follow real SHADOW/ASSISTED workload experience. Planning and synthetic harness work can be prepared independently, but a final technology adoption recommendation must not be treated as authoritative until the prerequisite Agent OS phases supply the required operational context. Phase 7 itself still performs no migration.

## Deliverables

Phase 7 produces:

- provider-neutral benchmark contracts;
- eight versioned synthetic golden scenarios;
- current/Inngest/Vercel Workflow adapters;
- deterministic fault-injection harness;
- hard-gate evaluator;
- metrics and weighted scoring engine;
- focused automated regression suite;
- machine-readable benchmark result artifact;
- architecture/evidence document with exact versions and raw metrics;
- one final decision: `KEEP_CURRENT`, `ADOPT_INNGEST`, `ADOPT_VERCEL_WORKFLOW`, or `NO_GO`.

It does not produce a migration to the winning engine.