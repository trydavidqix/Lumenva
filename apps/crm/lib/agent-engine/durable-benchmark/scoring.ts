import type { DurableBenchmarkEngineId } from './contracts';

export interface DurableBenchmarkScore {
  engineId: DurableBenchmarkEngineId;
  reliability: number;
  durability: number;
  observability: number;
  operationalSimplicity: number;
  performance: number;
  cost: number;
  maintainability: number;
  weightedTotal: number;
}

export type DurableBenchmarkDecision =
  | 'KEEP_CURRENT'
  | 'ADOPT_INNGEST'
  | 'ADOPT_VERCEL_WORKFLOW'
  | 'NO_GO'
  | 'INCOMPLETE';

export const DURABLE_BENCHMARK_WEIGHTS = {
  reliability: 0.4,
  durability: 0.2,
  observability: 0.15,
  operationalSimplicity: 0.1,
  performance: 0.05,
  cost: 0.05,
  maintainability: 0.05,
} as const;

type ScoreDimensions = Omit<DurableBenchmarkScore, 'engineId' | 'weightedTotal'>;

function clamp(value: number): number {
  if (!Number.isFinite(value)) throw new Error('benchmark_score_must_be_finite');
  return Math.max(0, Math.min(100, value));
}

export function scoreDurableBenchmark(
  engineId: DurableBenchmarkEngineId,
  dimensions: ScoreDimensions,
): DurableBenchmarkScore {
  const normalized = Object.fromEntries(
    Object.entries(dimensions).map(([key, value]) => [key, clamp(value)]),
  ) as ScoreDimensions;

  const weightedTotal =
    normalized.reliability * DURABLE_BENCHMARK_WEIGHTS.reliability +
    normalized.durability * DURABLE_BENCHMARK_WEIGHTS.durability +
    normalized.observability * DURABLE_BENCHMARK_WEIGHTS.observability +
    normalized.operationalSimplicity * DURABLE_BENCHMARK_WEIGHTS.operationalSimplicity +
    normalized.performance * DURABLE_BENCHMARK_WEIGHTS.performance +
    normalized.cost * DURABLE_BENCHMARK_WEIGHTS.cost +
    normalized.maintainability * DURABLE_BENCHMARK_WEIGHTS.maintainability;

  return { engineId, ...normalized, weightedTotal };
}

export function decideDurableBenchmark(input: {
  scores: readonly DurableBenchmarkScore[];
  hardGatePass: Readonly<Record<DurableBenchmarkEngineId, boolean>>;
  realEvidence: Readonly<Record<DurableBenchmarkEngineId, boolean>>;
}): DurableBenchmarkDecision {
  const current = input.scores.find((score) => score.engineId === 'current');
  if (!current || !input.realEvidence.current || !input.hardGatePass.current) return 'INCOMPLETE';

  const comparedExternal = input.scores.filter((score) => score.engineId !== 'current');
  if (comparedExternal.some((score) => !input.realEvidence[score.engineId])) return 'INCOMPLETE';

  const eligible = comparedExternal
    .filter((score) => input.hardGatePass[score.engineId])
    .sort((a, b) => b.weightedTotal - a.weightedTotal);

  const best = eligible[0];
  if (!best) return comparedExternal.length === 0 ? 'KEEP_CURRENT' : 'KEEP_CURRENT';
  if (best.weightedTotal - current.weightedTotal < 10) return 'KEEP_CURRENT';
  if (best.weightedTotal === current.weightedTotal) return 'KEEP_CURRENT';

  if (best.engineId === 'inngest') return 'ADOPT_INNGEST';
  if (best.engineId === 'vercel_workflow') return 'ADOPT_VERCEL_WORKFLOW';
  return 'NO_GO';
}
