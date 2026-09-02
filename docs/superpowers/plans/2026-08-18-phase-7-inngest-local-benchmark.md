# Phase 7 Inngest Local Benchmark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the isolated Inngest benchmark so one local command executes the canonical Phase 7 small/medium/stress suites and emits sanitized, hard-gate-ready evidence.

**Architecture:** Keep the existing Phase 7 scenario catalog as the single source of truth. The Inngest v4 function uses native durable primitives (`step.run`, `step.waitForEvent`, function idempotency) for synthetic fault/retry/approval/recovery behavior. A local dispatcher talks only to `localhost:8288`, the batch runner preserves the canonical per-scenario concurrency profile, and a CLI entrypoint runs all three profiles and writes sanitized JSON evidence.

**Tech Stack:** TypeScript, Next.js 16 App Router, Inngest SDK v4.18.x, pnpm, tsx, Vitest.

**Spec:** `docs/architecture/agent-os/phase-7-verification.md`

## Global Constraints

- Work only on `agent-os-phase-7-durable-benchmark`.
- Never touch `main`, production, billing, secrets, real external communications, authoritative CRM state, or remote migrations.
- Never use GitHub Actions or Vercel Preview deployments.
- Synthetic organizations only (`bench-org-*` / explicit local synthetic identifiers).
- Provider payloads, authorization headers, secrets and customer PII must never enter committed evidence.
- Historical customer volume remains not-applicable for this new-product benchmark; do not fabricate it.

---

### Task 1: Make the Inngest function exercise canonical scenario semantics

**Files:**
- Modify: `lib/agent-engine/durable-benchmark/adapters/inngest/sdk-runtime.ts`
- Test: `tests/unit/durable-benchmark-inngest-sdk-scenarios.test.ts`

**Interfaces:**
- Consumes: `getPhase7Scenarios()`, `INNGEST_PHASE_7_EVENT_NAMES`.
- Produces: structured Phase 7 run output matching `DurableBenchmarkRunResult` fields except `engineId/scenario metadata`, which the adapter supplies.

- [ ] Add coverage for synthetic-org rejection, transient retry, retry exhaustion, approval approve/reject, crash-recovery injection, duplicate-delivery idempotency and tenant-isolation blocking.
- [ ] Configure the function with `retries: 2` and `idempotency: 'event.data.runId'`.
- [ ] Use `step.run()` for checkpointed/retriable work and `step.waitForEvent()` for approval.
- [ ] Keep all effects synthetic and return reconstructable lifecycle evidence.

### Task 2: Preserve the canonical benchmark concurrency model

**Files:**
- Modify: `lib/agent-engine/durable-benchmark/adapters/inngest/batch-runner.ts`
- Test: `tests/unit/durable-benchmark-inngest-batch-runner.test.ts`

**Interfaces:**
- Consumes: `DURABLE_BENCHMARK_PROFILES`, `getPhase7Scenarios()`.
- Produces: sanitized `DurableBenchmarkRunResult`-compatible run evidence grouped by profile.

- [ ] Execute scenarios sequentially while running each scenario's profile concurrency in parallel: small=1, medium=5, stress=20.
- [ ] Preserve all hard-gate fields rather than only terminal state and duration.
- [ ] Strip provider-only payload fields.

### Task 3: Make the localhost dispatcher drive approvals and collect terminal output

**Files:**
- Modify: `lib/agent-engine/durable-benchmark/adapters/inngest/local-dispatcher.ts`
- Test: `tests/unit/durable-benchmark-inngest-local-dispatcher.test.ts`

**Interfaces:**
- Consumes: one planned synthetic run.
- Produces: sanitized provider result fields required by Phase 7 hard gates.

- [ ] POST the run event to `http://localhost:8288/e/phase7-local-key` with a deterministic event id.
- [ ] For approval scenarios, POST the matching approval event after dispatch.
- [ ] For duplicate-delivery scenario, POST the same event a second time with the same deterministic id to exercise Inngest idempotency.
- [ ] Poll the local Dev Server run endpoint until terminal, parse object/string outputs defensively, and fail closed on timeout or malformed results.

### Task 4: Add a one-command CLI and evidence file

**Files:**
- Create: `scripts/phase7-inngest-benchmark.ts`
- Modify: `package.json`
- Test: `tests/unit/durable-benchmark-inngest-local-command.test.ts`

**Interfaces:**
- Consumes: `createInngestLocalDispatcher`, `runPhase7InngestLocalCommand`, hard-gate evaluator.
- Produces: `docs/superpowers/verification/phase-7-inngest-local-evidence.json` and a concise terminal summary.

- [ ] Preflight `localhost:3000/api/inngest` and `localhost:8288` before execution.
- [ ] Run small, medium and stress sequentially.
- [ ] Evaluate hard gates across every result.
- [ ] Serialize only synthetic/sanitized fields and write exact suite counts (8/40/160, total 208).
- [ ] Exit non-zero if any hard gate fails or if a run cannot be collected.
- [ ] Add `pnpm phase7:inngest` as the single local command.

### Task 5: Final focused verification

**Files:**
- Modify after executable evidence exists: `docs/architecture/agent-os/phase-7-verification.md`

- [ ] Run all focused Phase 7 Inngest unit tests in one command.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm phase7:inngest` against the local Next.js + Inngest Dev Server.
- [ ] Record exact provider version, code SHA, run counts and hard-gate result.
- [ ] Keep Phase 7 `INCOMPLETE` until current-engine and Vercel Workflow real-runtime evidence are also fresh and comparable.
