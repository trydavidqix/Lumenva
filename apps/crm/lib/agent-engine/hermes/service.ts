import type { Phase6IterationResult, RunLearningFlywheelInput } from '../flywheel/orchestrator';
import { runLearningFlywheelIteration } from '../flywheel/orchestrator';
import { buildMetaResearchReport } from './meta-research';
import { rankPriorEvidence } from './retrieval';
import type { HermesUnifiedCycleInput, HermesUnifiedCycleResult } from './contracts';

export interface HermesLearningService {
  runIteration(input: RunLearningFlywheelInput): Promise<Phase6IterationResult>;
  runUnifiedCycle(input: HermesUnifiedCycleInput): Promise<HermesUnifiedCycleResult>;
}

export function createHermesLearningService(
  deps: { runIteration?: typeof runLearningFlywheelIteration } = {},
): HermesLearningService {
  const runIteration = deps.runIteration ?? runLearningFlywheelIteration;
  return {
    runIteration,
    async runUnifiedCycle(input) {
      const flywheel = await runIteration(input.flywheel);
      const retrievedEvidence = input.retrieval
        ? rankPriorEvidence(input.retrieval.query, input.retrieval.records, input.retrieval.limit)
        : [];
      const experiments = input.retrieval?.records.filter(
        (record) => record.organizationId === input.retrieval?.query.organizationId,
      ) ?? [];
      const metaResearch = buildMetaResearchReport({
        experiments,
        outcomes: input.outcomes ?? [],
        routingOutcomes: input.routingOutcomes ?? [],
      });

      return {
        flywheel,
        retrievedEvidence,
        metaResearch,
        requiresApproval: true,
        activatedChanges: 0,
      };
    },
  };
}
