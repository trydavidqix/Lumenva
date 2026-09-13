import { describe, expect, it } from 'vitest';

import { buildHermesCandidateManifest } from '../hermes/candidate-manifest';

const base = {
  id: 'candidate-1',
  version: 1,
  scope: { organizationId: 'org-a', agentId: 'sales', capabilityId: 'reply' },
  type: 'prompt_change' as const,
  currentStateRef: 'prompt:v1',
  proposedStateRef: 'prompt:v2',
  hypothesis: 'answer price earlier',
  expectedBenefit: 'reduce abandonment',
  knownRegressions: ['may increase token use'],
  riskClass: 'MEDIUM' as const,
  costEstimateCents: 10,
  evidenceRefs: ['eval:1', 'run:2'],
  rollbackTargetRef: 'prompt:v1',
  requiredEvalSuite: ['golden:sales', 'safety:policy'],
  promotionPolicy: 'shadow_then_approval',
};

describe('Hermes candidate manifest', () => {
  it('creates deterministic immutable fingerprints for bounded candidates', () => {
    const a = buildHermesCandidateManifest(base);
    const b = buildHermesCandidateManifest({ ...base, evidenceRefs: ['run:2', 'eval:1'] });
    expect(a.contentFingerprint).toBe(b.contentFingerprint);
    expect(a.rollbackTargetRef).toBe('prompt:v1');
  });

  it('rejects authority-bearing candidate payloads', () => {
    expect(() => buildHermesCandidateManifest({ ...base, autonomyLevel: 'AUTO_EXPANDED' } as never)).toThrow(
      'hermes_candidate_forbidden_authority_field',
    );
  });
});
