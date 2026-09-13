import type { SupabaseClient } from '@supabase/supabase-js';

import type { FlywheelPhase6Adapter } from '../flywheel/live';
import type { LearningSignal } from '../flywheel/signals';
import { createSupabaseLearningProposalStore } from '../flywheel/store';
import type { LearningScope } from '../flywheel/contracts';
import { createHermesLearningService } from './service';

export interface HermesScheduledAdapterDeps {
  client: SupabaseClient;
  resolveScope(input: { organizationId: string; jobId: string }): Promise<LearningScope | null>;
  persistSignal?(signal: LearningSignal): Promise<void>;
}

/**
 * Bridges the existing Flywheel scheduler into the unified Hermes facade.
 * It deliberately reuses the current Flywheel boundary instead of creating a
 * second scheduler. The adapter only emits bounded learning input; it never
 * activates a candidate or mutates business authority.
 */
export function createHermesFlywheelAdapter(deps: HermesScheduledAdapterDeps): FlywheelPhase6Adapter {
  const proposals = createSupabaseLearningProposalStore(deps.client);
  const hermes = createHermesLearningService();

  return {
    resolveScope: deps.resolveScope,
    async emitSignal(signal) {
      await deps.persistSignal?.(signal);
      await hermes.runIteration({
        rawSignals: [signal],
        proposalStore: proposals,
      } as never);
    },
  };
}
