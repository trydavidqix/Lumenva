/**
 * Proposal send via canonical CRM boundary — Task 1 (Phase 8) Step 1: real impl.
 *
 * **CANONICAL PATH (do NOT call WAHA directly):**
 *
 * File: `lib/agent-engine/edge/crm/send-message.ts`
 * Function: `sendTurnMessage(db, cfg, input: SendMessageInput)`
 *
 * Pattern:
 * 1. Ledger insert (unique: job_id, seq) — claims the row; job_id here is the
 *    workflow run id itself (one proposal send per run, seq=1).
 * 2. Call sendMessageHandler under the hood (via sendTurnMessage).
 * 3. Outcomes: sent | already_sent | queued | blocked (403 is_blocked) | failed.
 * 4. Crash recovery is already built into `sendTurnMessage` (send_ledger +
 *    `messages.metadata.idempotency_key` reconciliation) — this wrapper adds
 *    ONE more layer of exactly-once on top: `ai_workflow_runs.sent_message_id`
 *    is checked BEFORE ever calling `sendTurnMessage`, so a resumed workflow
 *    run (LangGraph re-entering `send_once` after a crash) short-circuits
 *    without a second ledger claim at all.
 * 5. Native gate: `blocked` (403 is_blocked) is a PERMANENT veto (opt-out) —
 *    the run is marked `failed` and no retry is attempted. STOP/LGPD wins
 *    over workflow approval (Phase 8 global constraint).
 */
import type pg from 'pg';

import { sendTurnMessage } from '@/lib/agent-engine/edge/crm/send-message';
import type { CrmEdgeConfig } from '@/lib/agent-engine/edge/crm/mcp-client';
import type { ProposalDraftPayload, ProposalGraphState } from '@/lib/workflows/commercial-proposal-graph';

export interface SendProposalOnceResult {
  messageId: string | null;
  duplicate: boolean;
  blocked: boolean;
}

/** Extends the base graph state with the trusted DB row id — see graph.ts's `workflow_run_id` field. */
export interface ProposalSendNodeState extends ProposalGraphState {
  workflow_run_id: string;
}

interface WorkflowRunRow {
  organization_id: string;
  contact_id: string;
  conversation_id: string | null;
  lead_id: string | null;
  status: string;
  sent_message_id: string | null;
  draft_payload: ProposalDraftPayload | null;
}

/** Renders the structured draft into the plain-text message body actually sent to the customer. */
function formatProposalBody(draft: ProposalDraftPayload): string {
  const steps = draft.next_steps.map((step, i) => `${i + 1}. ${step}`).join('\n');
  return [draft.proposal_title, '', draft.executive_summary, '', draft.terms, '', 'Próximos passos:', steps].join(
    '\n',
  );
}

/**
 * Sends the proposal EXACTLY ONCE for a given workflow run.
 *
 * - `sent_message_id` already set → short-circuit, `duplicate: true` (covers
 *   both a genuine resume after crash AND a graph re-entering this node).
 * - org mismatch / missing row / missing conversation / missing draft → throws
 *   (invariant violation, never a "normal" outcome to route around).
 * - `blocked` (STOP/LGPD) → run marked `failed`, returns `blocked: true`,
 *   never throws — this is an expected business outcome, not an error.
 * - `failed` (handler-level failure) → run marked `failed`, throws so the
 *   caller/graph surfaces it loudly (retry ownership stays with the caller).
 * - `sent` / `already_sent` / `queued` → `sent_message_id` persisted,
 *   returns the message id.
 */
export async function sendProposalOnce(
  workflowRunId: string,
  organizationId: string,
  db: pg.Pool,
  cfg: CrmEdgeConfig,
): Promise<SendProposalOnceResult> {
  const { rows } = await db.query<WorkflowRunRow>(
    `select organization_id, contact_id, conversation_id, lead_id, status, sent_message_id, draft_payload
     from ai_workflow_runs where id = $1`,
    [workflowRunId],
  );
  const run = rows[0];
  if (!run) {
    throw new Error(`sendProposalOnce: ai_workflow_runs not found: ${workflowRunId}`);
  }
  if (run.organization_id !== organizationId) {
    throw new Error(`sendProposalOnce: organization mismatch for workflow run ${workflowRunId}`);
  }
  if (run.sent_message_id) {
    return { messageId: run.sent_message_id, duplicate: true, blocked: false };
  }
  if (!run.conversation_id) {
    throw new Error(`sendProposalOnce: workflow run ${workflowRunId} has no conversation_id — cannot send`);
  }
  if (!run.draft_payload) {
    throw new Error(`sendProposalOnce: workflow run ${workflowRunId} has no draft_payload — nothing to send`);
  }

  const body = formatProposalBody(run.draft_payload);

  const outcome = await sendTurnMessage(db, cfg, {
    tenantId: organizationId,
    leadId: run.lead_id,
    jobId: workflowRunId,
    seq: 1,
    conversationId: run.conversation_id,
    body,
  });

  switch (outcome.kind) {
    case 'blocked': {
      await db.query(
        `update ai_workflow_runs set status = 'failed', last_error_code = 'send_blocked_stop'
         where id = $1 and organization_id = $2`,
        [workflowRunId, organizationId],
      );
      return { messageId: null, duplicate: false, blocked: true };
    }
    case 'failed': {
      await db.query(
        `update ai_workflow_runs set status = 'failed', last_error_code = 'send_failed'
         where id = $1 and organization_id = $2`,
        [workflowRunId, organizationId],
      );
      throw new Error(`sendProposalOnce: send failed for workflow run ${workflowRunId}`);
    }
    case 'sent':
    case 'already_sent':
    case 'queued': {
      const messageId = outcome.crmMessageId;
      if (!messageId) {
        throw new Error(
          `sendProposalOnce: outcome '${outcome.kind}' missing crmMessageId for workflow run ${workflowRunId}`,
        );
      }
      await db.query(
        `update ai_workflow_runs set sent_message_id = $2, status = 'sending'
         where id = $1 and organization_id = $3 and sent_message_id is null`,
        [workflowRunId, messageId, organizationId],
      );
      return { messageId, duplicate: outcome.kind === 'already_sent', blocked: false };
    }
    default: {
      const exhaustive: never = outcome;
      throw new Error(`sendProposalOnce: unreachable outcome kind: ${JSON.stringify(exhaustive)}`);
    }
  }
}

/**
 * Graph node wrapper — exported standalone (same convention as
 * `generateProposalNode`/`loadProposalContextNode`) so it is directly
 * unit-testable without LangGraph's `RunnableConfig` machinery. `graph.ts`
 * wires this into the compiled graph's `send_once` node, injecting
 * `db`/`cfg` via `config.configurable`.
 */
export async function sendProposalOnceNode(
  state: ProposalSendNodeState,
  deps: { db: pg.Pool; cfg: CrmEdgeConfig },
): Promise<Partial<ProposalGraphState>> {
  await sendProposalOnce(state.workflow_run_id, state.organization_id, deps.db, deps.cfg);
  return {};
}
