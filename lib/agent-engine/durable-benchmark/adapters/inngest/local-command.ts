import { DURABLE_BENCHMARK_PROFILES, type DurableBenchmarkProfile } from '../../runner';
import {
  runPhase7InngestBatch,
  type InngestBatchDispatchInput,
  type InngestBatchDispatchResult,
  type InngestBatchReport,
} from './batch-runner';

export async function runPhase7InngestLocalCommand(input: {
  profile: DurableBenchmarkProfile;
  dispatch: (run: InngestBatchDispatchInput) => Promise<InngestBatchDispatchResult>;
  timestamp?: () => number;
}): Promise<InngestBatchReport> {
  if (!(input.profile in DURABLE_BENCHMARK_PROFILES)) {
    throw new Error(`unsupported_phase7_inngest_profile:${String(input.profile)}`);
  }

  return runPhase7InngestBatch({
    profile: input.profile,
    dispatch: input.dispatch,
    timestamp: input.timestamp,
  });
}
