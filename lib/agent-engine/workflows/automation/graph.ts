/**
 * Automation Scheduling Workflow — LangGraph StateGraph.
 *
 * Pattern: load_config → schedule_run → await_approval [INTERRUPT] → route → execute → completed
 */

import { StateGraph } from '@langchain/langgraph';
import type { AutomationSchedulingGraphState } from '@/lib/agent-engine/workflows/automation/state';
import { AutomationSchedulingGraphStateAnnotation } from '@/lib/agent-engine/workflows/automation/state';

const graph = new StateGraph<AutomationSchedulingGraphState>(AutomationSchedulingGraphStateAnnotation);

// TODO Step 4.2: Implement nodes
// - load_config: Query automation config by automationId
// - schedule_run: Parse cron, calc nextRunAt, estimate lead count from filters
// - await_approval: Emit INTERRUPT for manager review
// - route: Branch on humanDecision
// - execute: Trigger job scheduler (event_log worker pattern)
// - completed: Mark workflow done

async function loadConfigNode(state: AutomationSchedulingGraphState) {
  // Load automation config from repository (placeholder)
  // In production: query automations table by automationId
  const config = state.automationConfig || {
    name: 'Default Campaign',
    type: 'message_campaign' as const,
    schedule: '0 9 * * 1-5', // 9am weekdays
    enabled: true,
    filters: {},
    action_params: {},
  };
  return { automationConfig: config };
}

async function scheduleRunNode(state: AutomationSchedulingGraphState) {
  // Parse cron and calculate nextRunAt (simplified: assume next 24h)
  const nextRun = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const estimatedLeads = 150; // Placeholder: would query leads matching filters
  return {
    nextRunAt: nextRun,
    estimatedLeadCount: estimatedLeads,
  };
}

async function awaitApprovalNode(state: AutomationSchedulingGraphState) {
  // INTERRUPT — wait for humanDecision from manager UI
  return { status: 'awaiting_approval' };
}

function routeDecision(state: AutomationSchedulingGraphState) {
  if (state.humanDecision === 'reject') return 'completed';
  if (state.humanDecision === 'approve' || state.humanDecision === 'edit') return 'execute';
  return 'completed';
}

async function executeNode(state: AutomationSchedulingGraphState) {
  // Insert into event_log for worker to process
  const jobId = `job_${Date.now()}`;
  return {
    executedAt: new Date().toISOString(),
    executionJobId: jobId,
    leadsProcessed: state.estimatedLeadCount || 0,
  };
}

async function completedNode(state: AutomationSchedulingGraphState) {
  return { status: 'completed' };
}

// Wire
graph.addNode('load_config', loadConfigNode);
graph.addNode('schedule_run', scheduleRunNode);
graph.addNode('await_approval', awaitApprovalNode);
graph.addNode('execute', executeNode);
graph.addNode('completed', completedNode);

graph.addEdge('load_config', 'schedule_run');
graph.addEdge('schedule_run', 'await_approval');
graph.addConditionalEdges('await_approval', routeDecision, {
  execute: 'execute',
  completed: 'completed',
});
graph.addEdge('execute', 'completed');

graph.setEntryPoint('load_config');
graph.setFinishPoint('completed');

export const automationSchedulingGraph = graph.compile();
