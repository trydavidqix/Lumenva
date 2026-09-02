# Agent OS Phase 7 — Durable Execution Benchmark

## Purpose

Phase 7 compares three durable-execution choices without migrating production behavior:

1. the current Deskcomm execution path;
2. Inngest;
3. Vercel Workflow.

The benchmark is provider-neutral, synthetic, bounded and fail-closed. It does not authorize a production runtime migration.

## Safety boundary

- Synthetic organizations only (`bench-org-*` or explicit local synthetic identifiers).
- Synthetic effect store only; benchmark effects never call CRM/channel tools.
- No production deployment or remote migration.
- No customer WhatsApp, email, webhook or campaign delivery.
- No authoritative CRM mutation.
- No real secret is allowed in committed benchmark evidence.
- External engines are adapters behind normalized invocation ports; a mock/fake invocation never counts as real-provider evidence.

## Scenario contract

Scenario version: `7.0.0`.

The fixed eight scenarios are:

| Scenario | Expected terminal state | Purpose |
|---|---|---|
| `happy_path` | `completed` | baseline completion and one committed synthetic effect |
| `transient_retry` | `completed` | bounded transient retry |
| `retry_exhausted` | `failed` | retry exhaustion truthfulness |
| `approval_pause_resume` | `completed` | durable approval pause and correct resume |
| `process_crash_recovery` | `completed` | interruption/recovery without replay |
| `duplicate_delivery_idempotency` | `completed` | duplicate delivery with one committed effect |
| `approval_denied_or_expired` | `rejected` | no effect after denied approval |
| `tenant_isolation` | `failed` | fail-closed cross-tenant attempt |

Fault injection is deterministic and occurrence-based. No unseeded randomness is part of correctness evaluation.

## Load profiles

| Profile | Concurrent runs per scenario | Repetitions | Total runs |
|---|---:|---:|---:|
| `small` | 1 | 3 | 8 |
| `medium` | 5 | 5 | 40 |
| `stress` | 20 | 3 | 160 |
| **per engine** |  |  | **208** |

Stress is correctness/recovery pressure, not a capacity certification.

## Real local runtime paths

The comparative harness now has executable local paths for the current engine, Inngest and Vercel Workflow. The one-command comparison is `pnpm phase7:benchmark:all`.

For Inngest, the local path uses the Next serve endpoint plus the Inngest development runtime and preserves the canonical scenario/concurrency contract. For Vercel Workflow, the local runtime uses Workflow Local World behavior. Workflow internal `/.well-known/workflow/*` requests must bypass the normal Next proxy matcher; focused regression coverage now proves that boundary while ordinary application/API routes remain protected.

## Hard gates

An engine is not eligible for adoption if any run violates a hard gate:

- tenant isolation;
- exactly-once committed synthetic effect;
- crash recovery;
- resume position;
- required approval;
- rejection/expiry behavior;
- retry limit;
- truthful terminal state;
- reconstructable lifecycle evidence.

Averages never hide a failing hard-gate run.

## Scoring

Only engines with adequate evidence can be scored for a decision. Scores are normalized to `0..100` and use fixed weights:

| Dimension | Weight |
|---|---:|
| reliability | 0.40 |
| durability | 0.20 |
| observability | 0.15 |
| operational simplicity | 0.10 |
| performance | 0.05 |
| cost | 0.05 |
| maintainability / lock-in | 0.05 |

An external engine needs at least a 10-point weighted advantage, complete real-provider evidence and passing hard gates before an `ADOPT_*` recommendation is possible. Ties and marginal gains keep the current engine when the current engine remains eligible.

## Evidence model

Machine-readable evidence records exact code/runtime identity where available, scenario version, suite counts, hard-gate failures, normalized score, executable-provider provenance and exactly one decision: `KEEP_CURRENT`, `ADOPT_INNGEST`, `ADOPT_VERCEL_WORKFLOW`, `NO_GO`, or `INCOMPLETE`.

Serialization rejects obvious secrets/tokens, email/phone-like PII and non-synthetic organization identifiers embedded in evidence.

## Current evidence state — 2026-08-19

The last complete comparative run reported:

- current: **PASS — 208/208; hard gates PASS**;
- Inngest: **PASS — 208/208; hard gates PASS**;
- Vercel Workflow: **FAIL — 208/208; hard gates FAIL**;
- decision: **INCOMPLETE**.

A subsequent focused fix to the Vercel Workflow proxy boundary passed its dedicated regression test. The next full comparative attempt passed **15/15 focused files and 34/34 tests**, but stopped in TypeScript before runtime execution because generated `.next/dev/types/routes.d.ts` was malformed. Therefore the prior Vercel Workflow FAIL remains the last complete runtime result until a clean post-fix rerun finishes.

No migration follows automatically from any future benchmark recommendation.
