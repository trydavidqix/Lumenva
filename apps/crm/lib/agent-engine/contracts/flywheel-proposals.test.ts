import { describe, expect, it } from 'vitest';

import type {
  LearningProposalRecord,
  LearningProposalStore,
  LearningScope,
} from '../flywheel/contracts';
import type { LearningCluster } from '../flywheel/clustering';
import {
  proposalFingerprint,
  upsertLearningProposal,
} from '../flywheel/proposals';
import { scoreProposalPriority } from '../flywheel/scoring';

const scope: LearningScope = {
  organizationId: 'org-1',
  agentId: 'agent-1',
  capabilityId: 'cap-1',
};

function cluster(signalRefs = ['sig-1', 'sig-2']): LearningCluster {
  return {
    id: 'cluster-1',
    scope,
    failureType: 'eval_failure',
    occurrences: signalRefs.length,
    confidence: 0.9,
    impact: 0.8,
    signalRefs,
    firstObservedAt: '2026-08-18T10:00:00.000Z',
    lastObservedAt: '2026-08-18T11:00:00.000Z',
  };
}

function memoryStore(initial: LearningProposalRecord[] = []): LearningProposalStore & { rows: LearningProposalRecord[] } {
  const store = {
    rows: structuredClone(initial),
    async findOpenByFingerprint(inputScope: LearningScope, fingerprint: string) {
      return this.rows.find(
        (row) =>
          row.scope.organizationId === inputScope.organizationId &&
          row.scope.agentId === inputScope.agentId &&
          row.scope.capabilityId === inputScope.capabilityId &&
          row.evidence.fingerprint === fingerprint &&
          !['rejected', 'rolled_back', 'closed'].includes(row.evidence.status) &&
          row.appliedAt === null,
      ) ?? null;
    },
    async save(record: LearningProposalRecord) {
      const index = this.rows.findIndex((row) => row.id === record.id);
      if (index >= 0) this.rows[index] = structuredClone(record);
      else this.rows.push(structuredClone(record));
    },
    async load(inputScope: LearningScope, proposalId: string) {
      return this.rows.find(
        (row) => row.id === proposalId && row.scope.organizationId === inputScope.organizationId,
      ) ?? null;
    },
    async listForScope(inputScope: LearningScope) {
      return this.rows.filter(
        (row) =>
          row.scope.organizationId === inputScope.organizationId &&
          row.scope.agentId === inputScope.agentId &&
          row.scope.capabilityId === inputScope.capabilityId,
      );
    },
  } satisfies LearningProposalStore & { rows: LearningProposalRecord[] };
  return store;
}

describe('Phase 6 proposal priority scoring', () => {
  it('scores recurring high-impact evidence above weaker evidence', () => {
    const low = scoreProposalPriority({
      frequency: 2,
      impact: 0.5,
      confidence: 0.7,
      failureCost: 0.5,
      changeRiskPenalty: 0.05,
      changeCostPenalty: 0.05,
    });
    const high = scoreProposalPriority({
      frequency: 10,
      impact: 0.9,
      confidence: 0.95,
      failureCost: 1,
      changeRiskPenalty: 0.05,
      changeCostPenalty: 0.05,
    });
    expect(high).toBeGreaterThan(low);
  });

  it('reduces score for change-risk and change-cost penalties', () => {
    const base = {
      frequency: 8,
      impact: 0.8,
      confidence: 0.9,
      failureCost: 1,
    };
    const safe = scoreProposalPriority({
      ...base,
      changeRiskPenalty: 0,
      changeCostPenalty: 0,
    });
    const penalized = scoreProposalPriority({
      ...base,
      changeRiskPenalty: 0.4,
      changeCostPenalty: 0.3,
    });
    expect(penalized).toBeLessThan(safe);
  });

  it('is deterministic for identical input', () => {
    const input = {
      frequency: 5,
      impact: 0.8,
      confidence: 0.88,
      failureCost: 0.7,
      changeRiskPenalty: 0.1,
      changeCostPenalty: 0.05,
    };
    expect(scoreProposalPriority(input)).toBe(scoreProposalPriority(input));
  });

  it('fails closed for negative or non-finite inputs', () => {
    expect(() =>
      scoreProposalPriority({
        frequency: -1,
        impact: 0.8,
        confidence: 0.9,
        failureCost: 1,
        changeRiskPenalty: 0,
        changeCostPenalty: 0,
      }),
    ).toThrow('flywheel_priority_input_invalid');
    expect(() =>
      scoreProposalPriority({
        frequency: 2,
        impact: Number.NaN,
        confidence: 0.9,
        failureCost: 1,
        changeRiskPenalty: 0,
        changeCostPenalty: 0,
      }),
    ).toThrow('flywheel_priority_input_invalid');
  });
});

describe('Phase 6 proposal authority and deduplication', () => {
  it('uses a stable fingerprint from deterministic scope/type/target/cluster identity', () => {
    const input = {
      scope,
      type: 'skill_change' as const,
      target: 'skill:sdr',
      cluster: cluster(),
    };
    expect(proposalFingerprint(input)).toBe(proposalFingerprint(input));
  });

  it('creates one governed proposal and enriches a duplicate instead of inserting spam', async () => {
    const store = memoryStore();
    const draft = {
      scope,
      type: 'skill_change' as const,
      target: 'skill:sdr',
      content: 'Preserve durable facts before compacting memory.',
      cluster: cluster(),
      priority: 0.9,
    };

    const created = await upsertLearningProposal(store, draft);
    expect(created.kind).toBe('created');
    expect(store.rows).toHaveLength(1);

    const enriched = await upsertLearningProposal(store, {
      ...draft,
      cluster: cluster(['sig-2', 'sig-3']),
    });
    expect(enriched.kind).toBe('enriched');
    expect(store.rows).toHaveLength(1);
    expect(store.rows[0]?.evidence.signalRefs).toEqual(['sig-1', 'sig-2', 'sig-3']);
  });

  it('rejects unauthorized proposal types before persistence', async () => {
    const store = memoryStore();
    await expect(
      upsertLearningProposal(store, {
        scope,
        type: 'autonomy_increase' as never,
        target: 'autonomy',
        content: 'raise autonomy',
        cluster: cluster(),
        priority: 1,
      }),
    ).rejects.toThrow('flywheel_proposal_type_not_allowed');
    expect(store.rows).toHaveLength(0);
  });

  it('does not reopen an identical rejected proposal on the same evidence', async () => {
    const draft = {
      scope,
      type: 'routing_change' as const,
      target: 'routing:sdr',
      content: 'Prefer certified model B.',
      cluster: cluster(),
      priority: 0.8,
    };
    const fingerprint = proposalFingerprint(draft);
    const rejected: LearningProposalRecord = {
      id: 'proposal-rejected',
      scope,
      type: 'routing_change',
      content: draft.content,
      evidence: {
        phase: 6,
        status: 'rejected',
        proposalType: 'routing_change',
        fingerprint,
        clusterId: draft.cluster.id,
        signalRefs: [...draft.cluster.signalRefs],
        candidateRef: null,
        validationRef: null,
        rolloutLevel: null,
        rollbackTargetRef: null,
        rejectionReason: 'not useful',
      },
      appliedAt: null,
      appliedVersionId: null,
      appliedBy: null,
    };
    const store = memoryStore([rejected]);

    await expect(upsertLearningProposal(store, draft)).rejects.toThrow(
      'flywheel_proposal_rejection_cooldown',
    );
    expect(store.rows).toHaveLength(1);
  });
});
