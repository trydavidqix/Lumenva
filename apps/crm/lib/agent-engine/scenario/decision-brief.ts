import type {
  CouncilReviewResult,
  ScenarioConfidence,
  ScenarioDecisionBrief,
  ScenarioEvaluation,
  ScenarioEvidenceItem,
  ScenarioStrategy,
  SimulationRunRecord,
} from "../contracts/scenario";

export interface DecisionBriefInput {
  scenarioId: string;
  question: string;
  strategies: ScenarioStrategy[];
  evaluation: ScenarioEvaluation;
  review: CouncilReviewResult;
  confidence: ScenarioConfidence;
  evidence: ScenarioEvidenceItem[];
  runs: SimulationRunRecord[];
}

function metricEffectLines(evaluation: ScenarioEvaluation): string[] {
  return evaluation.metrics
    .filter((metric) => metric.mean !== undefined && metric.strategyId)
    .sort((a, b) => Math.abs(b.mean ?? 0) - Math.abs(a.mean ?? 0))
    .slice(0, 8)
    .map((metric) => {
      const low = metric.p10 === undefined ? "?" : metric.p10.toFixed(3);
      const high = metric.p90 === undefined ? "?" : metric.p90.toFixed(3);
      return `${metric.strategyId}: ${metric.key} mean=${(metric.mean ?? 0).toFixed(3)} range[p10,p90]=[${low},${high}]`;
    });
}

function uncertaintyLines(evaluation: ScenarioEvaluation, confidence: ScenarioConfidence): string[] {
  const lines = confidence.reasons.slice();
  if (evaluation.failedRunCount > 0) lines.push(`${evaluation.failedRunCount} simulation run(s) failed and were excluded from numeric distributions.`);
  for (const metric of evaluation.metrics) {
    if ((metric.directionConsistency ?? 1) < 0.7) {
      lines.push(`${metric.strategyId ?? "unknown"}/${metric.key} changes direction across seeds.`);
    }
  }
  return [...new Set(lines)];
}

export function createDecisionBrief(input: DecisionBriefInput): ScenarioDecisionBrief {
  const baseline = input.strategies.find((strategy) => strategy.isBaseline);
  return {
    scenarioId: input.scenarioId,
    question: input.question,
    baselineStrategyId: baseline?.id,
    comparedStrategyIds: input.strategies.map((strategy) => strategy.id),
    strongestEffects: metricEffectLines(input.evaluation),
    uncertainty: uncertaintyLines(input.evaluation, input.confidence),
    segmentImpacts: input.evaluation.metrics
      .filter((metric) => metric.segment)
      .map((metric) => `${metric.segment}: ${metric.key} mean=${metric.mean ?? "n/a"}`),
    criticalAssumptions: input.review.criticalAssumptions,
    sensitivityFindings: input.evaluation.sensitivity.map(
      (item) => `${item.assumptionKey}: impact=${item.impact.toFixed(3)} (${item.stable ? "stable" : "unstable"})`,
    ),
    councilDisagreements: input.review.disagreements,
    evidenceCoverage: input.evaluation.evidenceCoverage,
    confidence: input.confidence,
    recommendation: input.review.recommendation,
    nextValidationSteps: input.review.nextValidationSteps,
    provenance: {
      runIds: input.runs.map((run) => run.id),
      evidenceRefs: input.evidence.map((item) => item.id),
    },
  };
}
