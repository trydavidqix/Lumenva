---
type: runbook
phase: 10
title: Phase 10 Flywheel Activation Runbook
status: ready-for-activation
last_updated: 2026-08-18
audience: Product, DevOps, Ops
---

# Phase 10 Flywheel Auto-Improvement Activation

**Status:** ✅ Code LIVE, Database MIGRATED, Routes READY

**Goal:** Activate daily judge/distiller loop. Measure proposal effectiveness via outcomes. Gate: **None (auto-scheduled).**

**Timeline:** Day 1–7 MONITORING → Day 7 review metrics → Go/No-Go decision

---

## Pre-Flight Checklist (BEFORE Activation)

- [x] Migration `0120_flywheel_followup_outcomes` applied to Supabase
- [x] Table RLS enabled (org isolation via `user_organizations`)
- [x] Outcome collector code deployed (`lib/agent-engine/flywheel/outcome-collector.ts`)
- [x] Cron route live (`GET /api/v1/cron/flywheel-judge-loop`)
- [x] Evolution dashboard wired (outcomes query added)
- [x] Audit action registered (`ai.flywheel_run`)
- [x] Inngest NOT YET scheduled (manual trigger only for MVP)

**If any ❌:** Fix before proceeding.

---

## Step 1: Verify Infrastructure (5 min)

### Database check
```sql
-- Confirm table exists + RLS active
SELECT table_name, row_security_enabled 
FROM information_schema.tables 
WHERE table_name='flywheel_followup_outcomes';

-- Expected: 1 row, row_security_enabled=true
```

### Route check
```bash
# Test cron route (requires x-internal-secret header)
curl -X GET "https://crm.vercel.app/api/v1/cron/flywheel-judge-loop" \
  -H "x-internal-secret: $INTERNAL_SECRET" \
  -H "Content-Type: application/json"

# Expected: 200 OK
# { "status": "ok", "total_orgs": N, "successful_runs": M, ... }
```

**Checkpoint:** ✅ Route responds 200

---

## Step 2: Manual Trigger (Day 1)

### First run
Execute judge loop manually (no schedule yet):

```bash
curl -X GET "https://crm.vercel.app/api/v1/cron/flywheel-judge-loop" \
  -H "x-internal-secret: $INTERNAL_SECRET"
```

### Verify outcomes persisted
```sql
SELECT 
  organization_id,
  run_id,
  outcome,
  count,
  recorded_at
FROM flywheel_followup_outcomes
ORDER BY recorded_at DESC
LIMIT 10;
```

**Expected:** ≥1 row per org that has followup_enrollments

**Checkpoint:** ✅ Outcomes recorded to DB

---

## Step 3: Dashboard Check (Day 1)

1. Login to CRM
2. Navigate to `/dashboard` → Evolution panel
3. Look for "Outcomes" section
4. Verify metrics:
   - Conversion rate (%)
   - Outcome breakdown (pie chart)
   - Time series (last 7 days)

**Expected:** Metrics visible, numbers match DB query from Step 2

**Checkpoint:** ✅ Dashboard reads outcomes

---

## Step 4: Daily Monitoring (Days 1–7)

### Metrics to track

| Metric | Source | Target | Alert if |
|--------|--------|--------|----------|
| **Judge latency** | Cron response time | <30s p99 | >60s |
| **Outcome persistence** | `flywheel_followup_outcomes` row count | ≥1 per org per day | 0 rows (no outcomes) |
| **Conversion rate** | `(converted) / (converted + replied + exhausted + opted_out + handoff)` | Rising or stable | Drops >20% day-to-day |
| **Total outcomes** | Sum of all counts | Matches followup_enrollments count | Mismatch (sync bug) |
| **RLS violations** | api_audit_log action='authz.denied' + org filter | 0 | >0 (isolation broken) |
| **Audit log** | action='ai.flywheel_run' | Daily entry per org | Missing entry (scheduler down) |

### Daily query (copy-paste)

