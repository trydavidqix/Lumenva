import type { TaskComplexity } from './execution-port';

export interface EscalationPolicy {
  max_worker_attempts: number;
  max_professional_attempts: number;
  max_frontier_attempts: number;
  max_replans: number;
}

export interface EscalationState {
  worker_attempts: number;
  professional_attempts: number;
  frontier_attempts: number;
  replans: number;
}

export type EscalationAction =
  | 'retry-worker'
  | 'use-professional'
  | 'use-frontier'
  | 'replan'
  | 'blocked';

export const DEFAULT_ESCALATION_POLICY: EscalationPolicy = {
  max_worker_attempts: 2,
  max_professional_attempts: 1,
  max_frontier_attempts: 1,
  max_replans: 1,
};

export function nextEscalation(
  state: EscalationState,
  policy: EscalationPolicy = DEFAULT_ESCALATION_POLICY,
  complexity: TaskComplexity = 'NORMAL',
): EscalationAction {
  if (state.worker_attempts < policy.max_worker_attempts && complexity !== 'EXCLUSIVE') {
    return 'retry-worker';
  }
  if (state.professional_attempts < policy.max_professional_attempts) {
    return 'use-professional';
  }
  if (state.frontier_attempts < policy.max_frontier_attempts) {
    return 'use-frontier';
  }
  if (state.replans < policy.max_replans) {
    return 'replan';
  }
  return 'blocked';
}
