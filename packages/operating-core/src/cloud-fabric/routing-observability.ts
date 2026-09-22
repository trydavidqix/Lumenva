import type { RoutingDecision } from './routing-policy';

export interface RoutingTrace {
  trace_id: string;
  job_id?: string;
  task_id: string;
  execution_id?: string;
  context_packet_id?: string;
  agent_id?: string;
  phase: 'plan' | 'execute' | 'verify';
  decision: RoutingDecision;
  created_at: string;
}

export class RoutingTraceStore {
  private readonly traces: RoutingTrace[] = [];

  append(trace: RoutingTrace): void {
    this.traces.push(trace);
  }

  list(taskId?: string): RoutingTrace[] {
    return taskId ? this.traces.filter((trace) => trace.task_id === taskId) : [...this.traces];
  }
}
