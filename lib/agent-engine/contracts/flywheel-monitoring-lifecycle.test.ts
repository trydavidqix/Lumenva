import { describe, expect, it } from 'vitest';
import type { LearningProposalRecord } from '../flywheel/contracts';
import { applyMonitoringOutcome } from '../flywheel/monitoring';

const proposal: LearningProposalRecord = {
  id: 'p1', scope: { organizationId: 'org-1', agentId: 'agent-1', capabilityId: 'cap-1' }, type: 'skill_change', content: 'x',
  evidence: { phase: 6, status: 'monitoring', proposalType: 'skill_change', fingerprint: 'fp', clusterId: 'c1', signalRefs: [], candidateRef: 'candidate:1', validationRef: 'validation:1', rolloutLevel: 'draft', rollbackTargetRef: 'version:1', rejectionReason: null },
  appliedAt: null, appliedVersionId: null, appliedBy: null,
};

describe('Phase 6 monitoring lifecycle', () => {
  it('rolls back critical regressions only after rollback succeeds', async () => {
    const calls: string[] = [];
    const result = await applyMonitoringOutcome(proposal, { verdict: 'regressed', criticalSafetyRegression: true, reasons: ['policy_compliance_regression'] }, { async rollback(candidateRef, targetRef) { calls.push(`${candidateRef}:${targetRef}`); } });
    expect(calls).toEqual(['candidate:1:version:1']);
    expect(result.evidence.status).toBe('rolled_back');
  });

  it('recommends non-critical rollback and closes stable monitoring', async () => {
    const ports = { async rollback() { throw new Error('should_not_run'); } };
    expect((await applyMonitoringOutcome(proposal, { verdict: 'regressed', criticalSafetyRegression: false, reasons: ['cost_regression'] }, ports)).evidence.status).toBe('rollback_recommended');
    expect((await applyMonitoringOutcome(proposal, { verdict: 'better', criticalSafetyRegression: false, reasons: [] }, ports)).evidence.status).toBe('closed');
  });
});
