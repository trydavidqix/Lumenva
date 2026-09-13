import { describe, expect, it } from 'vitest';

import { buildHermesContextFingerprint } from '../hermes/fingerprint';
import { rankPriorEvidence } from '../hermes/retrieval';
import type { ResearchExperimentRecord } from '../hermes/research-memory';

const experiment = (overrides: Partial<ResearchExperimentRecord> = {}): ResearchExperimentRecord => ({
  id: 'exp-a',
  organizationId: 'org-a',
  subjectKind: 'agent',
  subjectId: 'sales',
  contextFingerprint: 'fp-current',
  goal: 'improve sales conversion',
  strategy: 'prompt-v2',
  metricName: 'conversion',
  baselineValue: 0.2,
  observedValue: 0.25,
  score: 0.9,
  status: 'keep',
  evidenceRefs: ['run:1'],
  metadata: { tags: ['sales', 'whatsapp'] },
  sourceVersion: 'v1',
  supersedesId: null,
  createdAt: '2026-09-10T00:00:00.000Z',
  ...overrides,
});

describe('Hermes fingerprints and controlled retrieval', () => {
  it('fingerprints equivalent unordered capability/dependency inputs identically', () => {
    const a = buildHermesContextFingerprint({ domain: 'Sales', dependencies: ['b', 'a'], capabilities: ['send', 'read'] });
    const b = buildHermesContextFingerprint({ domain: 'sales', dependencies: ['a', 'b'], capabilities: ['read', 'send'] });
    expect(a).toBe(b);
  });

  it('returns only same-tenant evidence and always requires re-test', () => {
    const results = rankPriorEvidence(
      {
        organizationId: 'org-a',
        contextFingerprint: 'fp-current',
        goal: 'improve sales conversion',
        metricName: 'conversion',
        tags: ['sales'],
        now: '2026-09-13T00:00:00.000Z',
      },
      [experiment(), experiment({ id: 'exp-b', organizationId: 'org-b', score: 1 })],
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.record.organizationId).toBe('org-a');
    expect(results[0]?.mustRetest).toBe(true);
    expect(results[0]?.score).toBeGreaterThan(0.8);
  });
});
