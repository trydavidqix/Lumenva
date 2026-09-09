import type { DurableBenchmarkRunResult } from './contracts';
import { getPhase7Scenarios } from './scenarios';

export type DurableBenchmarkHardGate =
  | 'tenant_isolation'
  | 'exactly_once_effect'
  | 'crash_recovery'
  | 'resume_position'
  | 'approval_required'
  | 'approval_rejection_expiry'
  | 'retry_limit'
  | 'terminal_state_truth'
  | 'reconstructable_evidence';

export interface DurableBenchmarkHardGateDecision {
  passed: boolean;
  failures: readonly {
    gate: DurableBenchmarkHardGate;
    runId: string;
    evidence: string;
  }[];
}

export function evaluateDurableBenchmarkHardGates(
  results: readonly DurableBenchmarkRunResult[],
): DurableBenchmarkHardGateDecision {
  const failures: Array<{ gate: DurableBenchmarkHardGate; runId: string; evidence: string }> = [];
  const scenarios = new Map(getPhase7Scenarios().map((scenario) => [scenario.id, scenario]));

  const fail = (gate: DurableBenchmarkHardGate, run: DurableBenchmarkRunResult, evidence: string) => {
    failures.push({ gate, runId: run.runId, evidence });
  };

  for (const run of results) {
    const scenario = scenarios.get(run.scenarioId);
    if (!scenario) {
      fail('terminal_state_truth', run, 'scenario definition missing');
      continue;
    }

    if (run.crossTenantViolation) fail('tenant_isolation', run, 'cross-tenant violation observed');
    if (run.committedEffects !== scenario.expectedCommittedEffects) {
      fail('exactly_once_effect', run, `expected ${scenario.expectedCommittedEffects} committed effects, got ${run.committedEffects}`);
    }
    if (scenario.id === 'process_crash_recovery' && !run.recoveredAfterCrash) {
      fail('crash_recovery', run, 'crash scenario did not recover');
    }
    if ((scenario.requiresApproval || scenario.id === 'process_crash_recovery') && !run.resumedFromExpectedStep && scenario.approvalOutcome === 'approve') {
      fail('resume_position', run, 'run did not resume from expected checkpoint');
    }
    if (scenario.requiresApproval && scenario.approvalOutcome === 'approve' && !run.approvalSatisfied) {
      fail('approval_required', run, 'approval-required scenario completed without satisfied approval');
    }
    if ((scenario.approvalOutcome === 'reject' || scenario.approvalOutcome === 'expire') && run.committedEffects !== 0) {
      fail('approval_rejection_expiry', run, 'rejected/expired approval committed an effect');
    }
    if (run.retryCount > scenario.maxRetries) {
      fail('retry_limit', run, `retry count ${run.retryCount} exceeded ${scenario.maxRetries}`);
    }
    if (run.terminalState !== scenario.expectedTerminalState) {
      fail('terminal_state_truth', run, `expected ${scenario.expectedTerminalState}, got ${run.terminalState}`);
    }
    if (run.lifecycle.length === 0 || run.lifecycle.some((event) => !event.evidence.trim())) {
      fail('reconstructable_evidence', run, 'lifecycle evidence is missing or blank');
    }
  }

  return { passed: failures.length === 0, failures };
}
