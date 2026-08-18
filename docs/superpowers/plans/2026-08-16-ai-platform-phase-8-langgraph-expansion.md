# AI Platform Phase 8 — LangGraph Production Hardening + Expansion

> **Goal:** Complete Phase 7 P2 TODOs, harden proposal workflow for production, expand LangGraph to automations + lead scoring.

**Phase Gate:** Phase 7 gate signed (Task 14).

---

## Global Constraints

- Phase 7 must be ON/CANARY before Phase 8 production work.
- No new external dependencies (stay self-host).
- Multi-tenant isolation + RLS hold.
- Feature flags control rollout (OFF/SHADOW/ON/CANARY per workflow type).
- Exactly-once semantics non-negotiable.
- Native STOP/LGPD gate wins over workflow approval.

---

## Task Breakdown

### Task 1: Implement Phase 7 P2s (Proposal workflow production-ready)

**Files:**
- `lib/agent-engine/workflows/proposal/send-once.ts` (Step 3 real impl)
- `lib/agent-engine/workflows/proposal/followup-once.ts` (Steps 1-2 real impl)
- `app/api/v1/ai/workflows/proposals/route.ts` (Steps 1-3 real impl)
- `lib/agent-engine/workflows/proposal/graph.ts` (LangGraph resume wiring)

**Steps:**
- [ ] 1. Implement sendProposalOnce: call sendTurnMessage, handle outcomes (sent/queued/blocked/failed)
- [ ] 2. Implement scheduleFollowupOnce: query scheduler, update followup_id, conditional on sent_message_id
- [ ] 3. Wire LangGraph resume in decision/route.ts: populate humanDecision, invoke graph.stream()
- [ ] 4. Feature flag integration: OFF returns 404, SHADOW skips send, ON/CANARY full flow
- [ ] 5. RBAC: manager+ role verification on /decision endpoint
- [ ] 6. Test: typecheck, lint, unit tests, db invariants
- [ ] 7. Commit

---

### Task 2: E2E + Golden Case Tests (Production validation)

**Files:**
- `tests/e2e/ai-proposal-workflow.spec.ts` (Playwright full impl)
- `tests/unit/langgraph-proposal-golden.test.ts` (Crash/recover/concurrency)

**Steps:**
- [ ] 1. E2E: create workflow → manager approves → message sent → follow-up scheduled
- [ ] 2. E2E: reject flow (no send), edit flow (resume), feature flag OFF/SHADOW/ON transitions
- [ ] 3. Golden: crash before/after interrupt, duplicate decision, cross-tenant isolation, STOP gate
- [ ] 4. Run full suite: `pnpm test:e2e` + `pnpm test:unit`
- [ ] 5. Commit

---

### Task 3: Observability + Performance (Production monitoring)

**Files:**
- `lib/agent-engine/workflows/proposal/metrics.ts` (new)
- `lib/agent-engine/workflows/proposal/observability.ts` (new)

**Steps:**
- [ ] 1. Add Sentry breadcrumbs: workflow_run_id, humanDecision outcomes, send results
- [ ] 2. Structured logging: draft → approve → send → completed timeline
- [ ] 3. Metrics: workflow latency (draft/approve/send), send success rate, follow-up rate
- [ ] 4. Checkpoint performance: query LangGraph checkpoint table, measure resume latency
- [ ] 5. Commit

---

### Task 4: Expand LangGraph — Automation Scheduling Workflow

**Files:**
- `lib/agent-engine/workflows/automation/graph.ts` (new)
- `app/api/v1/ai/workflows/automations/route.ts` (new)

**Steps:**
- [ ] 1. Design: automation schedule (cron-like) → LangGraph orchestration vs cron service
- [ ] 2. Implement: automation scheduling workflow (similar to proposal, reuse send-once/followup-once patterns)
- [ ] 3. RBAC: manager+ creates, admin configures schedules
- [ ] 4. Test: E2E automation run, feature flag ON
- [ ] 5. Commit

---

### Task 5: Expand LangGraph — Lead Scoring Workflow

**Files:**
- `lib/agent-engine/workflows/lead-scoring/graph.ts` (new)
- `app/api/v1/ai/workflows/lead-scoring/route.ts` (new)

**Steps:**
- [ ] 1. Design: lead data → score (draft) → manager approval → apply score
- [ ] 2. Implement: reuse graph patterns (load context, draft, validate, await decision, apply, done)
- [ ] 3. RBAC: viewer/agent can trigger, manager approves scoring rules
- [ ] 4. Test: E2E lead score workflow
- [ ] 5. Commit

---

### Task 6: Production Readiness + Rollout Gate

**Files:**
- `docs/evidence/ai-platform/phase-8-production-gate.md` (new)
- `docs/evidence/ai-platform/phase-8-9-roadmap.md` (new)

**Steps:**
- [ ] 1. Verify all Phase 8 P0/P1 complete
- [ ] 2. Performance baseline: proposal workflow latency <2s (draft+approve)
- [ ] 3. Test coverage: E2E + golden cases all green
- [ ] 4. Observability: Sentry alerts configured, metrics dashboard live
- [ ] 5. Runbook: production ops, troubleshooting, rollback
- [ ] 6. Feature flag strategy: propose ON for Phase 7 proposal, CANARY for automations/lead-scoring
- [ ] 7. Commit gate

---

## Dependencies

- Phase 7 gate signed (Tasks 1-14 production-ready)
- LangGraph checkpoint stable (Phase 7 production proven)
- Existing send/followup/scheduler APIs working

## Deliverables

- Proposal workflow production (Phase 7 P2s implemented)
- E2E + golden case tests passing
- 2+ new workflows (automations, lead scoring) in CANARY/ON
- Production monitoring + rollout plan

## Rollout

1. Phase 8 gate: all P0/P1 done
2. Proposal → ON (general availability)
3. Automations → CANARY (opt-in test orgs)
4. Lead-scoring → CANARY (opt-in test orgs)
5. Monitor week 1, expand to ON if stable

---

**Phase 8 Status:** [PLAN CREATED]
**Next:** Await Phase 7 gate sign-off + resource allocation.
