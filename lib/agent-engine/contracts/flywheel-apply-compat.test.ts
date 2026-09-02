import { describe, expect, it } from 'vitest';
import { assertPhase6ProposalScope, phase6ProposalApplyMode } from '../../ai/apply-proposal';

describe('Phase 6 apply compatibility', () => {
  it('routes Phase 6 skill changes to candidate rollout, never immediate publish', () => {
    const mode = phase6ProposalApplyMode({ phase: 6, status: 'ready_for_human_review', proposalType: 'skill_change' });
    expect(mode).toBe('candidate_rollout');
  });

  it('keeps legacy rows on the legacy path', () => {
    expect(phase6ProposalApplyMode(null)).toBe('legacy');
    expect(() => assertPhase6ProposalScope(null, { organizationId: 'org-1', agentId: 'agent-1' })).not.toThrow();
  });

  it('rejects non-reviewable Phase 6 rows', () => {
    expect(() => phase6ProposalApplyMode({ phase: 6, status: 'approved', proposalType: 'skill_change' })).toThrow('flywheel_proposal_not_reviewable');
  });

  it('rejects Phase 6 proposals bound to another tenant or agent', () => {
    const phase6 = {
      phase: 6,
      status: 'ready_for_human_review',
      proposalType: 'skill_change',
      scope: { organizationId: 'org-1', agentId: 'agent-1', capabilityId: 'memory-hygiene' },
    };
    expect(() => assertPhase6ProposalScope(phase6, { organizationId: 'org-1', agentId: 'agent-1' })).not.toThrow();
    expect(() => assertPhase6ProposalScope(phase6, { organizationId: 'org-2', agentId: 'agent-1' })).toThrow('flywheel_proposal_scope_mismatch');
    expect(() => assertPhase6ProposalScope(phase6, { organizationId: 'org-1', agentId: 'agent-2' })).toThrow('flywheel_proposal_scope_mismatch');
  });
});
