import type { DurableBenchmarkRunResult } from '../../contracts';
import { validateDurableBenchmarkRunResult } from '../../contracts';
import { DURABLE_BENCHMARK_PROFILES, type DurableBenchmarkProfile } from '../../runner';
import { getPhase7Scenarios } from '../../scenarios';

export interface InngestBatchDispatchInput {
  runId: string;
  scenarioId: string;
  scenarioVersion: string;
  organizationId: string;
  profile: DurableBenchmarkProfile;
  attempt: number;
}

export type InngestBatchDispatchResult = Omit<
  DurableBenchmarkRunResult,
  'engineId' | 'scenarioId' | 'scenarioVersion' | 'organizationId' | 'runId'
>;

export interface InngestBatchReport {
  engineId: 'inngest';
  profile: DurableBenchmarkProfile;
  generatedAtMs: number;
  runs: readonly DurableBenchmarkRunResult[];
}

export async function runPhase7InngestBatch(input: {
  profile: DurableBenchmarkProfile;
  dispatch: (run: InngestBatchDispatchInput) => Promise<InngestBatchDispatchResult>;
  timestamp?: () => number;
}): Promise<InngestBatchReport> {
  const concurrency = DURABLE_BENCHMARK_PROFILES[input.profile];
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error(`unsupported_phase7_inngest_profile:${String(input.profile)}`);
  }

  const generatedAtMs = (input.timestamp ?? Date.now)();
  const results: DurableBenchmarkRunResult[] = [];

  for (const scenario of getPhase7Scenarios()) {
    const batch = Array.from({ length: concurrency }, (_, index) => ({
      runId: `inngest:${input.profile}:${generatedAtMs}:${scenario.id}:${index + 1}`,
      scenarioId: scenario.id,
      scenarioVersion: scenario.version,
      organizationId: scenario.organizationId,
      profile: input.profile,
      attempt: 1,
    } satisfies InngestBatchDispatchInput));

    const completed = await Promise.all(
      batch.map(async (run) => {
        const provider = await input.dispatch(run);
        const result: DurableBenchmarkRunResult = {
          engineId: 'inngest',
          scenarioId: scenario.id,
          scenarioVersion: scenario.version,
          organizationId: scenario.organizationId,
          runId: run.runId,
          ...provider,
        };

        if (!validateDurableBenchmarkRunResult(result)) {
          throw new Error(`invalid_phase7_inngest_run_result:${run.runId}`);
        }
        return result;
      }),
    );

    results.push(...completed);
  }

  return {
    engineId: 'inngest',
    profile: input.profile,
    generatedAtMs,
    runs: results,
  };
}
