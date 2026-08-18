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

async function loadContextNode(state: LeadScoringGraphState) {
  // Load lead data (placeholder: in prod, query leads table)
  const leadData = {
    lead_id: state.leadId,
    name: 'Sample Lead',
    company: 'Acme Corp',
    engagement_score: 65,
    conversation_count: 8,
    last_message_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ['enterprise', 'interested'],
  };
  return { leadData, status: 'loaded' };
}

async function draftScoreNode(state: LeadScoringGraphState) {
  // In production: call LLM with lead data to generate score
  // For now, use placeholder logic based on engagement_score
  const score = state.leadData?.engagement_score ?? 50;
  const reason = `Lead has ${state.leadData?.conversation_count ?? 0} conversations, last contact ${state.leadData?.last_message_at ? 'recent' : 'long ago'}`;
  return {
    draftScore: Math.min(100, Math.max(0, score + 20)),
    draftReason: reason,
    status: 'drafted',
  };
}

async function validateNode(state: LeadScoringGraphState) {
  const errors: string[] = [];
  if (!state.leadData) errors.push('Lead data missing');
  if (state.draftScore == null || state.draftScore < 0 || state.draftScore > 100) {
    errors.push('Score must be 0-100');
  }
  return {
    isValid: errors.length === 0,
    validationErrors: errors,
    status: 'validated',
  };
}

async function awaitHumanDecisionNode(state: LeadScoringGraphState) {
  // INTERRUPT — wait for manager decision via API resume
  return { status: 'awaiting_approval' };
}

function routeDecision(state: LeadScoringGraphState) {
  if (state.humanDecision === 'reject') return 'rejected';
  if (state.humanDecision === 'approve' || state.humanDecision === 'edit') return 'apply_score';
  return 'completed';
}

async function applyScoreNode(state: LeadScoringGraphState) {
  const finalScore = state.editedScore ?? state.draftScore ?? 0;
  const now = new Date().toISOString();
  return {
    appliedScore: finalScore,
    appliedAt: now,
    status: 'applied',
  };
}

async function completedNode(state: LeadScoringGraphState) {
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
