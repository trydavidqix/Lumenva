---
type: runbook
phase: 8
title: Phase 8 Activation Runbook
status: active (flags ON as of 2026-08-18 19:23 UTC)
last_updated: 2026-08-18 (Flags activated)
audience: Product, DevOps, Ops
---

# Phase 8 Feature Flag Activation Runbook

**Status:** ✅ Flags NOW LIVE (2026-08-18)

**Goal:** Monitor LangGraph approval workflows during 7-day observation period.

**Timeline:** Day 1–7 MONITORING → Day 7 review metrics → Go/No-Go decision

---

## Status Check (Post-Activation)

**FLAGS ARE NOW ACTIVE.** Pre-flight checklist PASSED (2026-08-18 19:23 UTC).

✅ Completed:
- [x] `ai_workflow_runs` table: clean (production ready)
- [x] Flags: **ON** (langgraph_automation_workflow, langgraph_lead_scoring_workflow)
- [x] Vercel: deployment live (commit 89172f40, redeploy triggered)
- [x] Supabase Cloud: flags inserted, status='on'
- [x] Schema: feature constraint updated (added Phase 8 feature names)

**Verification SQL:**

```sql
-- Confirm flags are ON
SELECT feature, mode FROM ai_platform_feature_flags
WHERE feature IN ('langgraph_automation_workflow', 'langgraph_lead_scoring_workflow');
-- Expected: both rows, mode='on'

-- Monitor workflow runs (during 7-day observation)
SELECT COUNT(*) as total_runs, 
       SUM(CASE WHEN status='awaiting_approval' THEN 1 END) as pending_approval
FROM ai_workflow_runs;
```

---

## Step 1: Enable Flags (CANARY mode)

### Execute SQL

Connect to Supabase Cloud (project `idqlutosaqqqqxetepen`):

```sql
UPDATE ai_platform_feature_flags
SET status = 'CANARY'
WHERE feature_name IN (
  'langgraph_automation_workflow',
  'langgraph_lead_scoring_workflow'
);
```

**Effect:** Routes now return `201 CREATED` instead of `404`. Feature available to workflows in CANARY mode.

### Verify Activation

```bash
# Should return 201 (no longer 404)
curl -X POST https://crm.vercel.app/api/v1/ai/workflows/automations \
  -H "Authorization: Bearer <test_manager_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "automation_id": "test-uuid-12345",
    "mode": "shadow"
  }'

# Expected response:
# 201 CREATED
# {
#   "data": {
#     "run_id": "<uuid>",
#     "status": "drafting"
#   }
# }
```

**Checkpoint:** ✅ Routes live

---

## Step 2: Daily Monitoring (Days 1–7)

### Metrics to Track

