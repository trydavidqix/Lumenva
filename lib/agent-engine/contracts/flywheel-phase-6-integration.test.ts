import { describe, expect, it } from 'vitest';
import type { LearningProposalRecord, LearningProposalStore, LearningScope } from '../flywheel/contracts';
import { buildSkillCandidate } from '../flywheel/candidates';
import { runLearningFlywheelIteration } from '../flywheel/orchestrator';
import { decideLearningProposal } from '../flywheel/promotion-queue';
import { advanceLearningRollout, startLearningRollout } from '../flywheel/rollout';
import { applyMonitoringOutcome, comparePromotionWindows } from '../flywheel/monitoring';
import { validateCandidate, type CandidateMetrics } from '../flywheel/validator';

class Store implements LearningProposalStore {
  rows: LearningProposalRecord[] = [];
  async findOpenByFingerprint(scope: LearningScope, fp: string) { return this.rows.find((r) => r.scope.organizationId === scope.organizationId && r.evidence.fingerprint === fp && !['rejected', 'closed', 'rolled_back'].includes(r.evidence.status)) ?? null; }
  async save(record: LearningProposalRecord) { const i = this.rows.findIndex((r) => r.id === record.id); if (i < 0) this.rows.push(record); else this.rows[i] = record; }
  async load(_scope: LearningScope, id: string) { return this.rows.find((r) => r.id === id) ?? null; }
  async listForScope(scope: LearningScope) { return this.rows.filter((r) => r.scope.organizationId === scope.organizationId && r.scope.agentId === scope.agentId && (scope.capabilityId === '*' || r.scope.capabilityId === scope.capabilityId)); }
}

const raw = (id: string) => ({ id, scope: { organizationId: 'org-1', agentId: 'agent-1', capabilityId: 'memory-hygiene' }, kind: 'eval_failure', confidence: 0.9, impact: 0.8, observedAt: '2026-08-18T10:00:00.000Z', evidenceRef: `evidence:${id}`, failureClass: 'memory_write_noise' });
const thresholds = { minOccurrences: 2, minConfidence: 0.5, minImpact: 0.5, windowMs: 60_000 };
const budget = { maxSignals: 10, maxClusters: 5, maxCandidates: 3, maxModelTokens: 1000, maxCostCents: 10, maxRuntimeMs: 5000, noProgressLimit: 1 };
const baseline: CandidateMetrics = { accuracy: 0.8, policyCompliance: 1, escalationCorrectness: 0.9, failureRate: 0.1, loopStopRate: 1, costCents: 10, latencyMs: 1000 };
const better: CandidateMetrics = { accuracy: 0.9, policyCompliance: 1, escalationCorrectness: 0.95, failureRate: 0.05, loopStopRate: 1, costCents: 9, latencyMs: 900 };

async function createProposal(store: Store): Promise<LearningProposalRecord> {
  await runLearningFlywheelIteration({
    rawSignals: [raw('1'), raw('2'), raw('3')], store, thresholds, budget,
    nowMs: Date.parse('2026-08-18T10:00:10.000Z'),
    proposalForCluster: (cluster) => ({ scope: cluster.scope, type: 'skill_change', target: cluster.scope.capabilityId, content: 'tighten memory criteria', cluster, priority: 1 }),
  });
  const proposal = store.rows[0];
  if (!proposal) throw new Error('expected_learning_proposal');
  return proposal;
}

function validationPorts(candidate: CandidateMetrics, safety = true) {
  return {
    async runRegression() { return { passed: true, evidenceRef: 'reg:1' }; },
    async runGolden() { return { passed: true, evidenceRef: 'golden:1' }; },
    async evaluateMetrics(_ref: string, isBaseline: boolean) { return isBaseline ? baseline : candidate; },
    async checkSafety() { return { passed: safety, evidenceRef: 'safe:1' }; },
    async runShadow() { return { passed: true, evidenceRef: 'shadow:1' }; },
  };
}

