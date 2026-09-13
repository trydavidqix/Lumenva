import { describe, expect, it } from 'vitest';

import { businessKpiCanBypassSafety, summarizeOutcomeDelta } from '../hermes/outcome-ledger';

describe('Hermes outcome ledger', () => {
  it('connects technical, cost, latency and business KPI deltas', () => {
    expect(
      summarizeOutcomeDelta(
        { technicalQuality: 0.8, costCents: 100, latencyMs: 500, kpiValue: 0.2 },
        { technicalQuality: 0.9, costCents: 80, latencyMs: 450, kpiValue: 0.25 },
      ),
    ).toEqual({
      qualityDelta: 0.09999999999999998,
      costDeltaCents: -20,
      latencyDeltaMs: -50,
      kpiDelta: 0.04999999999999999,
    });
  });

  it('never allows a KPI gain to bypass safety gates', () => {
    expect(businessKpiCanBypassSafety()).toBe(false);
  });
});
