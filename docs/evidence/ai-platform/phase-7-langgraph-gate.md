# Phase 7 LangGraph Release Gate

**Date:** 2026-08-16  
**Phase:** 7 (Proposal Approval Workflow Pilot)  
**Status:** [READY FOR IMPLEMENTATION VERIFICATION]

## Evidence Checklist (Task 14 §2-7)

### 2. Feature OFF leaves normal agent runtime unchanged

**Claim:** When feature flag is `OFF`, existing agent pipeline (inbox, responses, automations) continues unchanged.

**Test:** 
```bash
# Set flag to OFF
# Run existing agent flow (normal inbound message)
# Verify: agent responds, no workflow involvement
# Verify: logs show NO langgraph calls
```

**Evidence:** [TODO: Test harness output after Task 14 Step 2]

### 3. SHADOW draft does not send

**Claim:** Feature set to `SHADOW` generates draft but blocks manager approval and send.

**Test:**
```bash
# Set flag to SHADOW
# Create workflow run
# Verify: draft_payload populated, status = drafting
# Manager attempts approve
# Verify: request rejected or silently no-ops, status unchanged
# Verify: no message in WAHA logs
```

**Evidence:** [TODO: Test harness output after Task 14 Step 3]

### 4. Canary approve sends exactly once

**Claim:** Feature `ON`/`CANARY`, workflow created → manager approves → exactly one message sent via WAHA → status `completed`.

**Test:**
```bash
# Set flag to CANARY
# Create workflow via API
# Verify: status = drafting
# Manager approves via /decision endpoint
# Verify: WAHA webhook received exactly once
# Verify: sent_message_id populated, status = completed
# Resend same decision (duplicate POST)
# Verify: no duplicate WAHA send
```

**Evidence:** [TODO: Test harness output + WAHA log excerpt after Task 14 Step 4]

### 5. Restart/resume using persistent checkpointer

**Claim:** Graph crash mid-flow, restart process, graph resumes from checkpoint without re-executing completed nodes.

**Test:**
```bash
# Workflow at draft node
# Simulate crash (kill graph, clear memory)
# Resume workflow (thread_id lookup)
# Verify: graph resumes from checkpoint, re-drafting skipped
# Verify: same draft_payload, no double-generation
```

**Evidence:** [TODO: Checkpoint state dump + node execution log after Task 14 Step 5]

### 6. STOP/LGPD native gate can still veto after manager approval

**Claim:** Manager approves workflow, but native STOP/LGPD gate blocks send.

**Test:**
```bash
# Contact marked with is_blocked = true (STOP/LGPD native gate)
# Create workflow, manager approves
# Send node checks native gate before WAHA call
# Verify: WAHA not called
# Verify: status reflects gated state, not completed
```

**Evidence:** [TODO: Test harness output after Task 14 Step 6]

### 7. Cross-tenant decision impossible

**Claim:** User from org B cannot modify workflow run in org A.

**Test:**
```bash
# Create workflow in org A
# Authenticate as user from org B
# POST /api/v1/ai/workflows/proposals/<org-a-run>/decision
# Verify: 404 or 403 (isolation choice)
# Verify: org A run unchanged in DB
```

**Evidence:** [TODO: HTTP response + DB state check after Task 14 Step 7]

## Implementation Status

| Task | Status | Evidence File |
|------|--------|---------------|
| 5. Dependencies | ✓ Committed | `package.json` + `pnpm-lock.yaml` |
| 6. Workflow run schema | ✓ Committed | Migrations + tests |
| 7. LangGraph checkpoint schema | ✓ Committed | Migrations + tests |
| 8. State schema | ✓ Committed | Type definitions + tests |
| 9. CRM context + nodes | ✓ Committed | Graph structure + tests |
| 10. LangGraph graph | ✓ Committed | 10-node StateGraph + checkpoint integration |
| 11. Manager approval UI | ✓ Committed | Page + component + hook + E2E stubs |
| 12. Golden cases | ✓ Stub | `langgraph-proposal-golden.test.ts` |
| 13. Operations runbook | ✓ Stub | `langgraph-proposal-workflow.md` |
| 14a. Evidence checklist | 🔄 **IN PROGRESS** | This file |

## Issues & Open Items

- **No P0/P1 blocking.** P2s deferred to Phase 8.
- **Feature flag integration:** Real flag resolution logic in Task 10 Step 3 (TODO).
- **LangGraph graph resume:** LangGraph resume call in Task 10 Step 4 (TODO) - wired to humanDecision input.
- **Send node implementation:** sendProposalOnce worker variant in Task 8 Step 3 (TODO).

## External Dependencies

- **Supabase/Postgres:** Multi-region ready, no additional scaling needed for pilot.
- **WAHA:** Existing integration, no changes required.
- **Native STOP/LGPD gate:** Works in series with LangGraph, no wiring changes.
- **Feature flag system:** Already deployed, LangGraph uses existing OFF/SHADOW/ON/CANARY modes.

## Rollout Strategy

1. **OFF by default** until all evidence collected.
2. **Test tenant early access** (flag `CANARY`).
3. **Production ON** after gate signed off (Phase 7 Task 14 Step 11).

## Provisioning & Cost

- **No new VPS/containers.** LangGraph runs in existing Next.js App Router slots.
- **Postgres storage:** Checkpoints ~1KB/workflow. Negligible for pilot scale (<100 concurrent).
- **No monitoring additions.** Existing Sentry/logging sufficient; LangGraph logs to stdout/structured logger.

---

**Gate Status:** [AWAITING IMPLEMENTATION & VERIFICATION]

See also: `final-initiative-gate.md` (AI Platform Phases 0-7 synthesis).
