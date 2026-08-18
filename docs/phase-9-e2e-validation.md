---
type: e2e-validation
phase: 9
title: Phase 10 Flywheel Loop E2E Validation
status: in-progress
date: 2026-08-18
---

# Phase 9: End-to-End Validation — Phase 10 Flywheel

**Goal:** Prove judge loop works: cron fires → outcomes persisted → dashboard reads metrics.

---

## Setup

### Prerequisites
- Supabase Cloud connected (DATABASE_URL pooler)
- Vercel live (crm.vercel.app)
- Test org + agent + followup flow active
- x-internal-secret known (from .env.local or Vercel config)

### Test Data
- Need ≥1 org with followup_enrollments (some with outcomes)
- Need active ai_agents (for judge to propose on)
- Need dashboard access (authenticated session)

---

## Steps

### 1. Trigger Judge Cron (Manual)

```bash
# Call the daily judge loop manually
curl -X GET "https://crm.vercel.app/api/v1/cron/flywheel-judge-loop" \
  -H "x-internal-secret: $INTERNAL_SECRET" \
  -H "Content-Type: application/json"

# Expected response: 200 OK
# { "status": "ok", "total_orgs": N, "successful_runs": N, "failed_runs": 0, "total_outcomes": N, ... }
```

**Accept if:**
- Status 200
- `failed_runs = 0` or `failed_runs < total_orgs * 0.1` (≤10% failure acceptable)
- `total_outcomes ≥ 0` (some orgs may have no enrollments, OK)

### 2. Verify Outcomes Persisted

```bash
# Query outcomes table in Supabase
psql -h <host> -U postgres -d postgres -c "
SELECT 
  organization_id,
  run_id,
  outcome,
  count,
  recorded_at
FROM flywheel_followup_outcomes
ORDER BY recorded_at DESC
LIMIT 10;
"

# Alternative: Supabase dashboard SQL editor
```

**Accept if:**
- ≥1 row appears with recent `recorded_at` (within last minute)
- Outcomes are one of: `converted`, `replied`, `exhausted`, `opted_out`, `handoff`, `in_flight`
- `count > 0`

### 3. Verify Evolution Dashboard

**Manual browser test:**

1. Login to crm.vercel.app with test account
2. Navigate to `/dashboard` or AI evolution panel
3. Scroll to "Outcomes" section (if visible)
4. Check for:
   - Conversion rate metric (e.g., "45% converted")
   - Outcome breakdown (pie/bar chart)
   - Time series (outcomes over last 7 days)

**Accept if:**
- Panel visible
- Metrics match DB query from Step 2
- No 404 or error state

### 4. Audit Log Verification

```bash
# Query audit trail of flywheel run
psql -h <host> -U postgres -d postgres -c "
SELECT 
  created_at,
  action,
  resource_id,
  metadata
FROM api_audit_log
WHERE action = 'ai.flywheel_run'
ORDER BY created_at DESC
LIMIT 5;
"
```

**Accept if:**
- ≥1 row with recent timestamp
- `resource_id` matches org from Step 2
- `metadata.outcomes` matches outcome counts

---

## Validation Matrix

| Step | Check | Pass | Fail | Blocker |
|------|-------|------|------|---------|
| 1 | Cron fires, status 200 | ✅ | 503/504 server down | Yes |
| 1 | `failed_runs < 10%` | ✅ | >50% failures | Yes |
| 2 | Outcomes row exists | ✅ | 0 rows | Yes |
| 2 | Outcome type valid | ✅ | Invalid enum | Yes |
| 3 | Dashboard panel loads | ✅ | 404/error | No (UI later) |
| 3 | Metrics match DB | ✅ | Mismatch | Yes (aggregation bug) |
| 4 | Audit log records run | ✅ | No entry | No (nice-to-have) |

---

## Known Gaps

- Dashboard UI not built (metrics in API, panel in backlog)
- Inngest schedule not yet active (running manual only)
- No webhook simulation (E2E assumes real followup_enrollments exist)
- No performance baseline (latency not measured)

---

## Pass Criteria

**Green:** Steps 1, 2, 3 PASS
**Yellow:** Step 1 or 2 FAIL (but root cause found)
**Red:** Multiple steps FAIL (design issue)

---

## Findings

*To be filled after execution*

Date run: 
Org tested: 
Judge latency: 
Outcomes count: 
Dashboard visible: 
Issues: 

