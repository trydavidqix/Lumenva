import type { DurableBenchmarkAdapter, DurableBenchmarkRunInput, DurableBenchmarkRunResult } from '../../contracts';
import { validateDurableBenchmarkRunResult } from '../../contracts';
import type { BenchmarkEffectStore } from '../../effect-store';
import type { VercelWorkflowBenchmarkInvocationPort } from './workflow';

export function createVercelWorkflowDurableBenchmarkAdapter(dependencies: {
  effectStore: BenchmarkEffectStore;
  invoke: VercelWorkflowBenchmarkInvocationPort;
}): DurableBenchmarkAdapter {
  return {
    engineId: 'vercel_workflow',
    async run(input: DurableBenchmarkRunInput): Promise<DurableBenchmarkRunResult> {
      if (!input.organizationId.startsWith('bench-org-')) {
        throw new Error('vercel_workflow_benchmark_requires_synthetic_organization');
      }

      const provider = await dependencies.invoke({ run: input, effectStore: dependencies.effectStore });
      const result: DurableBenchmarkRunResult = {
        engineId: 'vercel_workflow',
        scenarioId: input.scenarioId,
        scenarioVersion: input.scenarioVersion,
        organizationId: input.organizationId,
        runId: input.runId,
        ...provider,
      };

      if (!validateDurableBenchmarkRunResult(result)) {
        throw new Error('invalid_vercel_workflow_benchmark_result');
      }

      return result;
    },
  };
}
