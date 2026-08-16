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
 * Stub: Schedule follow-up exactly once.
 */
export async function scheduleFollowupOnce(
  _workflowRunId: string,
  _organizationId: string,
): Promise<ScheduleFollowupOnceResult> {
  // TODO: Implement Task 9 Steps 1-2
  // 1. Query ai_workflow_runs, verify org match + sent_message_id is set
  // 2. Check if followup_id already set → return { duplicate: true }
  // 3. Call existing followup scheduler with side_effect_key
  // 4. Update ai_workflow_runs.followup_id
  // 5. Return { followupId, duplicate: false, skipped: false }
  throw new Error('scheduleFollowupOnce: Not yet implemented (Task 9 Steps 1-2 pending)');
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
