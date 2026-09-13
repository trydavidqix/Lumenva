import { describe, expect, it, vi } from "vitest";

import type { CouncilPort, ScenarioStrategy } from "../contracts/scenario";
import { MockSimulationEngine } from "./mock-simulation-engine";
import { createScenarioEvaluator } from "./evaluator";
import { createScenarioOrchestrator } from "./orchestrator";

const strategies: ScenarioStrategy[] = [
  {
    id: "baseline",
    organizationId: "org-a",
    scenarioId: "scenario-a",
    name: "Baseline",
    description: "Current price",
    parameters: { revenue: 49 },
    isBaseline: true,
    source: "user",
    evidenceRefs: [],
  },
  {
    id: "proposal",
    organizationId: "org-a",
    scenarioId: "scenario-a",
    name: "Proposal",
    description: "Higher price",
    parameters: { revenue: 79 },
    isBaseline: false,
    source: "user",
    evidenceRefs: [],
  },
];

describe("ScenarioOrchestrator", () => {
  it("runs multiple seeds, asks Council for review and returns a Decision Brief", async () => {
    const review = vi.fn().mockResolvedValue({
      summary: "Proposal is stronger in the synthetic runs.",
      recommendation: "Validate with a limited real-world experiment.",
      disagreements: ["elasticity remains uncertain"],
      criticalAssumptions: ["demand remains stable"],
      nextValidationSteps: ["run a limited A/B price test"],
      memberProvenance: [{ memberId: "reviewer", status: "ok" }],
    });
    const council: CouncilPort = {
      propose: vi.fn().mockResolvedValue({ candidates: [], disagreements: [], memberProvenance: [], synthesis: "" }),
      challenge: vi.fn().mockResolvedValue({ challenges: [], missingEvidence: [], fragileAssumptions: [], memberProvenance: [] }),
      review,
    };

    const orchestrator = createScenarioOrchestrator({
      council,
      engine: new MockSimulationEngine(),
      evaluator: createScenarioEvaluator({ metricDirections: { mock_strategy_signal: "higher" } }),
    });

    const result = await orchestrator.execute({
      organizationId: "org-a",
      scenarioId: "scenario-a",
      question: "Should we raise the price?",
      compilerVersion: "compiler@1",
      generatorVersion: "population@1",
      evidence: [],
      assumptions: [],
      strategies,
      actorTemplates: [
        {
          id: "template-a",
          organizationId: "org-a",
          scenarioId: "scenario-a",
          key: "buyers",
          label: "Buyers",
          weight: 1,
          traits: { priceSensitivity: 0.5 },
          incentives: {},
          constraints: {},
          evidenceRefs: [],
        },
      ],
      entities: [],
      parameters: {},
      seeds: [1, 2, 3],
      populationSize: 24,
      rounds: 8,
      budget: {
        maxCouncilRounds: 2,
        maxSimulationRuns: 6,
        maxRuntimeMs: 20_000,
        maxFailedRuns: 1,
        noProgressLimit: 1,
      },
    });

    expect(result.runs).toHaveLength(6);
    expect(review).toHaveBeenCalledTimes(1);
    expect(result.evaluation.strategyRanking[0]?.strategyId).toBe("proposal");
    expect(result.brief.question).toBe("Should we raise the price?");
    expect(result.brief.recommendation).toMatch(/limited real-world experiment/i);
  });

  it("refuses to exceed the deterministic simulation-run budget", async () => {
    const council: CouncilPort = {
      propose: async () => ({ candidates: [], disagreements: [], memberProvenance: [], synthesis: "" }),
      challenge: async () => ({ challenges: [], missingEvidence: [], fragileAssumptions: [], memberProvenance: [] }),
      review: async () => ({ summary: "", disagreements: [], criticalAssumptions: [], nextValidationSteps: [], memberProvenance: [] }),
    };
    const orchestrator = createScenarioOrchestrator({
      council,
      engine: new MockSimulationEngine(),
      evaluator: createScenarioEvaluator(),
    });

    await expect(orchestrator.execute({
      organizationId: "org-a",
      scenarioId: "scenario-a",
      question: "test",
      compilerVersion: "compiler@1",
      generatorVersion: "population@1",
      evidence: [],
      assumptions: [],
      strategies,
      actorTemplates: [{
        id: "template-a", organizationId: "org-a", scenarioId: "scenario-a", key: "buyers", label: "Buyers",
        weight: 1, traits: {}, incentives: {}, constraints: {}, evidenceRefs: [],
      }],
      entities: [],
      parameters: {},
      seeds: [1, 2, 3],
      populationSize: 24,
      rounds: 8,
      budget: { maxCouncilRounds: 1, maxSimulationRuns: 5, maxRuntimeMs: 20_000, maxFailedRuns: 1, noProgressLimit: 1 },
    })).rejects.toThrow(/simulation-run budget/i);
  });
});
