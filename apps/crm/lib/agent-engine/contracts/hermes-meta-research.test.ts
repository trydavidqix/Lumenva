import { describe, expect, it } from 'vitest';

import { buildMetaResearchReport } from '../hermes/meta-research';
import type { HermesOutcomeRecord } from '../hermes/outcome-ledger';
import type { HermesRoutingOutcome } from '../hermes/routing-metrics';
import type { ResearchExperimentRecord } from '../hermes/research-memory';

const experiment = (id: string, strategy: string, status: ResearchExperimentRecord['status'], score: number): ResearchExperimentRecord => ({
  id,
  organizationId: 'org-a',
  subjectKind: 'agent',
  subjectId: 'sales',
  contextFingerprint: 'fp',
  goal: 'improve sales',
  strategy,
  metricName: 'conversion',
  baselineValue: 0.2,
  observedValue: 0.25,
  score,
  status,
  evidenceRefs: [`run:${id}`],
  metadata: status === 'crash' ? { failureSignature: 'tool_loop' } : {},
  sourceVersion: 'v1',
  supersedesId: null,
  createdAt: '2026-09-13T00:00:00.000Z',
});

const outcome: HermesOutcomeRecord = {
  id: 'out-1',
  organizationId: 'org-a',
  runId: 'run-1',
  missionId: null,
  candidateId: null,
  subjectKind: 'agent',
  subjectId: 'sales',
  technicalQuality: 0.9,
  costCents: 50,
  latencyMs: 400,
  kpiName: 'conversion',
  kpiBaseline: 0.2,
  kpiObserved: 0.25,
  evidenceRefs: ['run:1'],
  observedAt: '2026-09-13T00:00:00.000Z',
};

const routing: HermesRoutingOutcome = {
  domain: 'business',
  complexity: 'STANDARD',
  risk: 'LOW',
  expectedExecution: 'SKILL',
  actualExecution: 'TEAM',
  workerCount: 3,
  minimumSufficientWorkers: 1,
  contextTokens: 2000,
  reviewerUsed: true,
  reviewerFoundDefect: true,
  finalSuccess: true,
  claimedPass: true,
  evidenceProvedPass: false,
};

describe('Hermes meta research', () => {
  it('ranks strategies and emits evidence-only recommendations', () => {
    const report = buildMetaResearchReport({
      experiments: [experiment('1', 'prompt-a', 'keep', 0.9), experiment('2', 'prompt-b', 'crash', 0.2)],
      outcomes: [outcome],
      routingOutcomes: [routing],
    });

    expect(report.strategyRanking[0]?.strategy).toBe('prompt-a');
    expect(report.recurringFailures).toEqual([{ signature: 'tool_loop', count: 1 }]);
    expect(report.recommendations).toContain('tighten_evidence_gate');
    expect(report.recommendations).toContain('reduce_execution_shape');
    expect(report.meanKpiDelta).toBeCloseTo(0.05);
  });
});