```sql
-- Day 1–7 summary
SELECT
  DATE(recorded_at) as date,
  COUNT(*) as outcomes_count,
  COUNT(DISTINCT organization_id) as orgs_active,
  SUM(count) as total_enrollments
FROM flywheel_followup_outcomes
WHERE recorded_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(recorded_at)
ORDER BY date DESC;
```

### Conversion rate calculation

```sql
-- Conversion rate by org (last 24h)
SELECT
  organization_id,
  ROUND(
    100.0 * SUM(CASE WHEN outcome='converted' THEN count ELSE 0 END)
    / NULLIF(SUM(count), 0),
    1
  ) as conversion_rate_pct,
  SUM(count) as total_enrollments
FROM flywheel_followup_outcomes
WHERE recorded_at >= NOW() - INTERVAL '24 hours'
GROUP BY organization_id
ORDER BY conversion_rate_pct DESC;
```

### Sentry check
- Tag: `phase: phase-10`
- Alert on: `[flywheel-cron] error` or `[flywheel] error`
- Fatal: >5 new error patterns

---

## Step 5: Abort Criteria (Kill Switch)

If **ANY** triggers:

1. **Judge latency >60s P99**
   - Indicates LLM overload or DB timeout
   - Action: Pause cron, investigate LLM provider

2. **Conversion rate drops >20% day-to-day**
   - May indicate proposal quality regression
   - Action: Review judge verdicts, check if proposals are stale

3. **Outcomes count mismatch vs followup_enrollments**
   - Sync bug or duplicate/missing records
   - Action: Pause, run data audit, reconcile

4. **RLS violations (authz.denied)**
   - Isolation broken, cross-tenant leak possible
   - Action: IMMEDIATE rollback, security review

5. **Cron fails >50% of days**
   - Systemic failure (infrastructure/code)
   - Action: Flag OFF, debug, reactivate after fix

6. **Sentry: >5 new error patterns**
   - Unexpected bugs or edge cases
   - Action: Pause, investigate, reactivate after fix

### Emergency rollback

If any abort trigger fires:

```bash
# Pause Inngest schedule (when implemented)
# Or manually stop calling the cron endpoint
```

No data loss — just stop new outcomes from being recorded. Historical data survives.

---

## Step 6: Day 7 Review (Go/No-Go Decision)

At end of Day 7, check:

- [ ] **Judge latency ≤60s P99** (infrastructure stable)
- [ ] **Conversion rate stable or rising** (proposals effective)
- [ ] **Outcomes persist daily** (no sync bugs)
- [ ] **RLS: zero violations** (isolation holds)
- [ ] **Sentry: zero new patterns** (no production bugs)
- [ ] **Cron success rate ≥95%** (reliable execution)

### Decision matrix

| All metrics green? | Conversion stable? | Decision |
|---|---|---|
| ✅ Yes | ✅ Yes | **EXPAND → INNGEST** (schedule daily at 02:00 UTC) |
| ✅ Yes | ⚠️ Volatile | **EXTEND MONITORING** (2 more days, re-review) |
| ⚠️ Some yellow | Any | **FIX & RE-RUN** (rollback, improve, retry) |
| ❌ Red alerts | Any | **ROLLBACK** (pause cron, investigate) |

---

## Step 7: Expand to Inngest (if Go)

### Wire daily schedule

In `app/inngest/functions/` or Inngest dashboard:

```typescript
export const flywheelJudgeLoop = inngest.createFunction(
  { id: "flywheel-judge-loop" },
  { cron: "0 2 * * *" }, // Daily at 02:00 UTC
  async ({ step }) => {
    const result = await step.run("trigger-judge", async () => {
      return await fetch("https://crm.vercel.app/api/v1/cron/flywheel-judge-loop", {
        method: "GET",
        headers: {
          "x-internal-secret": process.env.INTERNAL_SECRET,
        },
      });
    });
    return result;
  }
);
```

### Verify schedule active

```bash
# Inngest dashboard: check function status
# Should show: "Running" + next execution time
```

---

## Step 8: Post-Activation Monitoring (Weeks 2–4)

After going live:

