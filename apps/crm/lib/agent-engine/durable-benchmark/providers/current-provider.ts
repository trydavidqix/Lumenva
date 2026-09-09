import { createCurrentDurableBenchmarkAdapter } from '../adapters/current';
import type { DurableBenchmarkAdapter, DurableBenchmarkEngineId, DurableBenchmarkRunResult } from '../contracts';
import { createInMemoryBenchmarkEffectStore } from '../effect-store';
import {
  buildPhase7ProviderReport,
  type Phase7ProviderReport,
  type Phase7ScoreDimensions,
} from '../provider-report';
import { createDurableBenchmarkRunner, type DurableBenchmarkProfile } from '../runner';

const PROFILES: readonly DurableBenchmarkProfile[] = ['small', 'medium', 'stress'];

export async function runCurrentPhase7Provider(input: {
  scoreDimensions?: Phase7ScoreDimensions;
} = {}): Promise<Phase7ProviderReport> {
  const adapter = createCurrentDurableBenchmarkAdapter({ effectStore: createInMemoryBenchmarkEffectStore() });
  const adapters = new Map<DurableBenchmarkEngineId, DurableBenchmarkAdapter>([['current', adapter]]);
  const runner = createDurableBenchmarkRunner({ adapters });
  const runs: DurableBenchmarkRunResult[] = [];
  const suiteCounts = { small: 0, medium: 0, stress: 0 };

  for (const profile of PROFILES) {
    const suite = await runner.runSuite({ engineId: 'current', profile, repetitions: 1 });
    suiteCounts[profile] = suite.results.length;
    runs.push(...suite.results);
  }

  return buildPhase7ProviderReport({
    engineId: 'current',
    runs,
    suiteCounts,
    realEvidence: true,
    ...(input.scoreDimensions ? { scoreDimensions: input.scoreDimensions } : {}),
  });
}
