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
 * Step 3: Production via sendTurnMessage (db from graph node).
 */
export async function sendProposalOnce(
  workflowRunId: string,
  organizationId: string,
  db: pg.Pool,
): Promise<SendProposalOnceResult> {
  // TODO Step 3.1-3.3: Implement full transaction
  // 1. Query ai_workflow_runs, verify org + sent_message_id
  // 2. Call sendTurnMessage (requires cfg injection to node)
  // 3. Handle outcomes: sent/queued UPDATE, blocked return veto, failed throw
  //
  // if (workflow.sent_message_id) return { messageId: workflow.sent_message_id, duplicate: true, blocked: false };
  // const outcome = await sendTurnMessage(db, cfg, { tenantId, leadId, jobId: workflowRunId, seq: 1, conversationId, body });
  // if (outcome.kind === 'blocked') return { messageId: null, duplicate: false, blocked: true };
  // if (['sent','queued'].includes(outcome.kind)) { await db.query(...UPDATE sent_message_id); return success; }

  throw new Error('sendProposalOnce: TODO Step 3.1-3.3 (cfg injection to node required)');
}

/**
 * Graph node — calls sendProposalOnce(workflowRunId, orgId, deps.db).
 */
export async function sendProposalOnceNode(
  state: ProposalGraphState,
  deps: { db: pg.Pool },
): Promise<Partial<ProposalGraphState>> {
  // TODO: Resolve state.workflowRunId, call sendProposalOnce(id, state.organizationId, deps.db)
  // return { sentMessageId: result.messageId };
  return {};
}
