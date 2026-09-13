import type { ScenarioEvidenceItem } from "../contracts/scenario";
import { buildEvidencePack, type EvidencePack } from "./evidence-pack";

export interface BacktestMetricInput {
  predictedValue?: number;
  observedValue?: number;
  baselineValue?: number;
  predictedRanking?: string[];
  observedRanking?: string[];
  predictedInterval?: [number, number];
}

export interface BacktestMetrics {
  directionAccuracy: number | null;
  magnitudeError: number | null;
  rankingAccuracy: number | null;
  intervalCoverage: number | null;
}

export function prepareBacktestEvidence(
  evidence: ScenarioEvidenceItem[],
  cutoffAt: string,
): EvidencePack {
  const cutoff = Date.parse(cutoffAt);
  if (!Number.isFinite(cutoff)) throw new Error("Backtest cutoff must be a valid timestamp.");
  return buildEvidencePack(evidence, { cutoffAt });
}

function rankingAgreement(predicted: string[], observed: string[]): number | null {
  const universe = [...new Set([...predicted, ...observed])];
  if (universe.length < 2) return universe.length === 1 ? 1 : null;
  const predictedIndex = new Map(predicted.map((id, index) => [id, index]));
  const observedIndex = new Map(observed.map((id, index) => [id, index]));
  let comparable = 0;
  let agreeing = 0;
  for (let i = 0; i < universe.length; i += 1) {
    for (let j = i + 1; j < universe.length; j += 1) {
      const a = universe[i]!;
      const b = universe[j]!;
      const pa = predictedIndex.get(a);
      const pb = predictedIndex.get(b);
      const oa = observedIndex.get(a);
      const ob = observedIndex.get(b);
      if (pa === undefined || pb === undefined || oa === undefined || ob === undefined) continue;
      comparable += 1;
      if (Math.sign(pa - pb) === Math.sign(oa - ob)) agreeing += 1;
    }
  }
  return comparable === 0 ? null : agreeing / comparable;
}

export function calculateBacktestMetrics(input: BacktestMetricInput): BacktestMetrics {
  const hasNumeric =
    Number.isFinite(input.predictedValue) &&
    Number.isFinite(input.observedValue) &&
    Number.isFinite(input.baselineValue);

  let directionAccuracy: number | null = null;
  let magnitudeError: number | null = null;
  if (hasNumeric) {
    const predictedDelta = (input.predictedValue as number) - (input.baselineValue as number);
    const observedDelta = (input.observedValue as number) - (input.baselineValue as number);
    directionAccuracy = Math.sign(predictedDelta) === Math.sign(observedDelta) ? 1 : 0;
    magnitudeError = Math.abs((input.predictedValue as number) - (input.observedValue as number));
  }

  const rankingAccuracy = input.predictedRanking && input.observedRanking
    ? rankingAgreement(input.predictedRanking, input.observedRanking)
    : null;

  let intervalCoverage: number | null = null;
  if (input.predictedInterval && Number.isFinite(input.observedValue)) {
    const [rawLow, rawHigh] = input.predictedInterval;
    const low = Math.min(rawLow, rawHigh);
    const high = Math.max(rawLow, rawHigh);
    intervalCoverage = (input.observedValue as number) >= low && (input.observedValue as number) <= high ? 1 : 0;
  }

  return { directionAccuracy, magnitudeError, rankingAccuracy, intervalCoverage };
}
