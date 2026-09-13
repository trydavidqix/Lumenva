import type { Phase6IterationResult, RunLearningFlywheelInput } from '../flywheel/orchestrator';
import type { HermesOutcomeRecord } from './outcome-ledger';
import type { HermesRetrievalQuery, HermesRetrievedEvidence } from './retrieval';
import type { HermesRoutingOutcome } from './routing-metrics';
import type { ResearchExperimentRecord } from './research-memory';
import type { HermesMetaResearchReport } from './meta-research';

export type HermesLearningRunInput = RunLearningFlywheelInput;
export type HermesLearningRunResult = Phase6IterationResult;

export interface HermesUnifiedCycleInput {
  flywheel: RunLearningFlywheelInput;
  retrieval?: {
    query: HermesRetrievalQuery;
    records: ResearchExperimentRecord[];
    limit?: number;
  };
  outcomes?: HermesOutcomeRecord[];
  routingOutcomes?: HermesRoutingOutcome[];
}

export interface HermesUnifiedCycleResult {
  flywheel: Phase6IterationResult;
  retrievedEvidence: HermesRetrievedEvidence[];
  metaResearch: HermesMetaResearchReport;
  requiresApproval: true;
  activatedChanges: 0;
}
