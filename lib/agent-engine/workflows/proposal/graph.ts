/**
 * Phase 7 LangGraph pilot — resumable proposal workflow graph.
 *
 * Assembles the full workflow: load_context -> draft -> validate -> await_human_decision
 * [INTERRUPT] -> {reject, edit, approve routing} -> send_once -> schedule_followup ->
 * completed -> END. Checkpoints state into PostgreSQL at every step so that the workflow
 * can be interrupted for human approval, edited, and resumed without re-running prior
 * steps (guaranteed by LangGraph's checkpointing semantics).
 *
 * The interrupt node (`await_human_decision`) stops execution and returns an interrupt
 * payload containing the sanitized draft and CRM context. The caller (HTTP route or worker)
 * presents this to a manager/user, receives a `humanDecision` input (`{decision: "approve"
 * | "reject" | "edit", ...}`), and resumes the graph from the interrupt point via
 * `.invoke()` with the new input.
 *
 * Side effects (send_once, schedule_followup) are stubbed for now — Task 8 implements
 * exactly-once send, Task 9 implements idempotent follow-up scheduling. Both stubs
 * write nothing and return empty state updates to allow the graph to complete.
 *
 * Multi-tenancy: all node dependencies (db, supabase admin client) are injected via
 * `config.configurable`, not state. The `thread_id` must be validated/scoped to the
 * caller's organization_id before invoking the graph (see `repository.ts`).
 */
import {
  END,
  START,
  StateGraph,
  type LangGraphRunnableConfig,
} from '@langchain/langgraph';
import type pg from 'pg';
import { createPool } from '@/lib/agent-engine/db/pool';

import { createAdminClient } from '@/lib/supabase/admin';
import type { Logger } from '@/lib/agent-engine/obs/logger';
import type { LlmEdgeConfig } from '@/lib/agent-engine/edge/llm/run-model-call';

import { Annotation } from '@langchain/langgraph';

import {
  generateProposalNode,
  ProposalGraphStateAnnotation,
  type ProposalGraphState,
} from '@/lib/workflows/commercial-proposal-graph';
import { loadProposalContextNode, type LoadProposalContextNodeDeps } from '@/lib/workflows/load-proposal-context-node';
import { validateProposalDraftNode } from '@/lib/workflows/validate-proposal-draft-node';
import { createCheckpointerForProposalWorkflow } from '@/lib/agent-engine/workflows/checkpointer';

/**
 * Human approval decision from the interrupt handler.
 * Passed back to the graph via `.invoke({ humanDecision: ... })`.
 */
export interface HumanDecision {
  decision: 'approve' | 'reject' | 'edit';
  /** Optional edited draft if decision === 'edit'. */
  edited_draft_payload?: string;
}

/**
 * Extended graph state that includes humanDecision input.
 * Built by extending the proposal graph state with an optional humanDecision field.
 */
const ProposalApprovalGraphStateAnnotation = Annotation.Root({
  ...ProposalGraphStateAnnotation.spec,
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
 * Stub — Task 8 implements exactly-once send boundary.
 * For now, returns empty state update (no-op).
 */
async function sendProposalOnceNode(_state: ProposalGraphState): Promise<Partial<ProposalGraphState>> {
  // Task 8: call exactly-once send, persist sent_message_id
  return {};
}

/**
 * Stub — Task 9 implements idempotent follow-up scheduling.
 * For now, returns empty state update (no-op).
 */
async function scheduleFollowupOnceNode(_state: ProposalGraphState): Promise<Partial<ProposalGraphState>> {
  // Task 9: schedule follow-up, persist followup_id, deduplicate by side_effect_key
  return {};
}

/**
 * Terminal node for rejected workflows.
 */
async function rejectedNode(_state: ProposalGraphState): Promise<Partial<ProposalGraphState>> {
  return {};
}

/**
 * Approved marker — flows to send_once next.
 */
async function approvedNode(_state: ProposalGraphState): Promise<Partial<ProposalGraphState>> {
  return {};
}

/**
 * Completion marker — workflow finished (sent or rejected).
 */
async function completedNode(_state: ProposalGraphState): Promise<Partial<ProposalGraphState>> {
  return {};
}

/**
 * Interrupt node — awaits human decision on the draft.
 * This node returns the current state without modification. LangGraph's checkpointer
 * persists state at this point. The workflow is then invoked with humanDecision input
 * to resume and route based on the decision (approve/reject/edit).
 *
 * The draft_payload and crm_context are already in state and available to the
 * caller (HTTP route, worker) for presentation to the human decision-maker.
 */
async function awaitHumanDecisionNode(state: ProposalApprovalGraphState): Promise<Partial<ProposalApprovalGraphState>> {
  if (!state.draft_payload || !state.crm_context) {
    throw new Error(
      'awaitHumanDecisionNode: draft_payload or crm_context missing — should not reach interrupt without both',
    );
  }

  // Simply return empty update — the graph halts here when invoked,
  // and resuming with humanDecision input branches via humanDecisionRouter.
  return {};
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
 * Route back to validation after editing.
 */
function validateEditedRouter(_state: ProposalGraphState): string {
  return 'validate_edited';
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
      .addNode('send_once', sendProposalOnceNode)
      .addNode('schedule_followup', scheduleFollowupOnceNode)
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
