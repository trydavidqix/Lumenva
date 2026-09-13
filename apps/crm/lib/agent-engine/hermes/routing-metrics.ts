export type HermesTaskDomain =
  | 'software'
  | 'security'
  | 'database'
  | 'infrastructure'
  | 'AI'
  | 'research'
  | 'product'
  | 'data'
  | 'business'
  | 'general';

export type HermesTaskComplexity = 'QUICK' | 'STANDARD' | 'DEEP' | 'CRITICAL';
export type HermesTaskRisk = 'LOW' | 'MEDIUM' | 'HIGH';
export type HermesExecutionShape = 'MAIN' | 'SKILL' | 'SUBAGENT' | 'TEAM' | 'WORKFLOW';

export interface HermesRoutingOutcome {
  domain: HermesTaskDomain;
  complexity: HermesTaskComplexity;
  risk: HermesTaskRisk;
  expectedExecution: HermesExecutionShape;
  actualExecution: HermesExecutionShape;
  workerCount: number;
  minimumSufficientWorkers: number;
  contextTokens: number;
  reviewerUsed: boolean;
  reviewerFoundDefect: boolean;
  finalSuccess: boolean;
  claimedPass: boolean;
  evidenceProvedPass: boolean;
}

export interface HermesRoutingMetrics {
  total: number;
  routeAccuracy: number;
  averageExtraWorkers: number;
  averageContextTokens: number;
  reviewerValueRate: number;
  falsePassCount: number;
  successRate: number;
}

export function aggregateRoutingMetrics(outcomes: HermesRoutingOutcome[]): HermesRoutingMetrics {
  if (outcomes.length === 0) {
    return {
      total: 0,
      routeAccuracy: 0,
      averageExtraWorkers: 0,
      averageContextTokens: 0,
      reviewerValueRate: 0,
      falsePassCount: 0,
      successRate: 0,
    };
  }

  const routedCorrectly = outcomes.filter((item) => item.actualExecution === item.expectedExecution).length;
  const extraWorkers = outcomes.reduce(
    (sum, item) => sum + Math.max(0, item.workerCount - item.minimumSufficientWorkers),
    0,
  );
  const contextTokens = outcomes.reduce((sum, item) => sum + Math.max(0, item.contextTokens), 0);
  const reviewed = outcomes.filter((item) => item.reviewerUsed);
  const reviewerValue = reviewed.filter((item) => item.reviewerFoundDefect).length;
  const falsePassCount = outcomes.filter((item) => item.claimedPass && !item.evidenceProvedPass).length;
  const successful = outcomes.filter((item) => item.finalSuccess).length;

  return {
    total: outcomes.length,
    routeAccuracy: routedCorrectly / outcomes.length,
    averageExtraWorkers: extraWorkers / outcomes.length,
    averageContextTokens: contextTokens / outcomes.length,
    reviewerValueRate: reviewed.length === 0 ? 0 : reviewerValue / reviewed.length,
    falsePassCount,
    successRate: successful / outcomes.length,
  };
}
