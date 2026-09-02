# Phase 7: Durable Benchmark — Activation Runbook

> **Date:** 2026-08-19
> **Scope:** Inngest durable task scheduling, benchmark infrastructure
> **Feature Flag:** `langgraph_durable_benchmark_enabled` (OFF by default)

---

## Pre-Flight Checklist

- [ ] Migrations applied
  ```bash
  supabase db push
  supabase gen types typescript > lib/database.types.ts
  pnpm typecheck
  ```

- [ ] Inngest functions registered
  ```bash
  grep "benchmark_run" app/inngest/functions/*.ts
  ```
  Expected: `benchmark-run-durable.ts` exists, exports handler

- [ ] Local Inngest running
  ```bash
  docker ps | grep inngest
  ```
  Expected: `inngest-dev` container healthy

- [ ] Feature flag exists
  ```sql
  select feature_name, status from ai_platform_feature_flags
  where feature_name = 'langgraph_durable_benchmark_enabled';
  ```
  Expected: OFF

- [ ] Benchmark tables created
  ```sql
  select count(*) from benchmark_runs;
  select count(*) from benchmark_metrics;
  ```
  Expected: tables exist, 0 rows initially

---

## Step 1: Enable Feature Flag

```sql
update ai_platform_feature_flags
set status = 'ON', rolled_out_percentage = 100, activated_at = now()
where feature_name = 'langgraph_durable_benchmark_enabled';
```

This enables durable task scheduling for agent workflows.

---

## Step 2: Day 1 Monitoring

### Inngest Health

```sql
-- Last 10 benchmark runs
select
  id,
  status,
  started_at,
  completed_at,
  duration_ms,
  metrics_count
from benchmark_runs
order by created_at desc
limit 10;
```

Expected: ≥1 successful run

### Metrics Ingestion

```sql
-- Benchmark metrics recorded
select
  date(created_at)::text as day,
  count(*) as metric_count,
  avg((data->'latency_ms')::numeric) as avg_latency_ms
from benchmark_metrics
where created_at > now() - interval '24 hours'
group by day;
```

Expected: >100 metrics by EOD

### Task Durability

```sql
-- Check for any failed/stuck runs
select
  id,
  status,
  error_message,
  retry_count
from benchmark_runs
where status in ('failed', 'retry')
  and created_at > now() - interval '24 hours';
```

Expected: 0 failures (or <5% retry rate)

---

## Step 3: Go/No-Go Decision (End of Day 1)

| Metric | Threshold | Action |
|--------|-----------|--------|
| Benchmark runs success | ≥95% | GO |
| Inngest lag | <5 min | GO |
| Metrics ingestion | >100/day | GO |
| Durability (no stuck tasks) | <5% retry | GO |

---

## Step 4: Full Activation (Day 2)

Benchmark system is live. Agent workflows now use Inngest for:
- Durable task scheduling
- Automatic retry on failure
- Progress tracking
- Timeout handling

No additional changes needed.

---

## Step 5: Days 3–14 Monitoring

### Rollback Procedure (Emergency)

```sql
update ai_platform_feature_flags
set status = 'OFF', rolled_out_percentage = 0
where feature_name = 'langgraph_durable_benchmark_enabled';

-- Restart Inngest worker (or wait 30s for flag cache)
```

### Long-Term Queries

Benchmark run duration trend:
```sql
select
  date(created_at)::text as day,
  percentile_cont(0.50) within group (order by duration_ms) as p50_ms,
  percentile_cont(0.99) within group (order by duration_ms) as p99_ms,
  max(duration_ms) as max_ms
from benchmark_runs
where created_at > now() - interval '14 days'
group by day
order by day desc;
```

---

## Success Criteria (14 Days)

- [x] Zero stuck tasks (Inngest durability working)
- [x] <1% benchmark run failures
- [x] Metrics recorded for all runs
- [x] Average latency stable (±10%)
- [x] No performance degradation (agent latency +<100ms)

---

## FAQ

**Q: What if Inngest goes down?**
A: Tasks automatically retry. Check Inngest dashboard (port 8288) and restart if needed.

**Q: Can benchmarks run in parallel?**
A: Yes. Inngest queues tasks. Monitor queue depth via dashboard.

**Q: How long should a benchmark run take?**
A: 5–15 min depending on workload. Adjust timeout if needed.

---

## Contacts

- **On-call:** #ai-platform-incidents
- **Dashboard:** Inngest UI (http://localhost:8288)
