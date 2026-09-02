import { describe, expect, it } from 'vitest';

import {
  parseLearningProposalStatus,
  parseLearningProposalType,
  type LearningProposalRecord,
} from '../flywheel/contracts';
import { buildPhase6ProposalPersistence, mapPhase6ProposalRow } from '../flywheel/store';

describe('Phase 6 flywheel contracts', () => {
  it('accepts only the closed proposal allowlist', () => {
    expect(parseLearningProposalType('skill_change')).toBe('skill_change');
    expect(parseLearningProposalType('routing_change')).toBe('routing_change');
    expect(parseLearningProposalType('eval_case')).toBe('eval_case');
    expect(parseLearningProposalType('operational_threshold')).toBe('operational_threshold');
    expect(() => parseLearningProposalType('source_code_change')).toThrow(
      'flywheel_proposal_type_not_allowed',
    );
    expect(() => parseLearningProposalType('autonomy_increase')).toThrow(
      'flywheel_proposal_type_not_allowed',
    );
  });

  it('accepts canonical lifecycle states and fails closed for unknown state', () => {
    expect(parseLearningProposalStatus('ready_for_human_review')).toBe(
      'ready_for_human_review',
    );
    expect(parseLearningProposalStatus('rollback_recommended')).toBe(
      'rollback_recommended',
    );
    expect(() => parseLearningProposalStatus('auto_promoted')).toThrow(
      'flywheel_status_invalid',
    );
  });

  it('does not reinterpret legacy rows as validated Phase 6 proposals', () => {
    expect(
      mapPhase6ProposalRow({
        id: 'proposal-legacy',
        organization_id: 'org-a',
        run_id: 'run-1',
        dataset: 'live',
        type: 'playbook_bullet',
        target: 'tenant',
        content: 'legacy',
        evidence: { trace_ids: ['trace-1'] },
        applied_at: null,
        applied_version_id: null,
        applied_by: null,
      }),
    ).toBeNull();
  });

  it('maps only tenant-consistent Phase 6 rows', () => {
    const row = {
      id: 'proposal-1',
      organization_id: 'org-a',
      run_id: 'cluster-1',
      dataset: 'agent_os_phase_6',
      type: 'skill_change',
      target: 'capability-1',
      content: 'candidate',
      evidence: {
        phase6: {
          phase: 6,
          scope: {
            organizationId: 'org-a',
            agentId: 'agent-1',
            capabilityId: 'capability-1',
          },
          status: 'candidate_created',
          proposalType: 'skill_change',
          fingerprint: 'fp-1',
          clusterId: 'cluster-1',
          signalRefs: ['signal-2', 'signal-1'],
          candidateRef: 'candidate-1',
          validationRef: null,
          rolloutLevel: null,
          rollbackTargetRef: null,
          rejectionReason: null,
        },
      },
      applied_at: null,
      applied_version_id: null,
      applied_by: null,
    };

    expect(mapPhase6ProposalRow(row)?.scope).toEqual({
      organizationId: 'org-a',
      agentId: 'agent-1',
      capabilityId: 'capability-1',
    });
    expect(mapPhase6ProposalRow(row)?.evidence.signalRefs).toEqual(['signal-1', 'signal-2']);
    expect(() =>
      mapPhase6ProposalRow({
        ...row,
        organization_id: 'org-b',
      }),
    ).toThrow('flywheel_tenant_mismatch');
  });

  it('uses a UUID-compatible persistence run id instead of the cluster hash', () => {
    const record: LearningProposalRecord = {
      id: '11111111-1111-4111-8111-111111111111',
      scope: { organizationId: '22222222-2222-4222-8222-222222222222', agentId: '33333333-3333-4333-8333-333333333333', capabilityId: 'memory-hygiene' },
      type: 'skill_change',
      content: 'candidate',
      evidence: {
        phase: 6,
        status: 'clustered',
        proposalType: 'skill_change',
        fingerprint: 'fp',
        clusterId: 'a'.repeat(64),
        signalRefs: ['evidence:1', 'evidence:2'],
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

    const row = buildPhase6ProposalPersistence(record, null);
    expect(row.run_id).toBe(record.id);
    expect(row.type).toBe('skill_change');
    expect((row.evidence as { phase6: { clusterId: string } }).phase6.clusterId).toBe(record.evidence.clusterId);
  });
});
