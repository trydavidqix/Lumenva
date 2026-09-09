import { createVercelWorkflowDurableBenchmarkAdapter } from '../adapters/vercel-workflow/adapter';
import type { VercelWorkflowBenchmarkInvocationPort } from '../adapters/vercel-workflow/workflow';
import type { DurableBenchmarkAdapter, DurableBenchmarkEngineId, DurableBenchmarkRunResult } from '../contracts';
import { createInMemoryBenchmarkEffectStore } from '../effect-store';
import {
  blockedPhase7ProviderReport,
  buildPhase7ProviderReport,
  type Phase7ProviderReport,
  type Phase7ScoreDimensions,
} from '../provider-report';
import { createDurableBenchmarkRunner, type DurableBenchmarkProfile } from '../runner';

const PROFILES: readonly DurableBenchmarkProfile[] = ['small', 'medium', 'stress'];

export async function runVercelWorkflowPhase7Provider(input: {
  invoke?: VercelWorkflowBenchmarkInvocationPort;
  realRuntime?: boolean;
  scoreDimensions?: Phase7ScoreDimensions;
}): Promise<Phase7ProviderReport> {
  if (!input.invoke || input.realRuntime !== true) {
    return blockedPhase7ProviderReport({
      engineId: 'vercel_workflow',
      reason: 'real_vercel_workflow_runtime_unavailable',
    });
  }

  try {
    const adapter = createVercelWorkflowDurableBenchmarkAdapter({
      effectStore: createInMemoryBenchmarkEffectStore(),
      invoke: input.invoke,
    });
    const adapters = new Map<DurableBenchmarkEngineId, DurableBenchmarkAdapter>([['vercel_workflow', adapter]]);
    const runner = createDurableBenchmarkRunner({ adapters });
    const runs: DurableBenchmarkRunResult[] = [];
    const suiteCounts = { small: 0, medium: 0, stress: 0 };

    for (const profile of PROFILES) {
      const suite = await runner.runSuite({ engineId: 'vercel_workflow', profile, repetitions: 1 });
      suiteCounts[profile] = suite.results.length;
      runs.push(...suite.results);
    }

    return buildPhase7ProviderReport({
      engineId: 'vercel_workflow',
      runs,
      suiteCounts,
      realEvidence: true,
      ...(input.scoreDimensions ? { scoreDimensions: input.scoreDimensions } : {}),
    });
  } catch (error) {
    return blockedPhase7ProviderReport({
      engineId: 'vercel_workflow',
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
