/**
 * Exactly-once proposal send — STUB for Task 8.
 *
 * Architecture:
 * - Uses `ai_workflow_runs.sent_message_id` as idempotency marker
 * - First call: sends via production handler, records message_id
 * - Resume/retry: returns { duplicate: true } if already sent
 * - Crash after send but before DB ack: next resume finds empty sent_message_id,
 *   calls send again (WAHA idempotent via external_id), reconciles on ack
 *
 * Current status: Placeholder. Actual implementation (Task 8 Step 3) requires:
 * 1. Creating a worker/background variant of sendMessageHandler
 * 2. Wiring workflow_run_id into the graph state
 * 3. Implementing transaction logic around send + DB ack
 *
 * See docs/runbooks/langgraph-proposal-workflow.md for operational details.
 */
import type pg from 'pg';
import type { ProposalGraphState } from '@/lib/workflows/commercial-proposal-graph';

export interface SendProposalOnceResult {
  messageId: string | null;
  duplicate: boolean;
}

/**
 * Stub: Send proposal exactly once.
 * Returns { messageId, duplicate: bool } or throws on permanent error (org mismatch, STOP).
 */
export async function sendProposalOnce(_workflowRunId: string, _organizationId: string): Promise<SendProposalOnceResult> {
  // TODO: Implement after Phase 7 Task 8 Step 3
  // 1. Query ai_workflow_runs by id, verify org match
  // 2. Check if sent_message_id already set → return { duplicate: true }
  // 3. Call production send handler (requires worker ctx variant)
  // 4. Update ai_workflow_runs.sent_message_id atomically
  // 5. Return { messageId, duplicate: false }
  throw new Error('sendProposalOnce: Not yet implemented (Task 8 Step 3 pending)');
}

/**
 * Graph node wrapper: Stub that returns empty state (no-op).
 * Actual implementation (Task 8) plugs in the send logic above.
 */
export async function sendProposalOnceNode(
  _state: ProposalGraphState,
  _deps: { db: pg.Pool },
): Promise<Partial<ProposalGraphState>> {
  // Stub: Returns empty update, allowing graph to continue to schedule_followup
  // Production implementation calls sendProposalOnce() and updates status
  return {};
}
