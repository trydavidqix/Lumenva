import { describe, expect, it, vi } from 'vitest';

import { createHermesLearningService } from '../hermes/service';
import type { ResearchExperimentRecord } from '../hermes/research-memory';

const prior: ResearchExperimentRecord = {
  id: 'exp-1',
  organizationId: 'org-a',
  subjectKind: 'agent',
  subjectId: 'sales',
  contextFingerprint: 'fp-current',
  goal: 'improve conversion',
  strategy: 'prompt-v2',
  metricName: 'conversion',
  baselineValue: 0.2,
  observedValue: 0.25,
  score: 0.9,
  status: 'keep',
  evidenceRefs: ['run:old'],
  metadata: {},
  sourceVersion: 'v1',
  supersedesId: null,
  createdAt: '2026-09-10T00:00:00.000Z',
};

describe('Hermes unified learning cycle', () => {
  it('observes, retrieves and summarizes without activating a change', async () => {
    const runIteration = vi.fn().mockResolvedValue({
      processedSignals: 1,
      clusters: 1,
      createdProposals: 1,
      enrichedProposals: 0,
      modelTokensUsed: 0,
      costCentsUsed: 0,
      stoppedReason: 'completed',
    });
    const service = createHermesLearningService({ runIteration: runIteration as never });

    const result = await service.runUnifiedCycle({
      flywheel: { rawSignals: [] } as never,
      retrieval: {
        query: {
          organizationId: 'org-a',
          contextFingerprint: 'fp-current',
          goal: 'improve conversion',
          metricName: 'conversion',
          now: '2026-09-13T00:00:00.000Z',
        },
        records: [prior, { ...prior, id: 'exp-other', organizationId: 'org-b' }],
      },
    });

    expect(result.flywheel.createdProposals).toBe(1);
    expect(result.retrievedEvidence).toHaveLength(1);
    expect(result.retrievedEvidence[0]?.mustRetest).toBe(true);
    expect(result.requiresApproval).toBe(true);
    expect(result.activatedChanges).toBe(0);
  });
});