- **Weekly summary:** Outcomes volume, conversion rate trend
- **Sentry dashboard:** Phase 10 tag, error count <5
- **Judge latency:** P99 trend (should stabilize)
- **User feedback:** "Are proposals useful?"

### Success criteria (30-day post-activation)

- [ ] Judge runs daily at 02:00 UTC (100% uptime)
- [ ] Outcomes persist (≥1 row per org per day)
- [ ] Conversion rate ≥40% (baseline healthy)
- [ ] Zero RLS violations (isolation holds)
- [ ] Zero new Sentry patterns (code stable)
- [ ] User adoption: proposals reviewed by ≥50% of active orgs

If all ✅: **Phase 10 STABLE** → archive runbook, move to Phase 11.

---

## Monitoring Commands (Copy-Paste Reference)

### Check flag status
```sql
SELECT feature, mode FROM ai_platform_feature_flags
WHERE feature LIKE 'flywheel%';
-- Should be: mode='on' if scheduling is active
```

### Count outcomes by date
```sql
SELECT DATE(recorded_at), COUNT(*) as count
FROM flywheel_followup_outcomes
WHERE recorded_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(recorded_at)
ORDER BY date DESC;
```

### Conversion rate (last 24h)
```sql
SELECT
  ROUND(100.0 * SUM(CASE WHEN outcome='converted' THEN count ELSE 0 END) / NULLIF(SUM(count), 0), 1) as conversion_rate_pct
FROM flywheel_followup_outcomes
WHERE recorded_at >= NOW() - INTERVAL '24 hours';
```

### Audit trail
```sql
SELECT action, COUNT(*) as count
FROM api_audit_log
WHERE action='ai.flywheel_run'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY action
ORDER BY created_at DESC;
```

### RLS audit
```sql
SELECT COUNT(*) as violations
FROM api_audit_log
WHERE action='authz.denied'
  AND created_at >= NOW() - INTERVAL '7 days'
  AND metadata->>'resource_type' = 'flywheel_followup_outcomes';
```

---

## Rollback Procedure

If abort triggered:

```bash
# Stop cron endpoint calls (Inngest pause or manual)
```

**Effect:** Immediate. Routes return 200 but skip processing.

**Communication:**
1. Notify eng: "Flywheel paused for [reason]"
2. Investigation ticket opened
3. Timeline for re-activation

**Data integrity:** No data loss. Outcomes table preserved.

---

## Contacts & Escalation

| Role | Alert if | Contact |
|---|---|---|
| **Product** | Conversion rate drops 20%+ | Product lead |
| **DevOps** | Cron failures >50% | On-call |
| **Eng Lead** | Sentry spike | Eng lead |
| **Security** | RLS violation | Security team |

---

## FAQ

**Q: Can we skip Day 7 review and go straight to Inngest?**
A: No. 7 days of stable metrics proves the loop works at scale. Skipping introduces risk of production incidents.

**Q: What if conversion rate is low (20%)?**
A: That's a signal from the data, not a bug. Judge/distiller may need prompt tuning. Document it, continue monitoring, iterate proposals.

**Q: Can we raise the judge latency threshold to 120s?**
A: Only if infrastructure changes (e.g., LLM upgrade). 60s is conservative; don't loosen without cause.

**Q: What if an org has 0 outcomes?**
A: Possible if they have no followup_enrollments yet (new org, or enrollments not created). Not an error. Continue monitoring.

**Q: How often should we manually trigger the cron?**
A: Only Day 1–7 for validation. After Inngest wires it, scheduled runs take over. Manual trigger only for emergency testing/debug.

---

## See Also

- [`docs/phase-10-status.md`](../phase-10-status.md) — feature overview
- [`lib/agent-engine/flywheel/outcome-collector.ts`](../../lib/agent-engine/flywheel/outcome-collector.ts) — persistence logic
- [`docs/specs/10-spec-ai-agents-runtime.md`](../specs/10-spec-ai-agents-runtime.md) — judge contract

---

**Status:** Ready for Day 1 activation.
