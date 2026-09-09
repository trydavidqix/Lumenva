import { describe, expect, it } from 'vitest';

import { runCurrentPhase7Provider } from '@/lib/agent-engine/durable-benchmark/providers/current-provider';

const dimensions = {
  reliability: 100,
  durability: 100,
  observability: 100,
  operationalSimplicity: 50,
  performance: 50,
  cost: 50,
  maintainability: 50,
};

describe('Phase 7 current-engine provider', () => {
  it('runs the canonical 208-run matrix through the current Deskcomm adapter', async () => {
    const report = await runCurrentPhase7Provider({ scoreDimensions: dimensions });

    expect(report.engineId).toBe('current');
    expect(report.suiteCounts).toEqual({ small: 8, medium: 40, stress: 160 });
    expect(report.runs).toHaveLength(208);
    expect(report.runs.every((run) => run.organizationId.startsWith('bench-org-'))).toBe(true);
    expect(report.realEvidence).toBe(true);
  });
});
