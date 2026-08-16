/**
 * Proposal send via canonical CRM boundary — Task 8 Step 1: CANONICAL PATH LOCATED.
 *
 * **CANONICAL PATH (Do NOT call WAHA directly):**
 *
 * File: `lib/agent-engine/edge/crm/send-message.ts`
 * Function: `sendTurnMessage(db, cfg, input: SendMessageInput)`
 *
 * Pattern:
 * 1. Ledger insert (unique: organization_id, idempotency_key) — claims row
 * 2. Call sendMessageHandler(supabase, actor, request)
 * 3. Outcomes: sent | already_sent | queued | blocked (403 is_blocked) | failed
 * 4. Crash recovery: query messages by metadata->>'idempotency_key' before retry
 *    (already built into sendTurnMessage, uses SendLedgerStatus + reconcile)
 * 5. Native gate: 403 forbidden when contact.is_blocked (STOP/LGPD veto)
 *
 * **WORKFLOW WRAPPER (this file):**
 *
 * Do NOT duplicate the ledger pattern. REUSE sendTurnMessage:
 * - Build SendMessageInput (conversation_id, body, metadata with workflow_run_id)
 * - Call sendTurnMessage with idempotency_key = workflow_run_id + side_effect_key
 * - Map outcomes to workflow: sent/queued → update sent_message_id; blocked → veto; failed → retry
 * - Crash recovery handled by sendTurnMessage ledger + messages.metadata lookup
 *
 * Steps 2-3: Implement transaction wrapper, not raw WAHA caller.
 */
import type pg from 'pg';
import type { ProposalGraphState } from '@/lib/workflows/commercial-proposal-graph';

export interface SendProposalOnceResult {
  messageId: string | null;
  duplicate: boolean;
  blocked: boolean;
}

/**
 * Send proposal via canonical sendTurnMessage path.
 * TODO Steps 2-3: Adapt SendMessageInput, call sendTurnMessage, handle outcomes.
 */
export async function sendProposalOnce(
  _workflowRunId: string,
  _organizationId: string,
): Promise<SendProposalOnceResult> {
  throw new Error('sendProposalOnce: Not yet implemented (Task 8 Steps 2-3 pending)');
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
