import { describe, expect, it } from 'vitest';

import { decideDurableBenchmark, scoreDurableBenchmark } from '@/lib/agent-engine/durable-benchmark/scoring';

const dimensions = {
  reliability: 100,
  durability: 100,
  observability: 100,
  operationalSimplicity: 100,
  performance: 100,
  cost: 100,
  maintainability: 100,
};

describe('durable benchmark scoring', () => {
  it('uses the fixed weighted formula', () => {
    expect(scoreDurableBenchmark('current', { ...dimensions, reliability: 50 }).weightedTotal).toBe(80);
  });

  it('keeps current on ties or an external advantage below ten points', () => {
    const current = scoreDurableBenchmark('current', { ...dimensions, reliability: 80 });
    const inngest = scoreDurableBenchmark('inngest', { ...dimensions, reliability: 90 });
    expect(decideDurableBenchmark({ scores: [current, inngest], hardGatePass: { current: true, inngest: true, vercel_workflow: false }, realEvidence: { current: true, inngest: true, vercel_workflow: false } })).toBe('KEEP_CURRENT');
  });

  it('returns incomplete when a compared external engine lacks real-provider evidence', () => {
    const current = scoreDurableBenchmark('current', dimensions);
    const inngest = scoreDurableBenchmark('inngest', dimensions);
    expect(decideDurableBenchmark({ scores: [current, inngest], hardGatePass: { current: true, inngest: true, vercel_workflow: false }, realEvidence: { current: true, inngest: false, vercel_workflow: false } })).toBe('INCOMPLETE');
  });

  it('adopts an external engine only with complete evidence, passing gates and >=10 point advantage', () => {
    const current = scoreDurableBenchmark('current', { ...dimensions, reliability: 50 });
    const inngest = scoreDurableBenchmark('inngest', dimensions);
    expect(decideDurableBenchmark({ scores: [current, inngest], hardGatePass: { current: true, inngest: true, vercel_workflow: false }, realEvidence: { current: true, inngest: true, vercel_workflow: false } })).toBe('ADOPT_INNGEST');
  });
});
