import { describe, expect, it } from "vitest";

import type { ScenarioEvaluationMetric, ScenarioStrategy } from "../contracts/scenario";
import { analyzeScenarioSensitivity } from "./sensitivity";

const strategies: ScenarioStrategy[] = [
  {
    id: "baseline",
    organizationId: "org-a",
    scenarioId: "scenario-a",
    name: "Baseline",
    description: "Current price",
    parameters: { price: 50, copy: "same" },
    isBaseline: true,
    source: "user",
    evidenceRefs: [],
  },
  {
    id: "mid",
    organizationId: "org-a",
    scenarioId: "scenario-a",
    name: "Mid",
    description: "Mid price",
    parameters: { price: 60, copy: "same" },
    isBaseline: false,
    source: "user",
    evidenceRefs: [],
  },
  {
    id: "high",
    organizationId: "org-a",
    scenarioId: "scenario-a",
    name: "High",
    description: "High price",
    parameters: { price: 70, copy: "same" },
    isBaseline: false,
    source: "user",
    evidenceRefs: [],
  },
];

const metrics: ScenarioEvaluationMetric[] = [
  { key: "conversion", strategyId: "baseline", mean: 0.8, p10: 0.78, p90: 0.82 },
  { key: "conversion", strategyId: "mid", mean: 0.7, p10: 0.68, p90: 0.72 },
  { key: "conversion", strategyId: "high", mean: 0.6, p10: 0.58, p90: 0.62 },
];

describe("analyzeScenarioSensitivity", () => {
  it("measures monotonic impact for numeric decision parameters", () => {
    const result = analyzeScenarioSensitivity({ strategies, metrics });

    expect(result).toHaveLength(1);
    expect(result[0]?.assumptionKey).toBe("strategy_parameter:price");
    expect(result[0]?.impact).toBeGreaterThan(0);
    expect(result[0]?.stable).toBe(true);
  });

  it("does not pretend categorical or constant parameters are calibrated sensitivity", () => {
    const constant = strategies.map((strategy) => ({ ...strategy, parameters: { price: 50, copy: "same" } }));
    expect(analyzeScenarioSensitivity({ strategies: constant, metrics })).toEqual([]);
  });
});
