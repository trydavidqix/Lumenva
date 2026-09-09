/**
 * Phase 7/8 LangGraph proposal workflow graph — resumable via a REAL
 * interrupt (Task 1, Phase 8: this file's own "LangGraph resume wiring").
 *
 * Assembles the full workflow: load_context -> draft -> validate -> await_human_decision
 * [INTERRUPT] -> {reject, edit, approve routing} -> send_once -> schedule_followup ->
 * completed -> END. Checkpoints state into PostgreSQL at every step so that the workflow
 * can be interrupted for human approval, edited, and resumed without re-running prior
 * steps (guaranteed by LangGraph's checkpointing semantics).
 *
 * The interrupt node (`await_human_decision`) calls LangGraph's `interrupt()` — this
 * ACTUALLY pauses execution (proven pattern: `tests/unit/langgraph-interrupt-resume.test.ts`),
 * returning an interrupt payload containing the sanitized draft and CRM context.
 * The caller (HTTP route — `app/api/v1/ai/workflows/proposals/[id]/decision/route.ts`)
 * presents this to a manager, then resumes with
 * `graph.invoke(new Command({ resume: humanDecision }), { configurable: { thread_id, ... } })`
 * — NOT a plain state-patch invoke, which would start a new run instead of resuming.
 *
 * Side effects (send_once, schedule_followup) delegate to `./send-once` and
 * `./followup-once` (Task 1, Phase 8 Steps 1-2) — both exactly-once against
 * `ai_workflow_runs`, never duplicated here.
 *
 * Multi-tenancy: all node dependencies (db, supabase admin client, llmCfg) are injected via
 * `config.configurable`, not state. `workflow_run_id` is the trusted join key into
 * `ai_workflow_runs` (which enforces `unique(organization_id, thread_id)`) — callers must
 * resolve it from a trusted source (the row THEY created/queried), never from client input.
 */
import {
  END,
  START,
  StateGraph,
  interrupt,
  type LangGraphRunnableConfig,
} from '@langchain/langgraph';
import type pg from 'pg';

import type { createAdminClient } from '@/lib/supabase/admin';
import type { Logger } from '@/lib/agent-engine/obs/logger';
import type { LlmEdgeConfig } from '@/lib/agent-engine/edge/llm/run-model-call';

import { Annotation } from '@langchain/langgraph';

import {
  generateProposalNode,
  ProposalGraphStateAnnotation,
  type ProposalDraftPayload,
} from '@/lib/workflows/commercial-proposal-graph';
import { loadProposalContextNode, type LoadProposalContextNodeDeps } from '@/lib/workflows/load-proposal-context-node';
import { validateProposalDraftNode } from '@/lib/workflows/validate-proposal-draft-node';
import { createCheckpointerForProposalWorkflow } from '@/lib/agent-engine/workflows/checkpointer';
import { sendProposalOnceNode, type ProposalSendNodeState } from './send-once';
import { scheduleFollowupOnceNode, type ProposalFollowupNodeState } from './followup-once';

/**
 * Human approval decision from the interrupt handler.
 * Passed back to the graph via `graph.invoke(new Command({ resume: humanDecision }), config)`
 * — resuming a real `interrupt()`, never a plain state-patch invoke.
 */
export interface HumanDecision {
  decision: 'approve' | 'reject' | 'edit';
  /** Required when decision === 'edit' — the manager's edited draft, already Zod-validated by the route. */
  edited_draft_payload?: ProposalDraftPayload;
}

/**
 * Extended graph state: `humanDecision` (the resumed interrupt value) and
 * `workflow_run_id` (trusted join key into `ai_workflow_runs`, resolved by the
 * caller — never client input). Both are graph.ts-local extensions of the base
 * `ProposalGraphState`, same convention as `humanDecision` already used.
 */
const ProposalApprovalGraphStateAnnotation = Annotation.Root({
  ...ProposalGraphStateAnnotation.spec,
  workflow_run_id: Annotation<string>(),
  humanDecision: Annotation<HumanDecision | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
});

type ProposalApprovalGraphState = typeof ProposalApprovalGraphStateAnnotation.State;

