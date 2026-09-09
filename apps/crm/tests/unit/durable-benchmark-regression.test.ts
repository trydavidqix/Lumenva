import { describe, expect, it } from 'vitest';

import {
  buildPhase7BenchmarkEvidence,
  serializePhase7BenchmarkEvidence,
} from '@/lib/agent-engine/durable-benchmark/evidence';
import { scoreDurableBenchmark } from '@/lib/agent-engine/durable-benchmark/scoring';

const passingGates = { passed: true, failures: [] as const };

function engine(engineId: 'current' | 'inngest' | 'vercel_workflow', realEvidence: boolean) {
  return {
    engineId,
    hardGates: passingGates,
    score: scoreDurableBenchmark(engineId, {
      reliability: 80,
      durability: 80,
      observability: 80,
      operationalSimplicity: 80,
      performance: 80,
      cost: 80,
      maintainability: 80,
    }),
    suiteCounts: { small: 24, medium: 200, stress: 480 },
    realEvidence,
  };
}

describe('Phase 7 benchmark evidence', () => {
  it('is deterministic except for caller-supplied timestamp and code SHA', () => {
    const input = {
      generatedAt: '2026-08-18T12:00:00.000Z',
      codeSha: '***REMOVED******REMOVED***01234567',
      prerequisiteSatisfied: true,
      engines: [engine('current', true), engine('inngest', true), engine('vercel_workflow', true)],
    } as const;

    expect(serializePhase7BenchmarkEvidence(buildPhase7BenchmarkEvidence(input))).toBe(
      serializePhase7BenchmarkEvidence(buildPhase7BenchmarkEvidence(input)),
    );
  });

  it('returns INCOMPLETE when the real SHADOW/ASSISTED prerequisite is absent', () => {
    const evidence = buildPhase7BenchmarkEvidence({
      generatedAt: '2026-08-18T12:00:00.000Z',
      codeSha: '***REMOVED******REMOVED***01234567',
      prerequisiteSatisfied: false,
      engines: [engine('current', true), engine('inngest', true), engine('vercel_workflow', true)],
    });

    expect(evidence.decision).toBe('INCOMPLETE');
  });

  it('rejects secret-looking values and customer PII before serialization', () => {
    const evidence = buildPhase7BenchmarkEvidence({
      generatedAt: '2026-08-18T12:00:00.000Z',
      codeSha: '***REMOVED******REMOVED***01234567',
      prerequisiteSatisfied: true,
      engines: [engine('current', true), engine('inngest', true), engine('vercel_workflow', true)],
      reasons: ['token=sk-test-secret'],
    });

    expect(() => serializePhase7BenchmarkEvidence(evidence)).toThrow(/unsafe_benchmark_evidence/);
  });

  it('rejects non-synthetic organization identifiers embedded in evidence', () => {
    const evidence = buildPhase7BenchmarkEvidence({
      generatedAt: '2026-08-18T12:00:00.000Z',
      codeSha: '***REMOVED******REMOVED***01234567',
      prerequisiteSatisfied: true,
      engines: [engine('current', true), engine('inngest', true), engine('vercel_workflow', true)],
      reasons: ['organization_id=customer-org-123'],
    });

    expect(() => serializePhase7BenchmarkEvidence(evidence)).toThrow(/unsafe_benchmark_evidence/);
  });
});
