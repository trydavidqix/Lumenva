# Phase 8 Production Gate — LangGraph Expansion + Hardening

> **Status:** [SKELETON — TODO STEPS 1-6]  
> **Audited against:** Phase 8 plan `docs/superpowers/plans/2026-08-16-ai-platform-phase-8-langgraph-expansion.md`  
> **Date:** 2026-08-16

---

## Scope

Phase 8 deliverables:
- Task 1: Proposal workflow production (send-once, followup-once, decision resume)
- Task 2: E2E + golden case tests
- Task 3: Observability (Sentry, logging, metrics, checkpoint perf)
- Task 4: Automation scheduling workflow
- Task 5: Lead scoring workflow
- Task 6: Production gate + rollout strategy

---

## Verification Checklist

### Step 1: Verify all Phase 8 P0/P1 complete

**TODO:**
- [ ] Task 1 production impl complete (cfg injection resolved, tests green)
- [ ] Task 2 E2E + golden cases passing (crash recovery, idempotency, org isolation)
- [ ] Task 3 observability wired (Sentry breadcrumbs, metrics emitted)
- [ ] Task 4 automation graph implemented + tested
- [ ] Task 5 lead scoring graph implemented + tested

---

### Step 2: Performance baseline

**TODO:**
- [ ] Measure proposal workflow latency draft → approve → send
- [ ] Target: <2s p95 (draft + manager review latency, excluding user think time)
- [ ] Measure checkpoint write latency (baseline.sql + langgraph_internal)
- [ ] Measure resume latency (checkpoint → node execution)

**Current evidence:** None — performance profiling pending.

---

### Step 3: Test coverage

**TODO:**
- [ ] `pnpm test:e2e` all proposal/automation/lead-scoring flows passing
- [ ] Golden cases: crash before/after interrupt, duplicate decision, cross-tenant isolation, STOP gate
- [ ] Coverage summary: E2E suite line count, golden case coverage

**Current evidence:** None — E2E tests in progress (Task 2).

---

### Step 4: Observability

**TODO:**
- [ ] Sentry alerts configured (workflow failures, decision timeouts, send failures)
- [ ] Metrics dashboard: proposal latency distribution, send success rate, follow-up rate
- [ ] Checkpoint performance dashboard: write latency, resume latency, checkpoint size trends
- [ ] Sample logs: workflow lifecycle from created → completed, decision outcomes

**Current evidence:** None — instrumentation stubs created (Task 3).

---

### Step 5: Runbook

**TODO:**
- [ ] Production troubleshooting guide: common failures (send blocked, decision timeout, checkpoint stale)
- [ ] Rollback procedure: feature flag OFF, database state recovery
- [ ] Manual recovery: query stuck workflows, resume via decision API
- [ ] Monitoring: which metrics to watch (latency spikes, error rate, checkpoint queue depth)

**Current evidence:** None — runbook pending (docs/runbooks/langgraph-phase-8-ops.md).

---

### Step 6: Rollout strategy

**TODO:**
- [ ] Feature flag configuration: proposal_workflow_langgraph (Phase 7), automation_workflow_langgraph (Phase 8), lead_scoring_workflow_langgraph (Phase 8)
- [ ] Rollout phases:
  - Phase 1: Proposal → ON (general availability, Phase 7 proven stable)
  - Phase 2: Automations → CANARY (opt-in test orgs, monitor 1 week)
  - Phase 3: Lead Scoring → CANARY (opt-in test orgs, monitor 1 week)
  - Phase 4: Expand to ON if stable

**Current evidence:** None — feature flag matrix pending.

---

## Decision Framework

**Go/No-Go:** All steps 1-6 must be GREEN before Phase 8 gate signs.

**Conditional Go:** If Step 2/4 reveal acceptable performance but Step 3 incomplete, propose CANARY start (proposal ON, others CANARY) pending observability catchup.

---

## Sign-off

**Gate approval:** Requires controller signature when all steps verified.

**Rollout decision:** Separate from gate — gate confirms readiness, rollout decision is product call (can stay CANARY indefinitely pending business choice).

---

## Notes

Production implementation in progress (Tasks 1-5 stubs created). Gate evidence collection begins after subagent production pass.
