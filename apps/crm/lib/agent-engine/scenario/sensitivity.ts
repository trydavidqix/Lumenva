import type { ScenarioEvaluationMetric, ScenarioStrategy } from "../contracts/scenario";

export interface ScenarioSensitivityInput {
  strategies: ScenarioStrategy[];
  metrics: ScenarioEvaluationMetric[];
}

function numericParameterKeys(strategies: ScenarioStrategy[]): string[] {
  if (strategies.length < 3) return [];
  const keys = new Set(Object.keys(strategies[0]?.parameters ?? {}));
  for (const strategy of strategies.slice(1)) {
    for (const key of [...keys]) {
      if (!(key in strategy.parameters)) keys.delete(key);
    }
  }
  return [...keys].filter((key) => {
    const values = strategies.map((strategy) => strategy.parameters[key]);
    if (!values.every((value): value is number => typeof value === "number" && Number.isFinite(value))) return false;
    return new Set(values).size >= 3;
  });
}

function correlation(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 3) return null;
  const xMean = xs.reduce((sum, value) => sum + value, 0) / xs.length;
  const yMean = ys.reduce((sum, value) => sum + value, 0) / ys.length;
  let numerator = 0;
  let xVariance = 0;
  let yVariance = 0;
  for (let index = 0; index < xs.length; index += 1) {
    const dx = xs[index]! - xMean;
    const dy = ys[index]! - yMean;
    numerator += dx * dy;
    xVariance += dx * dx;
    yVariance += dy * dy;
  }
  if (xVariance === 0 || yVariance === 0) return null;
  return numerator / Math.sqrt(xVariance * yVariance);
}

/**
 * A deliberately conservative local sensitivity proxy. It only evaluates
 * numeric decision parameters that have at least three distinct tested values.
 * The result is correlation across simulated strategy means, not causal or
 * empirically calibrated sensitivity; the key is namespaced accordingly.
 */
export function analyzeScenarioSensitivity(input: ScenarioSensitivityInput): Array<{
  assumptionKey: string;
  impact: number;
  stable: boolean;
}> {
  const metricKeys = [...new Set(input.metrics.map((metric) => metric.key))];
  const output: Array<{ assumptionKey: string; impact: number; stable: boolean }> = [];

  for (const parameterKey of numericParameterKeys(input.strategies)) {
    const correlations: number[] = [];
    for (const metricKey of metricKeys) {
      const pairs = input.strategies
        .map((strategy) => {
          const metric = input.metrics.find(
            (candidate) => candidate.strategyId === strategy.id && candidate.key === metricKey && candidate.mean !== undefined,
          );
          const parameter = strategy.parameters[parameterKey];
          if (typeof parameter !== "number" || !Number.isFinite(parameter) || metric?.mean === undefined) return null;
          return { x: parameter, y: metric.mean };
        })
        .filter((pair): pair is { x: number; y: number } => pair !== null);
      const value = correlation(
        pairs.map((pair) => pair.x),
        pairs.map((pair) => pair.y),
      );
      if (value !== null) correlations.push(value);
    }
    if (correlations.length === 0) continue;

    const impact = correlations.reduce((sum, value) => sum + Math.abs(value), 0) / correlations.length;
    const signs = new Set(correlations.filter((value) => Math.abs(value) >= 0.1).map((value) => Math.sign(value)));
    output.push({
      assumptionKey: `strategy_parameter:${parameterKey}`,
      impact: Number(Math.max(0, Math.min(1, impact)).toFixed(6)),
      stable: impact >= 0.6 && signs.size <= 1,
    });
  }

  return output.sort((a, b) => b.impact - a.impact || a.assumptionKey.localeCompare(b.assumptionKey));
}
