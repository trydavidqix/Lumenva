import { describe, expect, it } from 'vitest';
import type { LearningProposalRecord, LearningProposalStore, LearningScope } from '../flywheel/contracts';
import { decideLearningProposal } from '../flywheel/promotion-queue';

const scope: LearningScope = { organizationId: 'org-1', agentId: 'agent-1', capabilityId: 'memory-hygiene' };
const record = (): LearningProposalRecord => ({
  id: 'proposal-1', scope, type: 'skill_change', content: 'candidate',
  evidence: { phase: 6, status: 'ready_for_human_review', proposalType: 'skill_change', fingerprint: 'fp', clusterId: 'cluster-1', signalRefs: ['signal:1'], candidateRef: 'candidate:1', validationRef: 'validation:1', rolloutLevel: null, rollbackTargetRef: 'version:1', rejectionReason: null },
  appliedAt: null, appliedVersionId: null, appliedBy: null,
});

class Store implements LearningProposalStore {
  row: LearningProposalRecord | null = record();
  async findOpenByFingerprint() { return this.row; }
  async save(value: LearningProposalRecord) { this.row = value; }
  async load(s: LearningScope, id: string) { return this.row && id === this.row.id && s.organizationId === this.row.scope.organizationId && s.agentId === this.row.scope.agentId ? this.row : null; }
  async listForScope() { return this.row ? [this.row] : []; }
}

const input = { organizationId: 'org-1', agentId: 'agent-1', proposalId: 'proposal-1', userId: 'user-1', decision: 'approve' as const, reason: 'validated' };

describe('Phase 6 human promotion queue', () => {
  it('supports approve, reject and revision without changing autonomy', async () => {
    for (const [decision, status] of [['approve', 'approved'], ['reject', 'rejected'], ['request_revision', 'revision_requested']] as const) {
      const store = new Store();
      const result = await decideLearningProposal(store, { ...input, decision, reason: 'reviewed' });
      expect(result.evidence.status).toBe(status);
      expect(result.evidence.rolloutLevel).toBeNull();
    }
  });

  it('rejects tenant mismatch and non-validated proposals', async () => {
    const store = new Store();
    await expect(decideLearningProposal(store, { ...input, organizationId: 'org-2' })).rejects.toThrow('flywheel_proposal_scope_mismatch');
    store.row = { ...record(), evidence: { ...record().evidence, status: 'validating' } };
    await expect(decideLearningProposal(store, input)).rejects.toThrow('flywheel_proposal_not_reviewable');
  });

  it('makes the first decision win and records rejection evidence', async () => {
    const store = new Store();
    const rejected = await decideLearningProposal(store, { ...input, decision: 'reject', reason: 'unsafe regression' });
    expect(rejected.evidence.rejectionReason).toBe('unsafe regression');
    expect(rejected.evidence.signalRefs.some((ref) => ref.startsWith('human_rejection:'))).toBe(true);
    await expect(decideLearningProposal(store, input)).rejects.toThrow('flywheel_proposal_not_reviewable');
  });
});
