import { describe, expect, it } from "vitest";

import type { ScenarioEvaluationInput, ScenarioStrategy, SimulationRunRecord } from "../contracts/scenario";
import { createScenarioEvaluator } from "./evaluator";

const strategy = (id: string): ScenarioStrategy => ({
  id,
  organizationId: "org-a",
  scenarioId: "scenario-a",
  name: id,
  description: id,
  parameters: {},
  isBaseline: id === "baseline",
  source: "user",
  evidenceRefs: [],
});

const run = (id: string, strategyId: string, seed: number, value: number): ScenarioEvaluationInput["runs"][number] => ({
  run: {
    id,
    organizationId: "org-a",
    scenarioId: "scenario-a",
    strategyId,
    populationId: `population-${seed}`,
    status: "COMPLETED",
    seed,
    engine: "mock",
    engineVersion: "mock@1",
    compilerVersion: "compiler@1",
    budget: {},
  } satisfies SimulationRunRecord,
  artifacts: {
    provenance: { synthetic: true, scenarioId: "scenario-a", runId: id, seed, engineVersion: "mock@1" },
    events: [],
    outcomes: [{ key: "revenue", value }],
    metrics: { revenue: value },
  },
});

describe("ScenarioEvaluator", () => {
  it("aggregates multiple seeds into distributions instead of choosing one run", async () => {
    const evaluator = createScenarioEvaluator({ metricDirections: { revenue: "higher" } });
    const result = await evaluator.evaluate({
      scenarioId: "scenario-a",
      strategies: [strategy("baseline"), strategy("proposal")],
      runs: [
        run("b1", "baseline", 1, 100),
        run("b2", "baseline", 2, 101),
        run("b3", "baseline", 3, 99),
        run("p1", "proposal", 1, 120),
        run("p2", "proposal", 2, 118),
        run("p3", "proposal", 3, 121),
      ],
      evidenceCount: 8,
      expectedEvidenceCount: 10,
    });

    const proposalRevenue = result.metrics.find((metric) => metric.strategyId === "proposal" && metric.key === "revenue");
    expect(proposalRevenue?.mean).toBeCloseTo(119.666, 2);
    expect(proposalRevenue?.p10).toBeDefined();
    expect(proposalRevenue?.p90).toBeDefined();
    expect(result.strategyRanking[0]?.strategyId).toBe("proposal");
    expect(result.evidenceCoverage).toBe(0.8);
  });

  it("counts failed runs but excludes them from numeric distributions", async () => {
    const failed = run("failed", "proposal", 4, 999);
    failed.run.status = "FAILED";
    const evaluator = createScenarioEvaluator({ metricDirections: { revenue: "higher" } });
    const result = await evaluator.evaluate({
      scenarioId: "scenario-a",
      strategies: [strategy("proposal")],
      runs: [run("p1", "proposal", 1, 10), failed],
      evidenceCount: 1,
      expectedEvidenceCount: 1,
    });

    expect(result.failedRunCount).toBe(1);
    expect(result.metrics.find((metric) => metric.key === "revenue")?.mean).toBe(10);
  });
});