describe('Phase 6 bounded learning iteration', () => {
  it('normalizes, clusters and creates one governed proposal', async () => {
    const store = new Store();
    const result = await runLearningFlywheelIteration({ rawSignals: [raw('1'), raw('2'), raw('3')], store, thresholds, budget, nowMs: Date.parse('2026-08-18T10:00:10.000Z'), proposalForCluster: (cluster) => ({ scope: cluster.scope, type: 'skill_change', target: cluster.scope.capabilityId, content: 'tighten memory criteria', cluster, priority: 1 }) });
    expect(result).toMatchObject({ processedSignals: 3, clusters: 1, createdProposals: 1 });
    expect(store.rows).toHaveLength(1);
  });

  it('completes signals -> candidate -> validation -> human approval -> SHADOW -> DRAFT -> monitoring -> close', async () => {
    const store = new Store();
    let proposal = await createProposal(store);
    const candidate = buildSkillCandidate({ baseVersionId: 'version:1', candidateVersionId: 'version:2' });
    proposal = { ...proposal, evidence: { ...proposal.evidence, status: 'validating', candidateRef: candidate.candidateVersionId, rollbackTargetRef: candidate.rollbackVersionId } };
    await store.save(proposal);

    const report = await validateCandidate(candidate.candidateVersionId, validationPorts(better));
    expect(report.passed).toBe(true);
    proposal = { ...proposal, evidence: { ...proposal.evidence, status: 'ready_for_human_review', validationRef: 'validation:pass' } };
    await store.save(proposal);

    proposal = await decideLearningProposal(store, { organizationId: 'org-1', agentId: 'agent-1', proposalId: proposal.id, userId: 'user-1', decision: 'approve', reason: 'validated' });
    expect(proposal.evidence.status).toBe('approved');

    const calls: string[] = [];
    const rolloutPorts = {
      assertRestoreAllowed(level: string) { calls.push(`assert:${level}`); },
      async setCandidateLevel(_ref: string, level: 'shadow' | 'draft') { calls.push(level); },
      async restorePreviousLevel(_ref: string, level: string) { calls.push(`restore:${level}`); },
      async rollback(_ref: string, target: string) { calls.push(`rollback:${target}`); },
    };
    let rollout = await startLearningRollout({ proposalId: proposal.id, candidateRef: candidate.candidateVersionId, previousLevel: 'assisted', rollbackTargetRef: candidate.rollbackVersionId, proposalStatus: proposal.evidence.status, runtimeAffecting: true }, rolloutPorts);
    rollout = await advanceLearningRollout(rollout, 'draft', rolloutPorts);
    rollout = await advanceLearningRollout(rollout, 'restore', rolloutPorts);
    expect(calls).toEqual(['assert:assisted', 'shadow', 'draft', 'assert:assisted', 'restore:assisted']);

    proposal = { ...proposal, evidence: { ...proposal.evidence, status: 'monitoring', rolloutLevel: 'draft' } };
    const comparison = comparePromotionWindows(baseline, better, 20, 10);
    proposal = await applyMonitoringOutcome(proposal, comparison, rolloutPorts);
    expect(proposal.evidence.status).toBe('closed');
  });

  it('rejects validation regressions and recommends rollback for later non-critical degradation', async () => {
    const store = new Store();
    let proposal = await createProposal(store);
    const candidate = buildSkillCandidate({ baseVersionId: 'version:1', candidateVersionId: 'version:2' });
    const failed = await validateCandidate(candidate.candidateVersionId, validationPorts({ ...better, accuracy: 0.7 }));
    expect(failed.passed).toBe(false);

    proposal = { ...proposal, evidence: { ...proposal.evidence, status: 'monitoring', candidateRef: candidate.candidateVersionId, rollbackTargetRef: candidate.rollbackVersionId } };
    const degraded = comparePromotionWindows(baseline, { ...baseline, costCents: 15 }, 20, 10);
    proposal = await applyMonitoringOutcome(proposal, degraded, { async rollback() { throw new Error('should_not_run'); } });
    expect(proposal.evidence.status).toBe('rollback_recommended');
  });

  it('stops deterministically on signal budget', async () => {
    const store = new Store();
    const exhausted = await runLearningFlywheelIteration({ rawSignals: [raw('1'), raw('2')], store, thresholds, budget: { ...budget, maxSignals: 1 }, nowMs: Date.parse('2026-08-18T10:00:10.000Z'), proposalForCluster: () => null });
    expect(exhausted.stoppedReason).toBe('budget_exhausted');
  });

  it('stops before persisting a proposal when synthesis exceeds token or cost budget', async () => {
    const store = new Store();
    const result = await runLearningFlywheelIteration({
      rawSignals: [raw('1'), raw('2'), raw('3')],
      store,
      thresholds,
      budget,
      nowMs: Date.parse('2026-08-18T10:00:10.000Z'),
      proposalForCluster: (cluster) => ({
        draft: { scope: cluster.scope, type: 'skill_change', target: cluster.scope.capabilityId, content: 'candidate', cluster, priority: 1 },
        modelTokens: 1200,
        costCents: 11,
      }),
    });
    expect(result.stoppedReason).toBe('budget_exhausted');
    expect(result.modelTokensUsed).toBe(1200);
    expect(result.costCentsUsed).toBe(11);
    expect(store.rows).toHaveLength(0);
  });
});
