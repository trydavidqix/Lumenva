import { describe, expect, it } from "vitest";

import type { CompiledScenario, ScenarioPopulation, ScenarioStrategy } from "../contracts/scenario";
import { MockSimulationEngine } from "./mock-simulation-engine";
import { runSimulation } from "./simulation-kernel";

const strategy: ScenarioStrategy = {
  id: "strategy-a",
  organizationId: "org-a",
  scenarioId: "scenario-a",
  name: "baseline",
  description: "baseline",
  parameters: { price: 49 },
  isBaseline: true,
  source: "user",
  evidenceRefs: [],
};

const scenario: CompiledScenario = {
  scenarioId: "scenario-a",
  organizationId: "org-a",
  compilerVersion: "compiler@1",
  question: "price?",
  evidence: [],
  assumptions: [],
  strategies: [strategy],
  actorTemplates: [],
  entities: [],
  parameters: {},
  compiledAt: "2026-09-13T00:00:00.000Z",
};

const population: ScenarioPopulation = {
  id: "population-a",
  organizationId: "org-a",
  scenarioId: "scenario-a",
  version: 1,
  seed: 42,
  size: 24,
  generatorVersion: "population@1",
  actors: [],
  config: { synthetic: true },
};

describe("runSimulation", () => {
  it("returns only validated synthetic artifacts", async () => {
    const engine = new MockSimulationEngine();
    const result = await runSimulation(engine, {
      organizationId: "org-a",
      scenario,
      population,
      strategy,
      seed: 42,
      rounds: 8,
      runId: "run-a",
      maxRuntimeMs: 5_000,
      pollIntervalMs: 1,
    });

    expect(result.status).toBe("COMPLETED");
    expect(result.artifacts.provenance.synthetic).toBe(true);
    expect(result.artifacts.provenance.scenarioId).toBe("scenario-a");
    expect(result.artifacts.provenance.runId).toBe("run-a");
  });

  it("rejects cross-tenant simulation inputs before calling the engine", async () => {
    const engine = new MockSimulationEngine();
    await expect(
      runSimulation(engine, {
        organizationId: "org-b",
        scenario,
        population,
        strategy,
        seed: 42,
        rounds: 8,
        runId: "run-a",
        maxRuntimeMs: 5_000,
        pollIntervalMs: 1,
      }),
    ).rejects.toThrow(/tenant boundary/i);
  });
});
