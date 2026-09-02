export interface ProposalPriorityInput {
  frequency: number;
  impact: number;
  confidence: number;
  failureCost: number;
  changeRiskPenalty: number;
  changeCostPenalty: number;
}

function assertFiniteNonNegative(value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('flywheel_priority_input_invalid');
  }
}

export function scoreProposalPriority(input: ProposalPriorityInput): number {
  assertFiniteNonNegative(input.frequency);
  assertFiniteNonNegative(input.impact);
  assertFiniteNonNegative(input.confidence);
  assertFiniteNonNegative(input.failureCost);
  assertFiniteNonNegative(input.changeRiskPenalty);
  assertFiniteNonNegative(input.changeCostPenalty);

  if (input.impact > 1 || input.confidence > 1) {
    throw new Error('flywheel_priority_input_invalid');
  }

  const positive =
    Math.log1p(input.frequency) *
    input.impact *
    input.confidence *
    Math.max(input.failureCost, 0.1);
  const penalty =
    Math.max(0, input.changeRiskPenalty) + Math.max(0, input.changeCostPenalty);
  return Math.max(0, Number((positive - penalty).toFixed(6)));
}
