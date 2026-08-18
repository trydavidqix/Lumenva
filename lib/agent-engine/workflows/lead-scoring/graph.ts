/**
 * Lead Scoring Workflow — LangGraph StateGraph.
 *
 * Pattern mirrors proposal workflow:
 * load_context → draft_score → validate → await_human_decision [INTERRUPT] → route → apply_score → completed
 *
 * Phase 8 Task 5: Skeleton. Production impl next session.
 */

import { StateGraph } from '@langchain/langgraph';
import type { LeadScoringGraphState } from '@/lib/agent-engine/workflows/lead-scoring/state';
import { LeadScoringGraphStateAnnotation } from '@/lib/agent-engine/workflows/lead-scoring/state';

const graph = new StateGraph<LeadScoringGraphState>(LeadScoringGraphStateAnnotation);

// TODO Step 5.1: Implement nodes (similar to proposal pattern)
// - load_context: Query lead data by leadId
// - draft_score: Use LLM to generate score [0-100] + reason based on leadData
// - validate: Check score in valid range [0-100], check leadData complete
// - await_human_decision: Emit INTERRUPT, wait for humanDecision field
// - route: Branch on humanDecision (approve → apply; reject → completed; edit → apply_with_edited)
// - apply_score: Update leads table, emit audit event
// - completed: Mark workflow done

/**
 * TODO Step 5.1.1: Load lead context from DB
 */
async function loadContextNode(state: LeadScoringGraphState) {
  // TODO: Query leads by leadId, resolve organizationId
  // Set state.leadData with engagement_score, conversation_count, last_message_at, tags
  return {};
}

/**
 * TODO Step 5.1.2: Draft score via LLM
 */
async function draftScoreNode(state: LeadScoringGraphState) {
  // TODO: Call LLM with leadData, prompt: "Assign readiness score 0-100"
  // Parse response, extract score + reason
  // Return { draftScore, draftReason, status: 'drafted' }
  return {};
}

/**
 * TODO Step 5.1.3: Validate score
 */
async function validateNode(state: LeadScoringGraphState) {
  // TODO: Check leadData not null, draftScore in [0, 100]
  // Collect errors, set isValid
  // Return { isValid, validationErrors, status: 'validated' }
  return {};
}

/**
 * TODO Step 5.1.4: Await human decision
 */
async function awaitHumanDecisionNode(state: LeadScoringGraphState) {
  // Emit INTERRUPT — graph halts until humanDecision field populated via API resume
  return { status: 'awaiting_approval' };
}

/**
 * TODO Step 5.1.5: Route based on humanDecision
 */
function routeDecision(state: LeadScoringGraphState) {
  if (state.humanDecision === 'reject') return 'rejected';
  if (state.humanDecision === 'approve') return 'apply_score';
  if (state.humanDecision === 'edit') return 'apply_score'; // Apply edited score
  return 'completed';
}

/**
 * TODO Step 5.1.6: Apply score to lead
 */
async function applyScoreNode(state: LeadScoringGraphState) {
  // TODO: Determine final score (editedScore if edit, else draftScore)
  // Query leads.scoring_history, insert row (lead_id, score, applied_by, applied_at, reason)
  // Update leads.score field
  // Emit audit event workflow.lead_score_applied
  // Return { appliedScore, appliedAt, status: 'applied' }
  return {};
}

/**
 * TODO Step 5.1.7: Complete workflow
 */
async function completedNode(state: LeadScoringGraphState) {
  // Mark workflow_run status = 'completed'
  return { status: 'completed' };
}

// Wire nodes
graph.addNode('load_context', loadContextNode);
graph.addNode('draft_score', draftScoreNode);
graph.addNode('validate', validateNode);
graph.addNode('await_human_decision', awaitHumanDecisionNode);
graph.addNode('apply_score', applyScoreNode);
graph.addNode('completed', completedNode);

// Wire edges
graph.addEdge('load_context', 'draft_score');
graph.addEdge('draft_score', 'validate');
graph.addEdge('validate', 'await_human_decision');
graph.addConditionalEdges(
  'await_human_decision',
  routeDecision,
  {
    apply_score: 'apply_score',
    rejected: 'completed',
    completed: 'completed',
  },
);
graph.addEdge('apply_score', 'completed');

graph.setEntryPoint('load_context');
graph.setFinishPoint('completed');

export const leadScoringGraph = graph.compile();
