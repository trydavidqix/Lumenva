import type { ScenarioConfidence, ScenarioConfidenceComponents } from "../contracts/scenario";

const WEIGHTS: Record<Exclude<keyof ScenarioConfidenceComponents, "historicalCalibration"> | "historicalCalibration", number> = {
  runStability: 0.22,
  evidenceCoverage: 0.18,
  modelAgreement: 0.12,
  sensitivityStability: 0.16,
  historicalCalibration: 0.16,
  engineReliability: 0.08,
  dataFreshness: 0.08,
};

function assertScore(name: string, value: number | null): void {
  if (value === null) return;
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be between 0 and 1.`);
  }
}

export function calculateScenarioConfidence(components: ScenarioConfidenceComponents): ScenarioConfidence {
  for (const [name, value] of Object.entries(components)) assertScore(name, value);

  let weighted = 0;
  let weight = 0;
  for (const [name, raw] of Object.entries(components) as Array<[keyof ScenarioConfidenceComponents, number | null]>) {
    if (raw === null) continue;
    const componentWeight = WEIGHTS[name];
    weighted += raw * componentWeight;
    weight += componentWeight;
  }

  const composite = weight > 0 ? Number((weighted / weight).toFixed(4)) : null;
  const reasons: string[] = [];
  if (components.historicalCalibration === null) reasons.push("Historical calibration unavailable; no empirical backtest score was invented.");
  if (components.evidenceCoverage < 0.6) reasons.push("Evidence coverage is limited.");
  if (components.runStability < 0.6) reasons.push("Simulation results vary materially across seeds.");
  if (components.modelAgreement < 0.6) reasons.push("Council members materially disagree.");
  if (components.sensitivityStability < 0.6) reasons.push("Result is sensitive to assumptions.");
  if (components.dataFreshness < 0.6) reasons.push("Some evidence is stale relative to the decision window.");

  return {
    components,
    composite,
    formulaVersion: "scenario-confidence@1",
    reasons,
  };
}
