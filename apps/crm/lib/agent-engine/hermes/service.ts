import type { Phase6IterationResult, RunLearningFlywheelInput } from '../flywheel/orchestrator';
import { resolveHermesLoopBudget, runLearningFlywheelIteration } from '../flywheel/orchestrator';
import {
  transferredEvidenceRequiresRetest,
  validateCandidateWithEvidence,
} from '../flywheel/validator';
import { buildMetaResearchReport } from './meta-research';
import { rankPriorEvidence } from './retrieval';
import type { HermesUnifiedCycleInput, HermesUnifiedCycleResult } from './contracts';

export interface HermesLearningService {
  runIteration(input: RunLearningFlywheelInput): Promise<Phase6IterationResult>;
  runCycle(input: HermesUnifiedCycleInput): Promise<HermesUnifiedCycleResult>;
  /** Backward-compatible alias retained for the first Hermes branch commits. */
  runUnifiedCycle(input: HermesUnifiedCycleInput): Promise<HermesUnifiedCycleResult>;
}

export function createHermesLearningService(
  deps: { runIteration?: typeof runLearningFlywheelIteration } = {},
): HermesLearningService {
  const runIteration = deps.runIteration ?? runLearningFlywheelIteration;

  const runCycle = async (input: HermesUnifiedCycleInput): Promise<HermesUnifiedCycleResult> => {
    const budget = resolveHermesLoopBudget(input.flywheel.budget);
    const flywheel = await runIteration(input.flywheel);

    const requestedRetrievalLimit = Math.max(0, input.retrieval?.limit ?? budget.maxRetrievals);
    const retrievalLimit = Math.min(requestedRetrievalLimit, budget.maxRetrievals);
    const retrievedEvidence = input.retrieval
      ? rankPriorEvidence(input.retrieval.query, input.retrieval.records, retrievalLimit)
      : [];

    const transferredEvidence = (input.evaluation?.transferredEvidence ?? []).map(
      transferredEvidenceRequiresRetest,
    );

    const requestedSuites = input.evaluation?.requiredSuites ?? [
      'regression',
      'golden',
      'safety',
      'shadow',
    ];
    const suitesWithinBudget = requestedSuites.slice(0, budget.maxEvalCases);
    const validation = input.evaluation
      ? await validateCandidateWithEvidence(
          input.evaluation.candidateRef,
          input.evaluation.ports,
          suitesWithinBudget,
        )
      : null;

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
      transferredEvidence,
      validation,
      metaResearch,
      readyForApproval: validation?.passed === true,
      requiresApproval: true,
      activatedChanges: 0,
    };
  };

  return {
    runIteration,
    runCycle,
    runUnifiedCycle: runCycle,
  };
}
