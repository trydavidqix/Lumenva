import type {
  DurableBenchmarkAdapter,
  DurableBenchmarkEngineId,
  DurableBenchmarkRunResult,
} from './contracts';
import { getPhase7Scenarios } from './scenarios';

export type DurableBenchmarkProfile = 'small' | 'medium' | 'stress';

export const DURABLE_BENCHMARK_PROFILES: Readonly<Record<DurableBenchmarkProfile, number>> = {
  small: 1,
  medium: 5,
  stress: 20,
};

export interface DurableBenchmarkSuiteResult {
  engineId: DurableBenchmarkEngineId;
  profile: DurableBenchmarkProfile;
  repetitions: number;
  results: readonly DurableBenchmarkRunResult[];
}

export function createDurableBenchmarkRunner(input: {
  adapters: ReadonlyMap<DurableBenchmarkEngineId, DurableBenchmarkAdapter>;
}) {
  return {
    async runSuite(request: {
      engineId: DurableBenchmarkEngineId;
      profile: DurableBenchmarkProfile;
      repetitions: number;
    }): Promise<DurableBenchmarkSuiteResult> {
      if (!Number.isInteger(request.repetitions) || request.repetitions < 1) {
        throw new Error('benchmark_repetitions_must_be_positive_integer');
      }

      const adapter = input.adapters.get(request.engineId);
      if (!adapter) throw new Error(`benchmark_adapter_missing:${request.engineId}`);

      const concurrency = DURABLE_BENCHMARK_PROFILES[request.profile];
      const results: DurableBenchmarkRunResult[] = [];

      for (let repetition = 1; repetition <= request.repetitions; repetition += 1) {
        for (const scenario of getPhase7Scenarios()) {
          const batch = Array.from({ length: concurrency }, (_, index) => ({
            scenarioId: scenario.id,
            scenarioVersion: scenario.version,
            organizationId: scenario.organizationId,
            runId: `${request.engineId}:${request.profile}:${repetition}:${scenario.id}:${index + 1}`,
          }));

          const settled = await Promise.allSettled(batch.map((run) => adapter.run(run)));
          for (const [index, outcome] of settled.entries()) {
            if (outcome.status === 'fulfilled') {
              results.push(outcome.value);
              continue;
            }

            const run = batch[index];
            if (!run) continue;
            results.push({
              ...run,
              engineId: request.engineId,
              terminalState: 'failed',
              lifecycle: [{
                seq: 1,
                kind: 'adapter_error',
                atMs: 0,
                evidence: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
              }],
              retryCount: 0,
              approvalRequired: scenario.requiresApproval,
              approvalSatisfied: false,
              resumedFromExpectedStep: false,
              effectAttempts: 0,
              committedEffects: 0,
              recoveredAfterCrash: false,
              crossTenantViolation: false,
              durationMs: 0,
            });
          }
        }
      }

      return {
        engineId: request.engineId,
        profile: request.profile,
        repetitions: request.repetitions,
        results,
      };
    },
  };
}
