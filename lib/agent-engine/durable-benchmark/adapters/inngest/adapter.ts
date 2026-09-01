import type { DurableBenchmarkAdapter, DurableBenchmarkRunInput, DurableBenchmarkRunResult } from '../../contracts';
import { validateDurableBenchmarkRunResult } from '../../contracts';
import type { BenchmarkEffectStore } from '../../effect-store';
import type { InngestBenchmarkInvocationPort } from './functions';

export function createInngestDurableBenchmarkAdapter(dependencies: {
  effectStore: BenchmarkEffectStore;
  invoke: InngestBenchmarkInvocationPort;
}): DurableBenchmarkAdapter {
  return {
    engineId: 'inngest',
    async run(input: DurableBenchmarkRunInput): Promise<DurableBenchmarkRunResult> {
      if (!input.organizationId.startsWith('bench-org-')) {
        throw new Error('inngest_benchmark_requires_synthetic_organization');
      }

      const provider = await dependencies.invoke({ run: input, effectStore: dependencies.effectStore });
      const result: DurableBenchmarkRunResult = {
        engineId: 'inngest',
        scenarioId: input.scenarioId,
        scenarioVersion: input.scenarioVersion,
        organizationId: input.organizationId,
        runId: input.runId,
        ...provider,
      };

      if (!validateDurableBenchmarkRunResult(result)) {
        throw new Error('invalid_inngest_benchmark_result');
      }

      return result;
    },
  };
}
