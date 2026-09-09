import type {
  DurableBenchmarkScenarioId,
  DurableBenchmarkTerminalState,
} from './contracts';

export const PHASE_7_SCENARIO_VERSION = '7.0.0';

export type DurableBenchmarkFaultKind =
  | 'transient_failure'
  | 'permanent_failure'
  | 'crash'
  | 'duplicate_delivery'
  | 'cross_tenant_attempt';

export interface DurableBenchmarkFault {
  kind: DurableBenchmarkFaultKind;
  stepId: string;
  occurrence: number;
}

export interface DurableBenchmarkScenario {
  id: DurableBenchmarkScenarioId;
  version: string;
  organizationId: string;
  expectedTerminalState: DurableBenchmarkTerminalState;
  maxRetries: number;
  requiresApproval: boolean;
  approvalOutcome?: 'approve' | 'reject' | 'expire';
  expectedCommittedEffects: number;
  faults: readonly DurableBenchmarkFault[];
}

const SCENARIOS: readonly DurableBenchmarkScenario[] = [
  {
    id: 'happy_path',
    version: PHASE_7_SCENARIO_VERSION,
    organizationId: 'bench-org-a',
    expectedTerminalState: 'completed',
    maxRetries: 0,
    requiresApproval: false,
    expectedCommittedEffects: 1,
    faults: [],
  },
  {
    id: 'transient_retry',
    version: PHASE_7_SCENARIO_VERSION,
    organizationId: 'bench-org-a',
    expectedTerminalState: 'completed',
    maxRetries: 2,
    requiresApproval: false,
    expectedCommittedEffects: 1,
    faults: [{ kind: 'transient_failure', stepId: 'work-b', occurrence: 1 }],
  },
  {
    id: 'retry_exhausted',
    version: PHASE_7_SCENARIO_VERSION,
    organizationId: 'bench-org-a',
    expectedTerminalState: 'failed',
    maxRetries: 2,
    requiresApproval: false,
    expectedCommittedEffects: 0,
    faults: [
      { kind: 'transient_failure', stepId: 'work-b', occurrence: 1 },
      { kind: 'transient_failure', stepId: 'work-b', occurrence: 2 },
      { kind: 'transient_failure', stepId: 'work-b', occurrence: 3 },
    ],
  },
  {
    id: 'approval_pause_resume',
    version: PHASE_7_SCENARIO_VERSION,
    organizationId: 'bench-org-a',
    expectedTerminalState: 'completed',
    maxRetries: 1,
    requiresApproval: true,
    approvalOutcome: 'approve',
    expectedCommittedEffects: 1,
    faults: [],
  },
  {
    id: 'process_crash_recovery',
    version: PHASE_7_SCENARIO_VERSION,
    organizationId: 'bench-org-a',
    expectedTerminalState: 'completed',
    maxRetries: 1,
    requiresApproval: true,
    approvalOutcome: 'approve',
    expectedCommittedEffects: 1,
    faults: [{ kind: 'crash', stepId: 'resume', occurrence: 1 }],
  },
  {
    id: 'duplicate_delivery_idempotency',
    version: PHASE_7_SCENARIO_VERSION,
    organizationId: 'bench-org-a',
    expectedTerminalState: 'completed',
    maxRetries: 1,
    requiresApproval: false,
    expectedCommittedEffects: 1,
    faults: [{ kind: 'duplicate_delivery', stepId: 'effect', occurrence: 2 }],
  },
  {
    id: 'approval_denied_or_expired',
    version: PHASE_7_SCENARIO_VERSION,
    organizationId: 'bench-org-a',
    expectedTerminalState: 'rejected',
    maxRetries: 0,
    requiresApproval: true,
    approvalOutcome: 'reject',
    expectedCommittedEffects: 0,
    faults: [],
  },
  {
    id: 'tenant_isolation',
    version: PHASE_7_SCENARIO_VERSION,
    organizationId: 'bench-org-a',
    expectedTerminalState: 'failed',
    maxRetries: 0,
    requiresApproval: false,
    expectedCommittedEffects: 0,
    faults: [{ kind: 'cross_tenant_attempt', stepId: 'work-a', occurrence: 1 }],
  },
];

export function getPhase7Scenarios(): readonly DurableBenchmarkScenario[] {
  return SCENARIOS;
}