| Metric | Source | Target | Alert if |
|--------|--------|--------|----------|
| **Workflow creates** | `api_audit_log`, action='workflow.created' | Count per day | <5 (too quiet) |
| **Approvals** | action='workflow.approved' | Count per day | <30% of creates |
| **Rejections** | action='workflow.rejected' | Count per day | >50% of creates |
| **Edits** | action='workflow.edited' | Count per day | Expected >20% |
| **Graph latency** | LangGraph invoke time | P99 <5s | >5s (timeout risk) |
| **Webhook failures** | Automation action logs (external integrations) | <5% fail rate | >10% fail rate |
| **Sentry errors** | /api/v1/ai/workflows/* errors | Count | >0 new error pattern |

### Daily Query (copy into SQL Editor)

```sql
-- Day 1–7 summary
SELECT
  DATE(created_at) as date,
  action,
  COUNT(*) as count
FROM api_audit_log
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND action IN (
    'workflow.created',
    'workflow.approved',
    'workflow.rejected',
    'workflow.edited'
  )
GROUP BY DATE(created_at), action
ORDER BY date DESC, action
;
```

### Monitoring Dashboard

Recommended setup in your observability tool (Sentry, Grafana, etc.):

```yaml
Phase 8 Activation (7-day CANARY)
├─ Workflows created (count/day)
├─ Approval rate (% of created)
├─ Rejection rate (% of created)
├─ Edit loop rate (% of creates that re-submit)
├─ LangGraph latency P99
├─ Webhook integration failures (%)
└─ Sentry error count (phase-8 tag)
```

---

## Step 3: Abort Criteria (Kill Switch)

If **any** of these triggers:

1. **Approval rate drops below 30%**
   - Indicates draft quality issues or manager confusion
   - Action: Flag OFF, review LangGraph output

2. **Webhook failures exceed 10%**
   - External automations failing (Zapier, n8n, custom)
   - Action: Flag OFF, debug integrations, rollback

3. **LangGraph invocation timeout (>5s P99)**
   - Model too slow or overloaded
   - Action: Flag OFF, check token/rate limits

4. **Sentry spikes (>5 new error types)**
   - Unexpected bugs or edge cases
   - Action: Flag OFF, investigate

5. **Manager feedback: "workflows are broken"**
   - Qualitative signal matters
   - Action: Flag OFF immediately, debug, reactivate after fix

### Emergency Rollback (1 query)

```sql
UPDATE ai_platform_feature_flags
SET status = 'OFF'
WHERE feature_name IN (
  'langgraph_automation_workflow',
  'langgraph_lead_scoring_workflow'
);
```

**Effect:** Immediate. Routes return 404 again. Existing approved workflows continue executing (status='approved' preserved). New POSTs are rejected.

---

## Step 4: Day 7 Review (Go/No-Go Decision)

### Review Metrics

At end of Day 7, check:

- [ ] **Approval rate ≥30%** (managers are comfortable with drafts)
- [ ] **Rejection rate <50%** (drafts generally good quality)
- [ ] **Webhook success rate ≥90%** (automations execute correctly)
- [ ] **LangGraph P99 <5s** (performance acceptable)
- [ ] **Sentry: zero new patterns** (no surprise bugs)
- [ ] **User feedback: positive or neutral** (no complaints)

### Decision Matrix

| All metrics green? | Approval rate >70%? | Decision |
|---|---|---|
| ✅ Yes | ✅ Yes | **EXPAND → ON** |
| ✅ Yes | ⚠️ 30–70% | **EXTEND CANARY** (2 more days, review again) |
| ⚠️ Some yellow | Any | **FIX & RE-CANARY** (rollback, improve, retry) |
| ❌ Red alerts | Any | **ROLLBACK** (flag OFF, pause feature) |

---

## Step 5: Expand to ON (if Go decision)

### Execute SQL

```sql
UPDATE ai_platform_feature_flags
SET status = 'ON'
WHERE feature_name IN (
  'langgraph_automation_workflow',
  'langgraph_lead_scoring_workflow'
);
```

**Effect:** All tenants can now create workflows (not just CANARY).

### Verify Expansion

```bash
# Test from a different org/tenant
curl -X POST https://crm.vercel.app/api/v1/ai/workflows/automations \
  -H "Authorization: Bearer <different_tenant_token>" \
  -H "Content-Type: application/json" \
  -d '{"automation_id": "<uuid>", "mode": "on"}'

# Expected: 201 (works for any tenant)
```

### Monitoring Continues

After expansion, maintain monitoring:
- Track per-tenant usage (some orgs may not use it)
- Watch for abuse (> 1000 creates/day from single org = investigate)
- Alert on performance degradation as scale increases

---

## Rollback Procedure (if needed)

If metrics show problems post-expansion:

```sql
UPDATE ai_platform_feature_flags
SET status = 'OFF'
WHERE feature_name IN (
  'langgraph_automation_workflow',
  'langgraph_lead_scoring_workflow'
);
```

**Communication:**
1. Notify affected tenants (those with active workflows)
2. Explain: "Temporary pause for optimization; approved workflows continue running"
3. Timeline: when re-enable (after fix)

**Investigation after rollback:**
- Review Sentry errors (what pattern caused abort?)
- Check recent code changes (schema, LangGraph, routes)
- Load test: did performance degrade under real load?
- Product review: do we need to adjust workflow design?

---

## Monitoring Commands (Copy-Paste Reference)

### Check flag status

```sql
SELECT feature_name, status FROM ai_platform_feature_flags
WHERE feature_name LIKE 'langgraph%';
```

### Count activities (last 24h)

```sql
SELECT
  action,
  COUNT(*) as count
FROM api_audit_log
WHERE created_at >= NOW() - INTERVAL '24 hours'
  AND action IN (
    'workflow.created',
    'workflow.approved',
    'workflow.rejected',
    'workflow.edited'
  )
GROUP BY action
ORDER BY count DESC
;
```

### Find broken workflows (rejected, not approved)

```sql
SELECT
  id,
  organization_id,
  status,
  created_at,
  created_by
FROM ai_workflow_runs
WHERE status IN ('rejected', 'drafting')
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
;
```

### Approval rate (%)

```sql
SELECT
  ROUND(
    100.0 * COUNT(CASE WHEN action = 'workflow.approved' THEN 1 END)
    / COUNT(CASE WHEN action = 'workflow.created' THEN 1 END),
    1
  ) as approval_rate_pct
FROM api_audit_log
WHERE created_at >= NOW() - INTERVAL '7 days'
  AND action IN ('workflow.created', 'workflow.approved')
;
```

---

## Contacts & Escalation

| Role | Action | Contact |
|---|---|---|
| **Product** | Go/No-Go decision at Day 7 | Product owner (TBD) |
| **DevOps** | Emergency rollback | On-call (TBD) |
| **Eng Lead** | Investigation after abort | (TBD) |
| **Customer Success** | User communication (if rollback) | (TBD) |

---

## FAQ

**Q: Can I expand to ON before Day 7?**
A: Only if all abort criteria are green AND approval rate >70% AND product approves early. Otherwise, wait 7 days.

**Q: What if approval rate is 30% but everything else is green?**
A: Extend CANARY 2 more days. 30% may be correct (managers are cautious). Monitor for trend: rising or flat?

**Q: Can I keep CANARY mode indefinitely?**
A: No. CANARY is a 7–14 day gate. After that: expand to ON or rollback and iterate.

**Q: What happens to workflows approved during CANARY if we rollback?**
A: Status='approved' workflows continue executing. Rollback only blocks new POSTs and pauses drafting→awaiting_approval flow.

**Q: Who approves rollback?**
A: On-call DevOps (if alert criteria auto-trigger) or Product lead (manual review).

---

## Success Criteria (Post-Activation)

After 30 days in ON mode:

- [ ] 100+ workflows created (adoption)
- [ ] 60%+ approval rate (managers trust drafts)
- [ ] <5% webhook failure rate (integrations stable)
- [ ] Zero critical Sentry errors (no production bugs)
- [ ] User feedback: "helpful and reliable"

If all met: **Phase 8 STABLE** → archive runbook, move to Phase 9.

---

## See Also

- [`docs/phase-8-status.md`](../phase-8-status.md) — feature overview, what flags control
- [`docs/specs/10-spec-ai-agents-runtime.md`](../specs/10-spec-ai-agents-runtime.md) — LangGraph contract
- [`docs/business-rules/00-business-rules-catalog.md`](../business-rules/00-business-rules-catalog.md) — workflow SLAs
