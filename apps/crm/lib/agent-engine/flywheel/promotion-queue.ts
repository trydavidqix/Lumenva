import { createHash } from 'node:crypto';
import type { LearningProposalRecord, LearningProposalStore } from './contracts';

export type HumanProposalDecision = 'approve' | 'reject' | 'request_revision';

export interface HumanDecisionInput {
  organizationId: string;
  agentId: string;
  proposalId: string;
  userId: string;
  decision: HumanProposalDecision;
  reason: string;
}

function rejectionSignal(input: HumanDecisionInput): string {
  const digest = createHash('sha256')
    .update([input.proposalId, input.userId, input.reason].join('|'))
    .digest('hex')
    .slice(0, 24);
  return `human_rejection:${digest}`;
}

export async function decideLearningProposal(
  store: LearningProposalStore,
  input: HumanDecisionInput,
): Promise<LearningProposalRecord> {
  if (!input.organizationId || !input.agentId || !input.proposalId || !input.userId || !input.reason.trim()) {
    throw new Error('flywheel_decision_invalid');
  }

  const rows = await store.listForScope({
    organizationId: input.organizationId,
    agentId: input.agentId,
    capabilityId: '*',
  });
  const proposal = rows.find((row) => row.id === input.proposalId) ?? null;
  if (!proposal || proposal.scope.organizationId !== input.organizationId || proposal.scope.agentId !== input.agentId) {
    throw new Error('flywheel_proposal_scope_mismatch');
  }
  if (proposal.evidence.status !== 'ready_for_human_review') {
    throw new Error('flywheel_proposal_not_reviewable');
  }

  const nextStatus =
    input.decision === 'approve'
      ? 'approved'
      : input.decision === 'reject'
        ? 'rejected'
        : 'revision_requested';

  const signalRefs =
    input.decision === 'reject'
      ? [...new Set([...proposal.evidence.signalRefs, rejectionSignal(input)])].sort()
      : proposal.evidence.signalRefs;

  const updated: LearningProposalRecord = {
    ...proposal,
    evidence: {
      ...proposal.evidence,
      status: nextStatus,
      signalRefs,
      rejectionReason: input.decision === 'reject' ? input.reason.trim() : proposal.evidence.rejectionReason,
    },
  };
  await store.save(updated);
  return updated;
}
