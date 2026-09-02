import { createHash, randomUUID } from 'node:crypto';
import {
  parseLearningProposalType,
  type LearningProposalRecord,
  type LearningProposalStore,
  type LearningProposalType,
  type LearningScope,
} from './contracts';
import type { LearningCluster } from './clustering';

export interface ProposalDraft {
  scope: LearningScope;
  type: LearningProposalType;
  target: string;
  content: string;
  cluster: LearningCluster;
  priority: number;
}

export function proposalFingerprint(input: Pick<ProposalDraft, 'scope' | 'type' | 'target' | 'cluster'>): string {
  const type = parseLearningProposalType(input.type);
  const parts = [input.scope.organizationId, input.scope.agentId, input.scope.capabilityId, type, input.target, input.cluster.id];
  if (parts.some((part) => part.length === 0)) throw new Error('flywheel_scope_invalid');
  if (
    input.cluster.scope.organizationId !== input.scope.organizationId ||
    input.cluster.scope.agentId !== input.scope.agentId ||
    input.cluster.scope.capabilityId !== input.scope.capabilityId
  ) {
    throw new Error('flywheel_cluster_scope_mismatch');
  }
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

function assertActionableCluster(cluster: LearningCluster): void {
  if (cluster.occurrences < 2 || cluster.confidence <= 0 || cluster.impact <= 0 || cluster.signalRefs.length < 2) {
    throw new Error('flywheel_cluster_not_actionable');
  }
}

export async function upsertLearningProposal(
  store: LearningProposalStore,
  draft: ProposalDraft,
): Promise<{ kind: 'created' | 'enriched'; proposal: LearningProposalRecord }> {
  const type = parseLearningProposalType(draft.type);
  assertActionableCluster(draft.cluster);
  if (!Number.isFinite(draft.priority) || draft.priority < 0) throw new Error('flywheel_priority_input_invalid');

  const fingerprint = proposalFingerprint({ ...draft, type });
  const existing = await store.findOpenByFingerprint(draft.scope, fingerprint);
  if (existing) {
    const proposal: LearningProposalRecord = {
      ...existing,
      evidence: {
        ...existing.evidence,
        signalRefs: [...new Set([...existing.evidence.signalRefs, ...draft.cluster.signalRefs])].sort(),
      },
    };
    await store.save(proposal);
    return { kind: 'enriched', proposal };
  }

  const historical = await store.listForScope(draft.scope);
  if (historical.some((row) => row.evidence.fingerprint === fingerprint && row.evidence.status === 'rejected')) {
    throw new Error('flywheel_proposal_rejection_cooldown');
  }

  const proposal: LearningProposalRecord = {
    id: randomUUID(),
    scope: draft.scope,
    type,
    content: draft.content,
    evidence: {
      phase: 6,
      status: 'clustered',
      proposalType: type,
      fingerprint,
      clusterId: draft.cluster.id,
      signalRefs: [...new Set(draft.cluster.signalRefs)].sort(),
      candidateRef: null,
      validationRef: null,
      rolloutLevel: null,
      rollbackTargetRef: null,
      rejectionReason: null,
    },
    appliedAt: null,
    appliedVersionId: null,
    appliedBy: null,
  };
  await store.save(proposal);
  return { kind: 'created', proposal };
}
