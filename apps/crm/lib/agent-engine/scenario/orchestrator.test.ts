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

const actorTemplates = [
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
      actorTemplates,
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

  it("runs only new strategies in later Council rounds and carries evaluation feedback", async () => {
    const propose = vi
      .fn()
      .mockResolvedValueOnce({
        candidates: [{
          name: "Mid",
          description: "Moderate increase",
          parameters: { revenue: 60 },
          assumptions: [], risks: [], evidenceRefs: [],
        }],
        disagreements: [], memberProvenance: [], synthesis: "round one",
      })
      .mockResolvedValueOnce({
        candidates: [{
          name: "High",
          description: "Larger increase informed by round one",
          parameters: { revenue: 90 },
          assumptions: [], risks: [], evidenceRefs: [],
        }],
        disagreements: [], memberProvenance: [], synthesis: "round two",
      });
    const review = vi.fn().mockResolvedValue({
      summary: "reviewed",
      disagreements: [], criticalAssumptions: [], nextValidationSteps: [], memberProvenance: [],
    });
    const council: CouncilPort = {
      propose,
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
      question: "Which price should we test?",
      compilerVersion: "compiler@1",
      generatorVersion: "population@1",
      evidence: [], assumptions: [],
      strategies: [strategies[0]!],
      actorTemplates,
      entities: [], parameters: {},
      seeds: [1, 2], populationSize: 24, rounds: 8,
      budget: { maxCouncilRounds: 2, maxSimulationRuns: 6, maxRuntimeMs: 20_000, maxFailedRuns: 1, noProgressLimit: 2 },
    });

    expect(propose).toHaveBeenCalledTimes(2);
    expect(review).toHaveBeenCalledTimes(2);
    expect(result.strategies.map((strategy) => strategy.name)).toEqual(["Baseline", "Mid", "High"]);
    expect(result.runs).toHaveLength(6);
    expect(propose.mock.calls[1]?.[0].iteration?.previousEvaluation?.runCount).toBe(4);
    expect(result.councilRounds).toHaveLength(2);
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
      actorTemplates,
      entities: [],
      parameters: {},
      seeds: [1, 2, 3],
      populationSize: 24,
      rounds: 8,
      budget: { maxCouncilRounds: 1, maxSimulationRuns: 5, maxRuntimeMs: 20_000, maxFailedRuns: 1, noProgressLimit: 1 },
    })).rejects.toThrow(/simulation-run budget/i);
  });
});
