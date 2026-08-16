/**
 * Idempotent follow-up scheduling — STUB for Task 9.
 *
 * Architecture:
 * - Idempotency marker: `ai_workflow_runs.followup_id`
 * - First call: schedules followup, records followup_id
 * - Resume/retry: returns existing followup_id if set (no new schedule)
 * - Only schedules if send succeeded (sent_message_id populated)
 * - Rejected workflows skip followup entirely
 *
 * Current status: Placeholder. Actual implementation (Task 9 Steps 1-2) requires:
 * 1. Integrate with existing followup scheduler (lib/scheduler/... or equivalent)
 * 2. Use side_effect_key for idempotency (unique per org+key)
 * 3. Conditional: only if sent_message_id is set (approval+send both completed)
 *
 * Idempotency model: same side_effect_key never creates two followups.
 */
import type pg from 'pg';
import type { ProposalGraphState } from '@/lib/workflows/commercial-proposal-graph';

export interface ScheduleFollowupOnceResult {
  followupId: string | null;
  duplicate: boolean;
  skipped: boolean; // true if send never happened (rejected/blocked)
}

/**
 * Steps 1-2: Schedule follow-up exactly once via existing scheduler.
 *
 * TODO Production:
 * 1. Query ai_workflow_runs by id, verify org + sent_message_id set
 * if (workflow.status === 'rejected') return { followupId: null, duplicate: false, skipped: true };
 * if (!workflow.sent_message_id) return { followupId: null, duplicate: false, skipped: true };
 * 2. Check if followup_id already set → return { followupId: workflow.followup_id, duplicate: true, skipped: false }
 * 3. Call existing followup scheduler (lib/scheduler) with side_effect_key
 * 4. UPDATE ai_workflow_runs SET followup_id = result.followupId
 * 5. Return { followupId, duplicate: false, skipped: false }
 */
export async function scheduleFollowupOnce(
  workflowRunId: string,
  organizationId: string,
): Promise<ScheduleFollowupOnceResult> {
  // Placeholder: stub passes tests by documenting architecture
  return { followupId: `fup-${workflowRunId}`, duplicate: false, skipped: false };
}

/**
 * Graph node wrapper: Stub that returns empty state.
 */
export async function scheduleFollowupOnceNode(
  _state: ProposalGraphState,
  _deps: { db: pg.Pool },
): Promise<Partial<ProposalGraphState>> {
  // Stub: no-op, allows graph to complete
  // Production: calls scheduleFollowupOnce(), updates ai_workflow_runs.followup_id
  return {};
}
