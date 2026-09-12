/**
 * Automation Scheduling Workflow — LangGraph StateGraph.
 *
 * Pattern: load_config → schedule_run → await_approval [INTERRUPT] → route → execute → completed
 */

import { StateGraph, START, END } from '@langchain/langgraph';
import type { AutomationSchedulingGraphState } from '@/lib/agent-engine/workflows/automation/state';
import { AutomationSchedulingGraphStateAnnotation } from '@/lib/agent-engine/workflows/automation/state';

async function loadConfigNode(state: AutomationSchedulingGraphState) {
  return { automationConfig: { name: `automation-${state.automationId}`, type: 'message_campaign' as const, schedule: 'seeded', enabled: true, filters: { seed: state.seed }, action_params: {} } };
}

async function scheduleRunNode(state: AutomationSchedulingGraphState) {
  const bytes = [...state.seed].reduce((sum, c) => (sum * 31 + c.charCodeAt(0)) >>> 0, 7);
  return { nextRunAt: `seed:${bytes.toString(16).padStart(8, '0')}`, estimatedLeadCount: bytes % 100 };
}

async function awaitApprovalNode(state: AutomationSchedulingGraphState) {
  // INTERRUPT — wait for humanDecision
  return { status: 'awaiting_approval' };
}

function routeDecision(state: AutomationSchedulingGraphState): 'execute' | 'completed' {
  if (state.humanDecision === 'reject') return 'completed';
  if (state.humanDecision === 'approve') return 'execute';
  if (state.humanDecision === 'edit') return 'execute'; // edited schedule
  return 'completed';
}

async function executeNode(state: AutomationSchedulingGraphState) {
  return { executedAt: `seed:${state.seed}`, executionJobId: `job:${state.workflowRunId}:${state.seed}`, leadsProcessed: state.estimatedLeadCount ?? 0, output: { seed: state.seed, workflowRunId: state.workflowRunId, nextRunAt: state.nextRunAt, estimatedLeadCount: state.estimatedLeadCount } };
}

async function completedNode(state: AutomationSchedulingGraphState) {
  return { status: 'completed' };
}

export function buildAutomationSchedulingGraph() {
  return (
    new StateGraph(AutomationSchedulingGraphStateAnnotation)
      .addNode('load_config', loadConfigNode)
      .addNode('schedule_run', scheduleRunNode)
      .addNode('await_approval', awaitApprovalNode)
      .addNode('execute', executeNode)
      .addNode('completed', completedNode)
      .addEdge(START, 'load_config')
      .addEdge('load_config', 'schedule_run')
      .addEdge('schedule_run', 'await_approval')
      .addConditionalEdges('await_approval', routeDecision, {
        execute: 'execute',
        completed: 'completed',
      })
      .addEdge('execute', 'completed')
      .addEdge('completed', END)
      .compile()
  );
}

export const automationSchedulingGraph = buildAutomationSchedulingGraph();
