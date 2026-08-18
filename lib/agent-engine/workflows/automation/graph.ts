/**
 * Automation Scheduling Workflow — LangGraph StateGraph.
 *
 * Pattern: load_config → schedule_run → await_approval [INTERRUPT] → route → execute → completed
 */

import { StateGraph, START, END } from '@langchain/langgraph';
import type { AutomationSchedulingGraphState } from '@/lib/agent-engine/workflows/automation/state';
import { AutomationSchedulingGraphStateAnnotation } from '@/lib/agent-engine/workflows/automation/state';

async function loadConfigNode(state: AutomationSchedulingGraphState) {
  // TODO: Query automations by automationId, resolve org + config
  return {};
}

async function scheduleRunNode(state: AutomationSchedulingGraphState) {
  // TODO: Parse cron string, calc nextRunAt
  // TODO: Query leads count matching filters (estimate)
  return {};
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
  // TODO: Insert into event_log (type='automation_run', payload: config + filters + action_params)
  // TODO: Worker processes event, emits job completion
  // TODO: Update ai_workflow_runs.execution_job_id
  return {};
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
