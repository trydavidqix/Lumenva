import type {
  CompiledScenario,
  ScenarioPopulation,
  ScenarioStrategy,
  SimulationArtifacts,
  SimulationEnginePort,
  SimulationRunStatus,
} from "../contracts/scenario";
import { assertSyntheticArtifact } from "./synthetic-boundary";

export interface RunSimulationRequest {
  organizationId: string;
  scenario: CompiledScenario;
  population: ScenarioPopulation;
  strategy: ScenarioStrategy;
  seed: number;
  rounds: number;
  runId: string;
  maxRuntimeMs: number;
  pollIntervalMs?: number;
}

export interface RunSimulationResult {
  status: Extract<SimulationRunStatus, "COMPLETED">;
  artifacts: SimulationArtifacts;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function assertScoped(input: RunSimulationRequest): void {
  if (
    input.scenario.organizationId !== input.organizationId ||
    input.population.organizationId !== input.organizationId ||
    input.strategy.organizationId !== input.organizationId ||
    input.scenario.scenarioId !== input.population.scenarioId ||
    input.scenario.scenarioId !== input.strategy.scenarioId
  ) {
    throw new Error("Simulation input crossed the scenario tenant boundary.");
  }
  if (input.seed !== input.population.seed) {
    throw new Error("Simulation seed must match the population seed.");
  }
  if (!Number.isInteger(input.rounds) || input.rounds < 1 || input.rounds > 100) {
    throw new Error("Simulation rounds must be between 1 and 100.");
  }
}

export async function runSimulation(
  engine: SimulationEnginePort,
  input: RunSimulationRequest,
): Promise<RunSimulationResult> {
  assertScoped(input);
  if (input.maxRuntimeMs < 100) throw new Error("Simulation runtime budget is too small.");

  const prepared = await engine.prepare({
    organizationId: input.organizationId,
    scenario: input.scenario,
    population: input.population,
    strategy: input.strategy,
    seed: input.seed,
    rounds: input.rounds,
  });
  if (prepared.engine !== engine.name || prepared.engineVersion !== engine.version) {
    throw new Error("Simulation engine returned inconsistent preparation provenance.");
  }

  const handle = await engine.run({
    organizationId: input.organizationId,
    scenarioId: input.scenario.scenarioId,
    runId: input.runId,
    prepared,
    budget: { maxRuntimeMs: input.maxRuntimeMs, maxRounds: input.rounds },
  });

  const deadline = Date.now() + input.maxRuntimeMs;
  const pollIntervalMs = Math.max(1, Math.min(2_000, input.pollIntervalMs ?? 250));
  let status: SimulationRunStatus = "RUNNING";

  while (Date.now() <= deadline) {
    status = await engine.status(handle);
    if (status === "COMPLETED") break;
    if (["FAILED", "CANCELLED", "TIMED_OUT"].includes(status)) {
      throw new Error(`Simulation run terminated with status ${status}.`);
    }
    await sleep(pollIntervalMs);
  }

  if (status !== "COMPLETED") {
    await engine.cancel(handle).catch(() => undefined);
    throw new Error("Simulation run exceeded its wall-clock budget.");
  }

  const artifacts = await engine.collectArtifacts(handle);
  assertSyntheticArtifact(artifacts.provenance);
  if (
    artifacts.provenance.scenarioId !== input.scenario.scenarioId ||
    artifacts.provenance.runId !== input.runId ||
    artifacts.provenance.seed !== input.seed
  ) {
    throw new Error("Simulation artifacts failed provenance validation.");
  }

  return { status: "COMPLETED", artifacts };
}
