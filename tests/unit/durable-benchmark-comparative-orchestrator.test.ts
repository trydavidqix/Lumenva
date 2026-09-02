import { describe, expect, it, vi } from 'vitest';

import { runPhase7ComparativeBenchmarkOrchestrator } from '@/lib/agent-engine/durable-benchmark/comparative-orchestrator';
import { blockedPhase7ProviderReport, type Phase7ProviderReport } from '@/lib/agent-engine/durable-benchmark/provider-report';

function passReport(engineId: 'current' | 'inngest' | 'vercel_workflow'): Phase7ProviderReport {
  return {
    engineId,
    engineVersion: 'test',
    status: 'PASS',
    realEvidence: true,
    suiteCounts: { small: 8, medium: 40, stress: 160 },
    runs: [],
    hardGates: { passed: true, failures: [] },
    score: {
      engineId,
      reliability: 100,
      durability: 100,
      observability: 100,
      operationalSimplicity: 50,
      performance: 50,
      cost: 50,
      maintainability: 50,
      weightedTotal: 82.5,
    },
  };
}

describe('Phase 7 comparative orchestrator', () => {
  it('runs providers in canonical order and delegates the final decision to evidence logic', async () => {
    const order: string[] = [];
    const current = vi.fn(async () => { order.push('current'); return passReport('current'); });
    const inngest = vi.fn(async () => { order.push('inngest'); return passReport('inngest'); });
    const vercel = vi.fn(async () => { order.push('vercel_workflow'); return passReport('vercel_workflow'); });

    const result = await runPhase7ComparativeBenchmarkOrchestrator({
      current,
      inngest,
      vercelWorkflow: vercel,
      generatedAt: '2026-08-18T20:00:00.000Z',
      codeSha: 'a'.repeat(40),
      prerequisiteSatisfied: true,
    });

    expect(order).toEqual(['current', 'inngest', 'vercel_workflow']);
    expect(result.evidence.engines).toHaveLength(3);
    expect(result.evidence.decision).toBe('KEEP_CURRENT');
  });

  it('isolates a provider exception and keeps the final decision INCOMPLETE', async () => {
    const result = await runPhase7ComparativeBenchmarkOrchestrator({
      current: async () => passReport('current'),
      inngest: async () => { throw new Error('inngest_unreachable'); },
      vercelWorkflow: async () => blockedPhase7ProviderReport({ engineId: 'vercel_workflow', reason: 'runtime_unavailable' }),
      generatedAt: '2026-08-18T20:00:00.000Z',
      codeSha: 'b'.repeat(40),
      prerequisiteSatisfied: true,
    });

    expect(result.providers.find((provider) => provider.engineId === 'inngest')?.status).toBe('BLOCKED');
    expect(result.evidence.decision).toBe('INCOMPLETE');
  });
});
