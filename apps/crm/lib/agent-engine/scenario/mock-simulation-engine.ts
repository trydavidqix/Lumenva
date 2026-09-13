import { createHash } from "node:crypto";

import type {
  PrepareSimulationInput,
  PreparedSimulation,
  RunSimulationInput,
  SimulationArtifacts,
  SimulationEnginePort,
  SimulationRunHandle,
  SimulationRunStatus,
} from "../contracts/scenario";

interface MockRun {
  status: SimulationRunStatus;
  artifacts: SimulationArtifacts;
}

function stableHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function numericSignal(parameters: Record<string, unknown>): number {
  const numbers = Object.values(parameters).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (numbers.length === 0) return 0;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

export class MockSimulationEngine implements SimulationEnginePort {
  readonly name = "mock";
  readonly version = "mock@1";

  private readonly prepared = new Map<string, PrepareSimulationInput>();
  private readonly runs = new Map<string, MockRun>();

  async prepare(input: PrepareSimulationInput): Promise<PreparedSimulation> {
    const preparationId = `mock-prep:${stableHash({
      scenarioId: input.scenario.scenarioId,
      populationId: input.population.id,
      strategyId: input.strategy.id,
      seed: input.seed,
      rounds: input.rounds,
    }).slice(0, 24)}`;
    this.prepared.set(preparationId, input);
    return {
      preparationId,
      engine: this.name,
      engineVersion: this.version,
      sanitizedPayloadHash: stableHash({
        scenarioId: input.scenario.scenarioId,
        populationId: input.population.id,
        strategyId: input.strategy.id,
        seed: input.seed,
        rounds: input.rounds,
      }),
    };
  }

  async run(input: RunSimulationInput): Promise<SimulationRunHandle> {
    const prepared = this.prepared.get(input.prepared.preparationId);
    if (!prepared) throw new Error("Unknown mock simulation preparation.");
    const signal = numericSignal(prepared.strategy.parameters);
    const seedSignal = ((prepared.seed % 997) / 997 - 0.5) * 0.1;
    const score = Number((signal + seedSignal).toFixed(6));
    const handle: SimulationRunHandle = {
      id: input.runId,
      engine: this.name,
      externalId: input.prepared.preparationId,
    };
    this.runs.set(handle.id, {
      status: "COMPLETED",
      artifacts: {
        provenance: {
          synthetic: true,
          scenarioId: input.scenarioId,
          runId: input.runId,
          seed: prepared.seed,
          engineVersion: this.version,
          evidenceRefs: prepared.scenario.evidence.map((item) => item.id),
          createdAt: new Date().toISOString(),
        },
        events: [
          {
            kind: "mock.completed",
            occurredAt: new Date().toISOString(),
            payload: { rounds: prepared.rounds },
          },
        ],
        outcomes: [{ key: "mock_strategy_signal", value: score }],
        metrics: { mock_strategy_signal: score },
      },
    });
    return handle;
  }

  async status(handle: SimulationRunHandle): Promise<SimulationRunStatus> {
    return this.runs.get(handle.id)?.status ?? "FAILED";
  }

  async cancel(handle: SimulationRunHandle): Promise<void> {
    const run = this.runs.get(handle.id);
    if (run && run.status !== "COMPLETED") run.status = "CANCELLED";
  }

  async collectArtifacts(handle: SimulationRunHandle): Promise<SimulationArtifacts> {
    const run = this.runs.get(handle.id);
    if (!run) throw new Error("Unknown mock simulation run.");
    if (run.status !== "COMPLETED") throw new Error(`Cannot collect artifacts from run in ${run.status}.`);
    return run.artifacts;
  }
}
