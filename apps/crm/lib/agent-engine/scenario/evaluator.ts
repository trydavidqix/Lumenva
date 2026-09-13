import type {
  ScenarioEvaluation,
  ScenarioEvaluationInput,
  ScenarioEvaluationMetric,
  ScenarioEvaluator,
} from "../contracts/scenario";

export interface ScenarioEvaluatorConfig {
  metricDirections?: Record<string, "higher" | "lower">;
  stabilityRelativeSpread?: number;
  now?: () => string;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function variance(values: number[], avg: number): number {
  if (values.length <= 1) return 0;
  return values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0]!;
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower]!;
  const weight = index - lower;
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

function median(values: number[]): number {
  return percentile(values, 0.5);
}

function directionConsistency(values: number[]): number {
  const center = median(values);
  if (center === 0) return values.filter((value) => value === 0).length / values.length;
  const sign = Math.sign(center);
  return values.filter((value) => Math.sign(value) === sign || value === 0).length / values.length;
}

export function createScenarioEvaluator(config: ScenarioEvaluatorConfig = {}): ScenarioEvaluator {
  const stableSpread = config.stabilityRelativeSpread ?? 0.25;
  return {
    async evaluate(input: ScenarioEvaluationInput): Promise<ScenarioEvaluation> {
      const completed = input.runs.filter((entry) => entry.run.status === "COMPLETED");
      const failedRunCount = input.runs.length - completed.length;
      const byStrategyMetric = new Map<string, number[]>();

      for (const entry of completed) {
        if (entry.run.scenarioId !== input.scenarioId || entry.artifacts.provenance.scenarioId !== input.scenarioId) {
          throw new Error("Evaluator received artifacts outside the scenario boundary.");
        }
        for (const [key, value] of Object.entries(entry.artifacts.metrics)) {
          if (!Number.isFinite(value)) continue;
          const bucketKey = `${entry.run.strategyId}\u0000${key}`;
          const bucket = byStrategyMetric.get(bucketKey) ?? [];
          bucket.push(value);
          byStrategyMetric.set(bucketKey, bucket);
        }
      }

      const metrics: ScenarioEvaluationMetric[] = [];
      for (const [bucketKey, values] of byStrategyMetric) {
        const [strategyId, key] = bucketKey.split("\u0000") as [string, string];
        const avg = mean(values);
        const metricVariance = variance(values, avg);
        metrics.push({
          key,
          strategyId,
          mean: avg,
          median: median(values),
          p10: percentile(values, 0.1),
          p90: percentile(values, 0.9),
          variance: metricVariance,
          directionConsistency: directionConsistency(values),
          metadata: { sampleCount: values.length },
        });
      }

      const strategyScores = input.strategies.map((strategy) => {
        const strategyMetrics = metrics.filter((metric) => metric.strategyId === strategy.id && metric.mean !== undefined);
        const score = strategyMetrics.length === 0
          ? 0
          : mean(
              strategyMetrics.map((metric) => {
                const direction = config.metricDirections?.[metric.key] ?? "higher";
                return (metric.mean ?? 0) * (direction === "higher" ? 1 : -1);
              }),
            );
        const stable = strategyMetrics.length > 0 && strategyMetrics.every((metric) => {
          const center = Math.abs(metric.mean ?? 0);
          const spread = Math.max(0, (metric.p90 ?? 0) - (metric.p10 ?? 0));
          return center === 0 ? spread === 0 : spread / center <= stableSpread;
        });
        return { strategyId: strategy.id, score, stable };
      });

      strategyScores.sort((a, b) => b.score - a.score);
      const expectedEvidence = Math.max(0, input.expectedEvidenceCount);
      const evidenceCoverage = expectedEvidence === 0
        ? 1
        : Math.max(0, Math.min(1, input.evidenceCount / expectedEvidence));

      return {
        scenarioId: input.scenarioId,
        runCount: completed.length,
        failedRunCount,
        strategyRanking: strategyScores,
        metrics,
        sensitivity: [],
        evidenceCoverage,
        generatedAt: config.now?.() ?? new Date().toISOString(),
      };
    },
  };
}