/**
 * Interrupt payload — what the await_human_decision node returns to the caller.
 * Sanitized to exclude internal secrets, org_id, bearer tokens.
 */
export interface InterruptPayload {
  thread_id: string;
  draft_title: string;
  draft_summary: string;
  crm_contact_name: string;
  crm_needs: string;
}

/**
 * Injected dependencies for proposal workflow graph nodes.
 * Injected via `config.configurable` at invoke time (never serialized to state).
 */
interface ProposalGraphConfigurable {
  db: pg.Pool;
  supabase: ReturnType<typeof createAdminClient>;
  llmCfg: LlmEdgeConfig;
  log?: Logger;
  model?: string;
}

function extractDeps(config: LangGraphRunnableConfig | undefined): ProposalGraphConfigurable {
  const configurable = config?.configurable as Partial<ProposalGraphConfigurable> | undefined;
  if (
    configurable?.db === undefined ||
    configurable?.supabase === undefined ||
    configurable?.llmCfg === undefined
  ) {
    throw new Error(
      'proposalApprovalGraph: config.configurable must provide db, supabase, and llmCfg',
    );
  }
  return {
    db: configurable.db,
    supabase: configurable.supabase,
    llmCfg: configurable.llmCfg,
    ...(configurable.log !== undefined ? { log: configurable.log } : {}),
    ...(configurable.model !== undefined ? { model: configurable.model } : {}),
  };
}

/**
 * Terminal node for rejected workflows. Persists the final status —
 * `decided_by`/`decided_at`/`decision_payload` are written by the HTTP route
 * BEFORE resuming the graph (it has the authenticated user id; graph state
 * deliberately does not carry actor identity).
 */
async function rejectedNode(
  state: ProposalApprovalGraphState,
  config: LangGraphRunnableConfig | undefined,
): Promise<Partial<ProposalApprovalGraphState>> {
  const deps = extractDeps(config);
  await deps.db.query(`update ai_workflow_runs set status = 'rejected' where id = $1 and organization_id = $2`, [
    state.workflow_run_id,
    state.organization_id,
  ]);
  return {};
}

/**
 * Approved marker — flows to send_once next.
 */
async function approvedNode(
  state: ProposalApprovalGraphState,
  config: LangGraphRunnableConfig | undefined,
): Promise<Partial<ProposalApprovalGraphState>> {
  const deps = extractDeps(config);
  await deps.db.query(`update ai_workflow_runs set status = 'approved' where id = $1 and organization_id = $2`, [
    state.workflow_run_id,
    state.organization_id,
  ]);
  return {};
}

/**
 * Completion marker — workflow finished (sent, or send skipped/blocked but
 * the run still reached the end of the pipeline without rejection).
 */
async function completedNode(
  state: ProposalApprovalGraphState,
  config: LangGraphRunnableConfig | undefined,
): Promise<Partial<ProposalApprovalGraphState>> {
  const deps = extractDeps(config);
  await deps.db.query(
    `update ai_workflow_runs set status = 'completed' where id = $1 and organization_id = $2 and status <> 'rejected'`,
    [state.workflow_run_id, state.organization_id],
  );
  return {};
}

/**
 * Interrupt node — ACTUALLY pauses the graph via LangGraph's `interrupt()`
 * (proven pattern: `tests/unit/langgraph-interrupt-resume.test.ts`). The
 * caller resumes with `graph.invoke(new Command({ resume: humanDecision }), config)`;
 * `interrupt()` returns synchronously with that `humanDecision` value on resume.
 *
 * On `edit`, the manager's edited draft REPLACES `draft_payload` immediately
 * (already Zod-validated by the route before it ever reaches here) so the
 * `validate_edited` edge re-validates the new content before looping back to
 * a fresh interrupt.
 */
