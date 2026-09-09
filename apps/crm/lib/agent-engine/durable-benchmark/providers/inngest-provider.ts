import { runPhase7InngestLocalCommand } from '../adapters/inngest/local-command';
import type {
  InngestBatchDispatchInput,
  InngestBatchDispatchResult,
} from '../adapters/inngest/batch-runner';
import {
  blockedPhase7ProviderReport,
  buildPhase7ProviderReport,
  type Phase7ProviderReport,
  type Phase7ScoreDimensions,
} from '../provider-report';
import type { DurableBenchmarkProfile } from '../runner';

const PROFILES: readonly DurableBenchmarkProfile[] = ['small', 'medium', 'stress'];

export async function runInngestPhase7Provider(input: {
  dispatch?: (run: InngestBatchDispatchInput) => Promise<InngestBatchDispatchResult>;
  blocker?: string;
  scoreDimensions?: Phase7ScoreDimensions;
}): Promise<Phase7ProviderReport> {
  if (input.blocker || !input.dispatch) {
    return blockedPhase7ProviderReport({
      engineId: 'inngest',
      reason: input.blocker ?? 'real_inngest_dispatcher_unavailable',
    });
  }

  try {
    const runs = [];
    const suiteCounts = { small: 0, medium: 0, stress: 0 };

    for (const profile of PROFILES) {
      const report = await runPhase7InngestLocalCommand({ profile, dispatch: input.dispatch });
      suiteCounts[profile] = report.runs.length;
      runs.push(...report.runs);
    }

    return buildPhase7ProviderReport({
      engineId: 'inngest',
      runs,
      suiteCounts,
      realEvidence: true,
      ...(input.scoreDimensions ? { scoreDimensions: input.scoreDimensions } : {}),
    });
  } catch (error) {
    return blockedPhase7ProviderReport({
      engineId: 'inngest',
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
