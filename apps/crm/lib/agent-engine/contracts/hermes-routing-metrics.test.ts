import { describe, expect, it } from 'vitest';

import { aggregateRoutingMetrics, type HermesRoutingOutcome } from '../hermes/routing-metrics';

const outcome = (overrides: Partial<HermesRoutingOutcome> = {}): HermesRoutingOutcome => ({
  domain: 'software',
  complexity: 'STANDARD',
  risk: 'LOW',
  expectedExecution: 'SKILL',
  actualExecution: 'SKILL',
  workerCount: 1,
  minimumSufficientWorkers: 1,
  contextTokens: 1000,
  reviewerUsed: true,
  reviewerFoundDefect: false,
  finalSuccess: true,
  claimedPass: true,
  evidenceProvedPass: true,
  ...overrides,
});

describe('Hermes Adaptive Expert routing metrics', () => {
  it('measures route efficiency, reviewer value and false PASS events', () => {
    const metrics = aggregateRoutingMetrics([
      outcome(),
      outcome({ actualExecution: 'TEAM', workerCount: 4, reviewerFoundDefect: true, finalSuccess: false, claimedPass: true, evidenceProvedPass: false, contextTokens: 3000 }),
    ]);

    expect(metrics.routeAccuracy).toBe(0.5);
    expect(metrics.averageExtraWorkers).toBe(1.5);
    expect(metrics.averageContextTokens).toBe(2000);
    expect(metrics.reviewerValueRate).toBe(0.5);
    expect(metrics.falsePassCount).toBe(1);
    expect(metrics.successRate).toBe(0.5);
  });
});
