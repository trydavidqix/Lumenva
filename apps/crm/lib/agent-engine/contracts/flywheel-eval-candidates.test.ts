import { describe, expect, it } from 'vitest';
import type { LearningCluster } from '../flywheel/clustering';
import { admitEvalCaseCandidate, buildEvalCaseCandidate } from '../flywheel/eval-candidates';

const cluster: LearningCluster = {
  id: 'cluster-1',
  scope: { organizationId: 'org-1', agentId: 'agent-1', capabilityId: 'memory-hygiene' },
  failureType: 'policy_escalation', occurrences: 3, confidence: 0.9, impact: 0.9,
  signalRefs: ['evidence:1', 'evidence:2'], firstObservedAt: '2026-08-18T10:00:00.000Z', lastObservedAt: '2026-08-18T10:05:00.000Z',
};

describe('Phase 6 eval candidates', () => {
  it('builds a stable fingerprint and preserves a safety invariant', () => {
    const a = buildEvalCaseCandidate(cluster);
    const b = buildEvalCaseCandidate(cluster);
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(a.safetyInvariant).toBeTruthy();
    expect(a.inputRef).toBe('evidence:1');
  });

  it('deduplicates canonical admission', async () => {
    const seen = new Set<string>();
    const dataset = {
      async containsFingerprint(fingerprint: string) { return seen.has(fingerprint); },
      async admit(candidate: ReturnType<typeof buildEvalCaseCandidate>) { seen.add(candidate.fingerprint); return { admitted: true, reason: 'admitted' }; },
    };
    const candidate = buildEvalCaseCandidate(cluster);
    expect((await admitEvalCaseCandidate(dataset, candidate)).admitted).toBe(true);
    expect((await admitEvalCaseCandidate(dataset, candidate)).reason).toBe('duplicate_fingerprint');
  });

  it('rejects malformed raw-looking references', async () => {
    const dataset = { async containsFingerprint() { return false; }, async admit() { return { admitted: true, reason: 'admitted' }; } };
    const candidate = { ...buildEvalCaseCandidate(cluster), inputRef: 'person@example.com' };
    await expect(admitEvalCaseCandidate(dataset, candidate)).rejects.toThrow('flywheel_eval_candidate_raw_pii');
  });
});
