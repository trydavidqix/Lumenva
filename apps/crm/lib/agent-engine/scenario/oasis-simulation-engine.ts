import type {
  PrepareSimulationInput,
  PreparedSimulation,
  RunSimulationInput,
  ScenarioEngineMode,
  SimulationArtifacts,
  SimulationEnginePort,
  SimulationRunHandle,
  SimulationRunStatus,
} from "../contracts/scenario";

export interface OasisSimulationEngineOptions {
  baseUrl: string;
  mode: ScenarioEngineMode;
  fetchImpl?: typeof fetch;
  requestTimeoutMs?: number;
}

interface WorkerPreparationResponse {
  preparationId: string;
  engine: string;
  engineVersion: string;
  sanitizedPayloadHash: string;
}

interface WorkerRunResponse {
  runId: string;
  status: SimulationRunStatus;
}

function trimSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function assertWorkerMode(mode: ScenarioEngineMode): void {
  if (mode === "off") throw new Error("External OASIS simulation is disabled.");
}

function sanitizePrepareInput(input: PrepareSimulationInput): Record<string, unknown> {
  return {
    protocolVersion: "lumenva-scenario-oasis@1",
    scenario: {
      id: input.scenario.scenarioId,
      question: input.scenario.question,
      compilerVersion: input.scenario.compilerVersion,
      assumptions: input.scenario.assumptions.map((item) => ({
        statement: item.statement,
        sourceKind: item.sourceKind,
        sensitivityKey: item.sensitivityKey,
        value: item.value,
        evidenceRefs: item.evidenceRefs,
      })),
      evidenceRefs: input.scenario.evidence.map((item) => ({
        id: item.id,
        authority: item.authority,
        sourceKind: item.sourceKind,
        sourceType: item.sourceType,
        sourceRef: item.sourceRef,
      })),
    },
    strategy: {
      id: input.strategy.id,
      name: input.strategy.name,
      description: input.strategy.description,
      parameters: input.strategy.parameters,
      isBaseline: input.strategy.isBaseline,
      evidenceRefs: input.strategy.evidenceRefs,
    },
    population: {
      id: input.population.id,
      version: input.population.version,
      seed: input.population.seed,
      generatorVersion: input.population.generatorVersion,
      actors: input.population.actors.map((actor) => ({
        id: actor.id,
        synthetic: true,
        actorTemplateId: actor.actorTemplateId,
        traits: actor.traits,
        evidenceRefs: actor.evidenceRefs,
      })),
    },
    seed: input.seed,
    rounds: input.rounds,
  };
}

export class OasisSimulationEngine implements SimulationEnginePort {
  readonly name = "oasis";
  readonly version = "camel-oasis";

  private readonly baseUrl: string;
  private readonly mode: ScenarioEngineMode;
  private readonly fetchImpl: typeof fetch;
  private readonly requestTimeoutMs: number;

  constructor(options: OasisSimulationEngineOptions) {
    this.baseUrl = trimSlash(options.baseUrl);
    this.mode = options.mode;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.requestTimeoutMs = Math.max(500, Math.min(120_000, options.requestTimeoutMs ?? 15_000));
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    assertWorkerMode(this.mode);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          ...(init?.headers ?? {}),
        },
      });
      if (!response.ok) {
        const text = (await response.text()).slice(0, 500);
        throw new Error(`OASIS worker request failed (${response.status}): ${text}`);
      }
      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  async prepare(input: PrepareSimulationInput): Promise<PreparedSimulation> {
    const result = await this.request<WorkerPreparationResponse>("/v1/prepare", {
      method: "POST",
      body: JSON.stringify(sanitizePrepareInput(input)),
    });
    if (result.engine !== this.name) throw new Error(`Unexpected OASIS worker engine: ${result.engine}.`);
    return result;
  }

  async run(input: RunSimulationInput): Promise<SimulationRunHandle> {
    const result = await this.request<WorkerRunResponse>("/v1/runs", {
      method: "POST",
      body: JSON.stringify({
        protocolVersion: "lumenva-scenario-oasis@1",
        runId: input.runId,
        scenarioId: input.scenarioId,
        preparationId: input.prepared.preparationId,
        budget: input.budget,
      }),
    });
    return { id: input.runId, externalId: result.runId, engine: this.name };
  }

  async status(handle: SimulationRunHandle): Promise<SimulationRunStatus> {
    const externalId = encodeURIComponent(handle.externalId ?? handle.id);
    const result = await this.request<{ status: SimulationRunStatus }>(`/v1/runs/${externalId}`);
    return result.status;
  }

  async cancel(handle: SimulationRunHandle): Promise<void> {
    const externalId = encodeURIComponent(handle.externalId ?? handle.id);
    await this.request<{ status: SimulationRunStatus }>(`/v1/runs/${externalId}/cancel`, { method: "POST" });
  }

  async collectArtifacts(handle: SimulationRunHandle): Promise<SimulationArtifacts> {
    const externalId = encodeURIComponent(handle.externalId ?? handle.id);
    return this.request<SimulationArtifacts>(`/v1/runs/${externalId}/artifacts`);
  }
}
