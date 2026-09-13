import type {
  CompiledScenario,
  CompiledScenarioEntity,
  ScenarioActorTemplate,
  ScenarioAssumption,
  ScenarioEvidenceItem,
  ScenarioStrategy,
} from "../contracts/scenario";

export interface CompileScenarioInput {
  organizationId: string;
  scenarioId: string;
  question: string;
  compilerVersion: string;
  evidence: ScenarioEvidenceItem[];
  assumptions: ScenarioAssumption[];
  strategies: ScenarioStrategy[];
  actorTemplates: ScenarioActorTemplate[];
  entities: CompiledScenarioEntity[];
  parameters: Record<string, unknown>;
  requireBaseline?: boolean;
  now?: string;
}

function assertScoped(
  organizationId: string,
  scenarioId: string,
  values: Array<{ organizationId: string; scenarioId: string }>,
): void {
  for (const value of values) {
    if (value.organizationId !== organizationId) {
      throw new Error(`Scenario compiler organization mismatch: expected ${organizationId}, received ${value.organizationId}.`);
    }
    if (value.scenarioId !== scenarioId) {
      throw new Error(`Scenario compiler scenario mismatch: expected ${scenarioId}, received ${value.scenarioId}.`);
    }
  }
}

export function compileScenario(input: CompileScenarioInput): CompiledScenario {
  if (!input.question.trim()) throw new Error("Scenario question is required.");
  if (!input.compilerVersion.trim()) throw new Error("Scenario compiler version is required.");

  assertScoped(input.organizationId, input.scenarioId, input.evidence);
  assertScoped(input.organizationId, input.scenarioId, input.assumptions);
  assertScoped(input.organizationId, input.scenarioId, input.strategies);
  assertScoped(input.organizationId, input.scenarioId, input.actorTemplates);

  const baselineCount = input.strategies.filter((strategy) => strategy.isBaseline).length;
  if (baselineCount > 1) throw new Error("A compiled scenario can have only one baseline strategy.");
  if (input.requireBaseline && baselineCount !== 1) {
    throw new Error("A runnable compiled scenario requires exactly one baseline strategy.");
  }

  for (const assumption of input.assumptions) {
    if (!["user_assumption", "council_hypothesis", "simulation_parameter"].includes(assumption.sourceKind)) {
      throw new Error(`Invalid assumption source kind: ${assumption.sourceKind}.`);
    }
  }

  for (const entity of input.entities) {
    if (!entity.provenance?.sourceKind) throw new Error(`Entity ${entity.id} is missing provenance.`);
  }

  return {
    scenarioId: input.scenarioId,
    organizationId: input.organizationId,
    compilerVersion: input.compilerVersion,
    question: input.question.trim(),
    evidence: [...input.evidence],
    assumptions: [...input.assumptions],
    strategies: [...input.strategies],
    actorTemplates: [...input.actorTemplates],
    entities: [...input.entities],
    parameters: { ...input.parameters },
    compiledAt: input.now ?? new Date().toISOString(),
  };
}
