/**
 * Lead Scoring Workflow — LangGraph StateGraph.
 *
 * Pattern mirrors proposal workflow:
 * load_context → draft_score → validate → await_human_decision [INTERRUPT] → route → apply_score → completed
 *
 * Phase 8 Task 5: Skeleton. Production impl next session.
 */

import { StateGraph, START, END } from '@langchain/langgraph';
import type { LeadScoringGraphState } from '@/lib/agent-engine/workflows/lead-scoring/state';
import { LeadScoringGraphStateAnnotation } from '@/lib/agent-engine/workflows/lead-scoring/state';

async function loadContextNode(state: LeadScoringGraphState) {
  // TODO: Query leads by leadId, resolve organizationId
  // Set state.leadData with engagement_score, conversation_count, last_message_at, tags
  return {};
}

async function draftScoreNode(state: LeadScoringGraphState) {
  // TODO: Call LLM with leadData, prompt: "Assign readiness score 0-100"
  // Parse response, extract score + reason
  // Return { draftScore, draftReason, status: 'drafted' }
  return {};
}

async function validateNode(state: LeadScoringGraphState) {
  // TODO: Check leadData not null, draftScore in [0, 100]
  // Collect errors, set isValid
  // Return { isValid, validationErrors, status: 'validated' }
  return {};
}

async function awaitHumanDecisionNode(state: LeadScoringGraphState) {
  // Emit INTERRUPT — graph halts until humanDecision field populated via API resume
  return { status: 'awaiting_approval' };
}

function routeDecision(state: LeadScoringGraphState): 'apply_score' | 'rejected' | 'completed' {
  if (state.humanDecision === 'reject') return 'rejected';
  if (state.humanDecision === 'approve') return 'apply_score';
  if (state.humanDecision === 'edit') return 'apply_score'; // Apply edited score
  return 'completed';
}

async function applyScoreNode(state: LeadScoringGraphState) {
  // TODO: Determine final score (editedScore if edit, else draftScore)
  // Query leads.scoring_history, insert row (lead_id, score, applied_by, applied_at, reason)
  // Update leads.score field
  // Emit audit event workflow.lead_score_applied
  // Return { appliedScore, appliedAt, status: 'applied' }
  return {};
}

async function completedNode(state: LeadScoringGraphState) {
  // Mark workflow_run status = 'completed'
  return { status: 'completed' };
}

export function buildLeadScoringGraph() {
  return (
    new StateGraph(LeadScoringGraphStateAnnotation)
      .addNode('load_context', loadContextNode)
      .addNode('draft_score', draftScoreNode)
      .addNode('validate', validateNode)
      .addNode('await_human_decision', awaitHumanDecisionNode)
      .addNode('apply_score', applyScoreNode)
      .addNode('completed', completedNode)
      .addEdge(START, 'load_context')
      .addEdge('load_context', 'draft_score')
      .addEdge('draft_score', 'validate')
      .addEdge('validate', 'await_human_decision')
      .addConditionalEdges(
        'await_human_decision',
        routeDecision,
        {
          apply_score: 'apply_score',
          rejected: 'completed',
          completed: 'completed',
        },
      )
      .addEdge('apply_score', 'completed')
      .addEdge('completed', END)
      .compile()
  );
}

export const leadScoringGraph = buildLeadScoringGraph();
