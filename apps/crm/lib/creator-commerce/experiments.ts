export interface ExperimentArmObservation {
  id: string;
  organizationId: string;
  samples: number;
  metricTotal: number;
  safetyPassed: boolean;
}

export interface ExperimentEvaluationInput {
  organizationId: string;
  primaryMetric: string;
  minimumSampleSize: number;
  minimumWindowMs: number;
  startedAt: string;
  now: string;
  arms: ExperimentArmObservation[];
}

export interface ExperimentEvaluation {
  status: "winner" | "inconclusive";
  primaryMetric: string;
  winnerArmId: string | null;
  scores: Array<{ armId: string; average: number | null; eligible: boolean }>;
  evidence: string[];
}

export function evaluateExperiment(input: ExperimentEvaluationInput): ExperimentEvaluation {
  if (input.arms.some((arm) => arm.organizationId !== input.organizationId)) {
    throw new Error("experiment_tenant_mismatch");
  }
  const elapsed = Date.parse(input.now) - Date.parse(input.startedAt);
  const evidence: string[] = [];
  const scores = input.arms.map((arm) => {
    const sampleEligible = arm.samples >= input.minimumSampleSize;
    if (!arm.safetyPassed) evidence.push(`${arm.id}:safety_blocked`);
    if (!sampleEligible) evidence.push(`${arm.id}:insufficient_sample`);
    return {
      armId: arm.id,
      average: arm.samples > 0 ? arm.metricTotal / arm.samples : null,
      eligible: sampleEligible && arm.safetyPassed,
    };
  });

  if (!Number.isFinite(elapsed) || elapsed < input.minimumWindowMs) {
    evidence.push("experiment:minimum_window_not_met");
    return { status: "inconclusive", primaryMetric: input.primaryMetric, winnerArmId: null, scores, evidence };
  }
  const eligible = scores.filter((score) => score.eligible && score.average !== null);
  if (eligible.length < 1) {
    return { status: "inconclusive", primaryMetric: input.primaryMetric, winnerArmId: null, scores, evidence };
  }
  eligible.sort((a, b) => (b.average ?? Number.NEGATIVE_INFINITY) - (a.average ?? Number.NEGATIVE_INFINITY) || a.armId.localeCompare(b.armId));
  return {
    status: "winner",
    primaryMetric: input.primaryMetric,
    winnerArmId: eligible[0]!.armId,
    scores,
    evidence: [...evidence, `winner:${eligible[0]!.armId}`],
  };
}
