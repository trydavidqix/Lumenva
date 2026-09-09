import { describe, expect, it } from 'vitest';
import type { LearningProposalRecord, LearningProposalStore, LearningScope } from '../flywheel/contracts';
import type { LearningCluster } from '../flywheel/clustering';
import { proposalFingerprint, upsertLearningProposal, type ProposalDraft } from '../flywheel/proposals';

const scope: LearningScope = { organizationId: 'org-1', agentId: 'agent-1', capabilityId: 'memory-hygiene' };
const cluster = (refs = ['signal:1', 'signal:2']): LearningCluster => ({
  id: 'cluster-1', scope, failureType: 'eval_failure', occurrences: 2, confidence: 0.9, impact: 0.8,
  signalRefs: refs, firstObservedAt: '2026-08-18T10:00:00.000Z', lastObservedAt: '2026-08-18T10:05:00.000Z',
});
const draft = (refs?: string[]): ProposalDraft => ({ scope, type: 'skill_change', target: 'memory-hygiene', content: 'tighten criteria', cluster: cluster(refs), priority: 1 });

class Store implements LearningProposalStore {
  rows: LearningProposalRecord[] = [];
  async findOpenByFingerprint(s: LearningScope, fingerprint: string) {
    return this.rows.find((r) => r.scope.organizationId === s.organizationId && r.evidence.fingerprint === fingerprint && r.evidence.status !== 'rejected' && r.appliedAt === null) ?? null;
  }
  async save(record: LearningProposalRecord) { const i = this.rows.findIndex((r) => r.id === record.id); if (i < 0) this.rows.push(record); else this.rows[i] = record; }
  async load(_s: LearningScope, id: string) { return this.rows.find((r) => r.id === id) ?? null; }
  async listForScope() { return this.rows; }
}

describe('Phase 6 proposal governance', () => {
  it('uses a stable scoped fingerprint', () => {
    expect(proposalFingerprint(draft())).toBe(proposalFingerprint(draft()));
  });

  it('enriches duplicate open evidence', async () => {
    const store = new Store();
    expect((await upsertLearningProposal(store, draft())).kind).toBe('created');
    const result = await upsertLearningProposal(store, draft(['signal:2', 'signal:3']));
    expect(result.kind).toBe('enriched');
    expect(store.rows).toHaveLength(1);
    expect(result.proposal.evidence.signalRefs).toEqual(['signal:1', 'signal:2', 'signal:3']);
  });

  it('blocks one-off clusters and identical rejected fingerprints', async () => {
    const store = new Store();
    await expect(upsertLearningProposal(store, { ...draft(), cluster: { ...cluster(), occurrences: 1 } })).rejects.toThrow('flywheel_cluster_not_actionable');
    const created = await upsertLearningProposal(store, draft());
    store.rows[0] = { ...created.proposal, evidence: { ...created.proposal.evidence, status: 'rejected' } };
    await expect(upsertLearningProposal(store, draft())).rejects.toThrow('flywheel_proposal_rejection_cooldown');
  });

  it('rejects unsupported types before persistence', async () => {
    const store = new Store();
    await expect(upsertLearningProposal(store, { ...draft(), type: 'invalid_type' as never })).rejects.toThrow('flywheel_proposal_type_not_allowed');
    expect(store.rows).toHaveLength(0);
  });
});
