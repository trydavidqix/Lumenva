import type { LearningProposalRecord } from './contracts';
import type { CandidateMetrics } from './validator';

export type MonitoringVerdict = 'better' | 'neutral' | 'insufficient_sample' | 'regressed';

export interface MonitoringComparison {
  verdict: MonitoringVerdict;
  criticalSafetyRegression: boolean;
  reasons: string[];
}

export function comparePromotionWindows(
  baseline: CandidateMetrics,
  current: CandidateMetrics,
  sampleCount: number,
  minSampleCount: number,
): MonitoringComparison {
  if (!Number.isFinite(sampleCount) || !Number.isFinite(minSampleCount) || minSampleCount < 1 || sampleCount < 0) {
    throw new Error('flywheel_monitoring_sample_invalid');
  }
  if (sampleCount < minSampleCount) {
    return { verdict: 'insufficient_sample', criticalSafetyRegression: false, reasons: ['insufficient_sample'] };
  }

  const reasons: string[] = [];
  const criticalSafetyRegression =
    current.policyCompliance < baseline.policyCompliance ||
    current.escalationCorrectness < baseline.escalationCorrectness ||
    current.loopStopRate < baseline.loopStopRate;

  if (current.policyCompliance < baseline.policyCompliance) reasons.push('policy_compliance_regression');
  if (current.escalationCorrectness < baseline.escalationCorrectness) reasons.push('escalation_regression');
  if (current.loopStopRate < baseline.loopStopRate) reasons.push('loop_stop_regression');
  if (current.accuracy < baseline.accuracy) reasons.push('accuracy_regression');
  if (current.failureRate > baseline.failureRate) reasons.push('failure_rate_regression');
  if (current.costCents > baseline.costCents) reasons.push('cost_regression');
  if (current.latencyMs > baseline.latencyMs) reasons.push('latency_regression');

  if (criticalSafetyRegression || reasons.length > 0) {
    return { verdict: 'regressed', criticalSafetyRegression, reasons };
  }

  const improved =
    current.accuracy > baseline.accuracy ||
    current.failureRate < baseline.failureRate ||
    current.costCents < baseline.costCents ||
    current.latencyMs < baseline.latencyMs;

  return { verdict: improved ? 'better' : 'neutral', criticalSafetyRegression: false, reasons: [] };
}

export function determineRollbackAction(
  comparison: MonitoringComparison,
): 'none' | 'recommend_rollback' | 'immediate_safe_rollback' {
  if (comparison.criticalSafetyRegression) return 'immediate_safe_rollback';
  if (comparison.verdict === 'regressed') return 'recommend_rollback';
  return 'none';
}

export async function applyMonitoringOutcome(
  proposal: LearningProposalRecord,
  comparison: MonitoringComparison,
  ports: { rollback(candidateRef: string, rollbackTargetRef: string): Promise<void> },
): Promise<LearningProposalRecord> {
  if (proposal.evidence.status !== 'monitoring') throw new Error('flywheel_monitoring_state_invalid');
  const action = determineRollbackAction(comparison);

  if (action === 'immediate_safe_rollback') {
    if (!proposal.evidence.candidateRef || !proposal.evidence.rollbackTargetRef) {
      throw new Error('flywheel_rollback_target_missing');
    }
    await ports.rollback(proposal.evidence.candidateRef, proposal.evidence.rollbackTargetRef);
    return {
      ...proposal,
      evidence: { ...proposal.evidence, status: 'rolled_back', rolloutLevel: 'off' },
    };
  }

  if (action === 'recommend_rollback') {
    return { ...proposal, evidence: { ...proposal.evidence, status: 'rollback_recommended' } };
  }

  if (comparison.verdict === 'better' || comparison.verdict === 'neutral') {
    return { ...proposal, evidence: { ...proposal.evidence, status: 'closed' } };
  }

  return proposal;
}
