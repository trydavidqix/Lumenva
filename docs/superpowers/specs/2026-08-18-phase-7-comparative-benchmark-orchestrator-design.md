# Phase 7 Comparative Benchmark Orchestrator Design

## Status

Approved in chat on 2026-08-18 for implementation planning. This document defines the architecture before any implementation of the all-engine orchestrator.

## Goal

Provide one fail-closed command, `pnpm phase7:benchmark:all`, that runs the Phase 7 durability benchmark against every supported engine using the same canonical scenarios, profiles, hard gates, and evidence format.

The orchestrator must never manufacture comparative evidence. An engine that cannot produce fresh real evidence is reported as `BLOCKED`/`INCOMPLETE`, never as `PASS`.

## Engines

The comparative benchmark targets exactly three engine IDs already defined by Phase 7 contracts:

1. `current` — the current Deskcomm durable execution path.
2. `inngest` — the real local Inngest dev-server path.
3. `vercel_workflow` — the Vercel Workflow candidate path.

Each engine must expose a common benchmark-provider interface that accepts the canonical Phase 7 run inputs and returns canonical `DurableBenchmarkRunResult` records.

## Canonical workload

All engines use the same eight Phase 7 scenarios and scenario version from `lib/agent-engine/durable-benchmark/scenarios.ts`.

Profiles remain canonical:

- `small`: 1 run per scenario = 8 runs.
- `medium`: 5 runs per scenario = 40 runs.
- `stress`: 20 runs per scenario = 160 runs.

Therefore each engine is expected to produce 208 runs and the full comparison is expected to produce 624 runs when all three providers are available.

No provider may silently reduce, substitute, or reinterpret the scenario matrix.

## Architecture

### 1. Provider runners

Create a provider runner boundary with one responsibility: execute the canonical Phase 7 matrix for one engine and return a normalized provider report.

A provider report contains:

- engine ID and engine version;
- fresh code SHA;
- suite counts for `small`, `medium`, and `stress`;
- all canonical run results needed for hard-gate and scoring evaluation;
- whether the evidence is real;
- provider status: `PASS`, `FAIL`, or `BLOCKED`;
- sanitized blocker/failure reasons.

The existing Inngest local command becomes the Inngest provider implementation rather than a separate special-purpose flow.

The current-engine provider runs the existing canonical current adapter directly in the benchmark harness. This is real execution of the current Deskcomm durability adapter against synthetic benchmark state, not a remote production workload.

The Vercel Workflow provider must use a real Vercel Workflow execution boundary if one exists and can be invoked safely. If the repository does not contain a complete real boundary or the required isolated verification environment is unavailable, the provider returns `BLOCKED`. It must not fall back to mocks while marking evidence as real.

### 2. Comparative orchestrator

Create `scripts/phase7-benchmark-all.ts` as the single orchestration entrypoint.

Execution order:

1. preflight repository/engine prerequisites;
2. execute focused Phase 7 tests and typecheck from the package script;
3. run `current` provider;
4. run `inngest` provider;
5. run `vercel_workflow` provider;
6. evaluate hard gates for each provider;
7. calculate comparable scores only where evidence is complete;
8. build the existing Phase 7 comparative evidence structure;
9. calculate the final Phase 7 decision using the existing decision function;
10. persist sanitized evidence and a human-readable summary.

Provider failures are isolated. A failed provider must not destroy already-collected evidence for the other providers. The final command still exits non-zero whenever the comparison cannot produce a valid final decision.

### 3. Fail-closed availability rules

The orchestrator treats provider availability explicitly.

- `current`: blocked if canonical adapter construction or benchmark prerequisites fail.
- `inngest`: blocked if localhost Next.js `/api/inngest` or the Inngest dev server cannot be reached/synchronized.
- `vercel_workflow`: blocked if no real safe runtime boundary is available or required verification configuration is missing.

`BLOCKED` is evidence, not success. A blocked engine causes the final comparative decision to remain `INCOMPLETE` unless the existing Phase 7 decision contract explicitly permits otherwise.

No production deployment, remote migration, real customer data, billing mutation, or real external communication is allowed as part of this benchmark.

## Data flow

For every provider:

`canonical scenarios -> profile expansion -> provider runner -> DurableBenchmarkRunResult[] -> hard gates -> score -> normalized engine evidence`

Then:

`engine evidence[] -> buildPhase7BenchmarkEvidence -> decideDurableBenchmark -> persisted comparative evidence`

The orchestrator must reuse the canonical `hard-gates.ts`, `scoring.ts`, `evidence.ts`, and scenario definitions instead of duplicating decision logic in scripts.

## Evidence files

The command writes fresh sanitized evidence under `docs/superpowers/verification/`.

Required outputs:

- `phase-7-comparative-benchmark-evidence.json` — machine-readable evidence for all providers and the final decision.
- `phase-7-comparative-benchmark-summary.md` — concise human-readable run summary, provider statuses, suite counts, hard-gate state, and final decision/blockers.

The existing Inngest-specific evidence may remain useful as provider-level diagnostic evidence, but the comparative evidence becomes the canonical Phase 7 closure artifact.

Evidence must include the exact code SHA used for the run. Secrets, authorization headers, API keys, provider raw payloads, customer PII, and non-synthetic organization IDs must never be persisted.

## Final decision semantics

The orchestrator does not invent a new decision vocabulary. It must call the existing Phase 7 scoring/decision code.

A final adoption decision is valid only when all required engines have fresh real evidence, required hard gates pass, and comparable scores are available.

Otherwise the result remains `INCOMPLETE` or the existing fail decision dictated by Phase 7 contracts.

## Error handling

Errors are classified at provider boundaries.

- Configuration/runtime unavailable -> `BLOCKED`.
- Provider executes but violates hard gate -> `FAIL`.
- Provider completes required runs and hard gates pass -> `PASS`.
- Invalid/malformed provider output -> fail closed as `FAIL` or `BLOCKED` according to whether execution actually occurred.

The command prints clear progress markers such as `current 208/208`, `inngest 208/208`, and `vercel_workflow BLOCKED: <reason>` without leaking raw provider payloads.

## Testing strategy

Implementation follows TDD.

Minimum coverage:

1. orchestrator runs all three provider boundaries in canonical order;
2. canonical suite counts are enforced per provider;
3. provider failure is isolated and produces `BLOCKED`/`FAIL`, not fabricated success;
4. missing Vercel Workflow real runtime produces `BLOCKED` and final `INCOMPLETE`;
5. all-real provider evidence flows through existing hard gates and scoring;
6. final decision comes only from existing decision logic;
7. persisted evidence is sanitized;
8. one package script exposes `pnpm phase7:benchmark:all`;
9. existing Inngest-specific tests remain green;
10. typecheck and final focused Phase 7 suite pass before declaring completion.

## Completion criteria

The implementation is complete only when:

- `pnpm phase7:benchmark:all` exists;
- it runs the available providers automatically from one command;
- each provider is truthfully classified as `PASS`, `FAIL`, or `BLOCKED`;
- no mock/synthetic provider transport is mislabeled as real provider evidence;
- fresh comparative evidence is generated at the exact tested SHA;
- hard gates and final decision use canonical Phase 7 logic;
- documentation records any genuine external blocker instead of hiding it.

This design intentionally prefers an honest `INCOMPLETE` over a false Phase 7 GO.