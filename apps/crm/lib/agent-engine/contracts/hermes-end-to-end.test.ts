import { describe, expect, it, vi } from 'vitest';

import { createHermesLearningService } from '../hermes/service';
import type { ResearchExperimentRecord } from '../hermes/research-memory';
import type { CandidateMetrics } from '../flywheel/validator';

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

const baseline: CandidateMetrics = {
  accuracy: 0.8,
  policyCompliance: 1,
  escalationCorrectness: 0.9,
  failureRate: 0.1,
  loopStopRate: 1,
  costCents: 10,
  latencyMs: 1000,
};
const candidate: CandidateMetrics = { ...baseline, accuracy: 0.9, failureRate: 0.05 };

function evaluationPorts() {
  return {
    async runRegression() { return { passed: true, evidenceRef: 'reg:new' }; },
    async runGolden() { return { passed: true, evidenceRef: 'golden:new' }; },
    async evaluateMetrics(_ref: string, isBaseline: boolean) { return isBaseline ? baseline : candidate; },
    async checkSafety() { return { passed: true, evidenceRef: 'safety:new' }; },
    async runShadow() { return { passed: true, evidenceRef: 'shadow:new' }; },
  };
}

describe('Hermes unified learning cycle', () => {
  it('retrieves only within budget, retests transferred evidence and never activates a change', async () => {
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

    const result = await service.runCycle({
      flywheel: {
        rawSignals: [],
        budget: {
          maxSignals: 10,
          maxClusters: 10,
          maxCandidates: 10,
          maxModelTokens: 1000,
          maxCostCents: 100,
          maxRuntimeMs: 1000,
          noProgressLimit: 2,
          maxRetrievals: 1,
          maxEvalCases: 4,
        },
      } as never,
      retrieval: {
        query: {
          organizationId: 'org-a',
          contextFingerprint: 'fp-current',
          goal: 'improve conversion',
          metricName: 'conversion',
          now: '2026-09-13T00:00:00.000Z',
        },
        records: [
          prior,
          { ...prior, id: 'exp-2', strategy: 'prompt-v3' },
          { ...prior, id: 'exp-other', organizationId: 'org-b' },
        ],
        limit: 99,
      },
      evaluation: {
        candidateRef: 'candidate:new',
        ports: evaluationPorts(),
        transferredEvidence: [
          { suite: 'safety', state: 'PASS', evidenceRef: 'safety:old', reason: null },
        ],
      },
    });

    expect(result.flywheel.createdProposals).toBe(1);
    expect(result.retrievedEvidence).toHaveLength(1);
    expect(result.retrievedEvidence[0]?.mustRetest).toBe(true);
    expect(result.transferredEvidence[0]?.state).toBe('NOT_PROVEN');
    expect(result.validation?.passed).toBe(true);
    expect(result.readyForApproval).toBe(true);
    expect(result.requiresApproval).toBe(true);
    expect(result.activatedChanges).toBe(0);
  });

  it('uses safe outer-loop defaults for old callers that omit new budgets', async () => {
    const runIteration = vi.fn().mockResolvedValue({
      processedSignals: 0,
      clusters: 0,
      createdProposals: 0,
      enrichedProposals: 0,
      modelTokensUsed: 0,
      costCentsUsed: 0,
      stoppedReason: 'completed',
    });
    const service = createHermesLearningService({ runIteration: runIteration as never });
    const result = await service.runUnifiedCycle({
      flywheel: {
        rawSignals: [],
        budget: {
          maxSignals: 1,
          maxClusters: 1,
          maxCandidates: 1,
          maxModelTokens: 0,
          maxCostCents: 0,
          maxRuntimeMs: 1,
          noProgressLimit: 1,
        },
      } as never,
    });
    expect(result.activatedChanges).toBe(0);
  });
});