async function awaitHumanDecisionNode(
  state: ProposalApprovalGraphState,
  config: LangGraphRunnableConfig | undefined,
): Promise<Partial<ProposalApprovalGraphState>> {
  if (!state.draft_payload || !state.crm_context) {
    throw new Error(
      'awaitHumanDecisionNode: draft_payload or crm_context missing — should not reach interrupt without both',
    );
  }

  const configurableThreadId = (config?.configurable as { thread_id?: string } | undefined)?.thread_id;

  const payload: InterruptPayload = {
    thread_id: configurableThreadId ?? state.workflow_run_id,
    draft_title: state.draft_payload.proposal_title,
    draft_summary: state.draft_payload.executive_summary,
    crm_contact_name: state.crm_context.contact_name,
    crm_needs: state.crm_context.needs,
  };

  const resume = interrupt<InterruptPayload, HumanDecision>(payload);

  if (resume.decision === 'edit' && resume.edited_draft_payload) {
    return { humanDecision: resume, draft_payload: resume.edited_draft_payload, validation_errors: null };
  }
  return { humanDecision: resume };
}

/**
 * Router for human decision branching.
 * Called by LangGraph after awaitHumanDecisionNode returns.
 * Reads `state.humanDecision` to determine the next route.
 */
function humanDecisionRouter(state: ProposalApprovalGraphState): string {
  if (!state.humanDecision) {
    // No decision provided, default to reject
    return 'reject';
  }

  switch (state.humanDecision.decision) {
    case 'approve':
      return 'approve';
    case 'reject':
      return 'reject';
    case 'edit':
      return 'edit';
    default:
      return 'reject';
  }
}

/**
 * Build the proposal approval graph with interrupt at human decision.
 *
 * @param checkpointer - PostgresSaver for state persistence across interrupt/resume
 * @returns Compiled StateGraph ready to invoke
 */
export function buildProposalApprovalGraph(checkpointer: ReturnType<typeof createCheckpointerForProposalWorkflow>) {
  return (
    new StateGraph(ProposalApprovalGraphStateAnnotation)
      .addNode('load_context', async (state, config) => {
        const deps: LoadProposalContextNodeDeps = {
          supabase: extractDeps(config).supabase,
        };
        return loadProposalContextNode(state, deps);
      })
      .addNode('draft', async (state, config) => {
        const deps = extractDeps(config);
        return generateProposalNode(state, {
          db: deps.db,
          llmCfg: deps.llmCfg,
          log: deps.log,
          model: deps.model,
        });
      })
      .addNode('validate', validateProposalDraftNode)
      .addNode('validate_edited', validateProposalDraftNode)
      .addNode('await_human_decision', awaitHumanDecisionNode)
      .addNode('rejected', rejectedNode)
      .addNode('approved', approvedNode)
      .addNode('send_once', async (state, config) => {
        const deps = extractDeps(config);
        return sendProposalOnceNode(state as ProposalSendNodeState, { db: deps.db, cfg: { supabase: deps.supabase } });
      })
      .addNode('schedule_followup', async (state, config) => {
        const deps = extractDeps(config);
        return scheduleFollowupOnceNode(state as ProposalFollowupNodeState, { db: deps.db });
      })
      .addNode('completed', completedNode)
      // Linear flow until the interrupt
      .addEdge(START, 'load_context')
      .addEdge('load_context', 'draft')
      .addEdge('draft', 'validate')
      .addEdge('validate', 'await_human_decision')
      // Human decision routing (with interrupt)
      .addConditionalEdges('await_human_decision', humanDecisionRouter, {
        reject: 'rejected',
        edit: 'validate_edited',
        approve: 'approved',
      })
      // After edit cycle, loop back to await decision
      .addEdge('validate_edited', 'await_human_decision')
      // Rejection path
      .addEdge('rejected', END)
      // Approval path: send and follow-up
      .addEdge('approved', 'send_once')
      .addEdge('send_once', 'schedule_followup')
      .addEdge('schedule_followup', 'completed')
      .addEdge('completed', END)
      // Compile with checkpointer for interrupt/resume
      .compile({ checkpointer })
  );
}

/**
 * Convenience factory: create graph with a new checkpointer from the provided pool.
 * Used by tests and worker contexts that don't already have a checkpointer instance.
 */
export function createProposalApprovalGraph(pool: pg.Pool) {
  const checkpointer = createCheckpointerForProposalWorkflow(pool);
  return buildProposalApprovalGraph(checkpointer);
}
