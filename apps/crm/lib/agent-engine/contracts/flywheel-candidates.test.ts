import { describe, expect, it } from 'vitest';
import { buildRoutingCandidate, buildSkillCandidate } from '../flywheel/candidates';

describe('Phase 6 learning candidates', () => {
  it('keeps skill candidates immutable with an explicit rollback version', () => {
    const candidate = buildSkillCandidate({ baseVersionId: 'v1', candidateVersionId: 'v2' });
    expect(candidate.baseVersionId).toBe('v1');
    expect(candidate.candidateVersionId).toBe('v2');
    expect(candidate.rollbackVersionId).toBe('v1');
    expect(candidate.candidateVersionId).not.toBe(candidate.baseVersionId);
  });

  it('requires routing certification evidence', () => {
    const lookup = { assertCertified: ({ provider, model }: { provider: string; model: string }) => {
      if (provider !== 'approved' || model !== 'approved-model') throw new Error('flywheel_routing_not_certified');
      return { evidenceRef: 'cert:1' };
    } };
    expect(buildRoutingCandidate({ provider: 'approved', model: 'approved-model', skillVersionId: null, lookup }).certificationEvidenceRef).toBe('cert:1');
    expect(() => buildRoutingCandidate({ provider: 'disabled', model: 'x', skillVersionId: null, lookup })).toThrow('flywheel_routing_not_certified');
  });

  it('rejects candidate authority fields', () => {
    expect(() => buildSkillCandidate({ baseVersionId: 'v1', candidateVersionId: 'v2', autonomyLevel: 'autopilot' } as never)).toThrow('flywheel_candidate_forbidden_field');
  });
});
