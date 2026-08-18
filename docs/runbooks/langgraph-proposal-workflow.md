# LangGraph Proposal Workflow Operations Runbook

**Phase 7 Task 13 — Operations guide for manager-approved proposal generation via LangGraph.**

## Feature Modes

Proposal workflow feature flag controls behavior:

| Mode | Behavior |
|------|----------|
| `OFF` | Feature disabled. Workflows cannot be created. Returns 404 on any workflow endpoint. |
| `SHADOW` | Drafts generated and validated, but manager approval is skipped. No message sent. Used for evaluation. |
| `ON` | Full workflow: draft → manager approval → send exactly once → follow-up scheduled. |
| `CANARY` | Same as ON, available to specific orgs/users only. |

**Kill switch:** Set flag to `OFF` to immediately block all new workflow creation.

## Workflow Run States

```
drafting
  └─> awaiting_approval (manager interrupt point)
        ├─> approved (manager approved)
        │     └─> sending (message enqueued to WAHA)
        │           └─> completed (message sent + follow-up scheduled)
        ├─> rejected (manager rejected, no message sent)
        │     └─> [terminal]
        └─> [edit → back to awaiting_approval]

failed (any recoverable error)
  └─> [can retry if side_effect_key re-invoked]

cancelled (administrative cancel)
  └─> [terminal]
```

## Diagnosis by Workflow Run ID

**Fetch run detail:**

```sql
SELECT
  id, organization_id, status, created_at, updated_at,
  draft_payload, decision_payload, decided_by, decided_at,
  sent_message_id, followup_id, last_error_code
FROM ai_workflow_runs
WHERE id = '<workflow-run-id>' AND organization_id = '<org-id>';
```

**Check LangGraph checkpoint state:**

```sql
SELECT
  thread_id, namespace, checkpoint_data, metadata, created_at
FROM langgraph_internal.checkpoints
WHERE thread_id = '<thread-id>'
ORDER BY created_at DESC
LIMIT 1;
```

**Common issues:**

| Symptom | Diagnosis | Remedy |
|---------|-----------|--------|
| Status stuck in `drafting` | Graph halted before interrupt or crashed. | Check `last_error_code`. Review checkpoint. Resume if safe. |
| Status `awaiting_approval` for >24h | Manager decision not received. | Verify `/app/ai/workflows` UI loads run. Resend decision. |
| Status `sending` → stuck | Message enqueued to WAHA but ACK never received. | Check WAHA logs for webhook callback. Manual recover: set `status='failed'`, contact support. |
| `sent_message_id` set but status not `completed` | Crash after WAHA send, before graph checkpoint. | Safe to resume: checkpoint idempotency skips resend. |
| Follow-up not scheduled | `sent_message_id` NULL (send failed or rejected). | Expected. Follow-up only on successful send. |

## Manual Workflow Operations

### Retry a Failed Workflow

Only safe for status `failed` or `sending` with no `sent_message_id` set.

1. Verify run status and reason:
   ```sql
   SELECT status, last_error_code FROM ai_workflow_runs WHERE id = '<id>';
   ```

2. If error is transient (WAHA timeout, network), retry:
   ```
   POST /api/v1/ai/workflows/proposals/<id>/retry
   ```
   (Endpoint: TODO in Task 8 implementation)

3. Monitor: check status update to `completed` or new error.

### Cancel a Workflow

Only safe if status is `drafting` or `awaiting_approval` (no message sent yet).

```sql
UPDATE ai_workflow_runs
SET status = 'cancelled', updated_at = now()
WHERE id = '<id>' AND organization_id = '<org-id>'
  AND status IN ('drafting', 'awaiting_approval');
```

Then verify in UI that run no longer appears in awaiting tab.

### Recover a Stuck Message

If WAHA webhook lost and message stuck in `sending`:

1. Check WAHA logs for callback ID and timestamp.
2. If callback confirms send, update locally:
   ```sql
   UPDATE ai_workflow_runs
   SET status = 'completed', sent_message_id = '<external-id>', updated_at = now()
   WHERE id = '<workflow-id>' AND organization_id = '<org-id>';
   ```
3. Verify in UI.

**DO NOT edit checkpoint rows by hand.** Checkpoint consistency is internal invariant.

## Backup and Restore

### Backup `ai_workflow_runs` Registry

```bash
pg_dump -h <host> -U <user> -d <database> \
  -t ai_workflow_runs \
  -F plain > workflow_runs_backup.sql
```

### Backup LangGraph Checkpoint Schema

```bash
pg_dump -h <host> -U <user> -d <database> \
  -n langgraph_internal \
  -F plain > langgraph_checkpoint_backup.sql
```

### Restore from Backup

**Use only in disaster/DBA scenarios.** Coordinate with platform team.

```bash
psql -h <host> -U <user> -d <database> < langgraph_checkpoint_backup.sql
```

## Rate Limits and Quotas

- Workflow creation per tenant: governed by feature flag.
- No hard quota on concurrent workflow runs (implement if bottleneck emerges).
- WAHA send throttle (1 msg/1.2s) applies to all outbound, not workflow-specific.

## Rollback

To fully disable workflow feature:

1. Set feature flag to `OFF`.
2. Terminate all awaiting workflows:
   ```sql
   UPDATE ai_workflow_runs
   SET status = 'cancelled', updated_at = now()
   WHERE status IN ('drafting', 'awaiting_approval');
   ```
3. Verify UI no longer shows workflows.
4. Optional: scale down worker processes if workflow was dedicated infrastructure.

## Escalation

For issues beyond this runbook:

- **Graph logic errors** → LangGraph logs + checkpoint data to engineering.
- **Concurrency/race conditions** → Database logs + attempt timeline.
- **Cross-tenant issues** → RLS policy audit + SQL output.
- **STOP/LGPD blocks** → Verify native gate configuration separate from LangGraph.

---

**Last updated:** Phase 7 Task 13
**Maintained by:** Platform team
