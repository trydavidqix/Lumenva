import { randomUUID } from "node:crypto";
import type pg from "pg";

import type {
  CouncilPort,
  ScenarioActorTemplate,
  ScenarioAssumption,
  ScenarioBudget,
  ScenarioEvidenceItem,
  ScenarioStrategy,
} from "../contracts/scenario";
import { createScenarioRuntimeCouncilForDb } from "./runtime-council";

interface ScenarioRow {
  id: string;
  organization_id: string;
  title?: string | null;
  question: string;
  status: string;
  decision_variables: unknown;
  constraints: unknown;
  budget: unknown;
}

interface EvidenceRow {
  id: string;
  organization_id: string;
  scenario_id: string;
  source_kind: ScenarioEvidenceItem["sourceKind"];
  authority: ScenarioEvidenceItem["authority"];
  source_type: string;
  source_ref: string;
  observed_at: string | null;
  retrieved_at: string;
  content: unknown;
  provenance: unknown;
}

export interface PrepareScenarioDependencies {
  council?: CouncilPort;
  id?: () => string;
  compilerVersion?: string;
}

export interface PreparedScenarioSetup {
  scenarioId: string;
  organizationId: string;
  status: "READY";
  strategies: ScenarioStrategy[];
  assumptions: ScenarioAssumption[];
  actorTemplates: ScenarioActorTemplate[];
  evidenceCount: number;
  council: {
    synthesis: string;
    disagreements: string[];
    challenges: string[];
    missingEvidence: string[];
    fragileAssumptions: string[];
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function finiteInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function budgetFrom(value: unknown): ScenarioBudget {
  const row = asRecord(value);
  return {
    maxCouncilRounds: finiteInt(row.maxCouncilRounds, 2, 1, 5),
    maxSimulationRuns: finiteInt(row.maxSimulationRuns, 15, 1, 250),
    maxRuntimeMs: finiteInt(row.maxRuntimeMs, 120_000, 1_000, 3_600_000),
    ...(typeof row.maxTokens === "number" && row.maxTokens > 0 ? { maxTokens: Math.trunc(row.maxTokens) } : {}),
    ...(typeof row.maxCostCents === "number" && row.maxCostCents >= 0 ? { maxCostCents: Math.trunc(row.maxCostCents) } : {}),
    maxFailedRuns: finiteInt(row.maxFailedRuns, 2, 0, 25),
    ...(typeof row.minimumImprovement === "number" && row.minimumImprovement >= 0 ? { minimumImprovement: row.minimumImprovement } : {}),
    noProgressLimit: finiteInt(row.noProgressLimit, 1, 1, 5),
  };
}

function mapEvidence(rows: EvidenceRow[]): ScenarioEvidenceItem[] {
  return rows.map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    scenarioId: row.scenario_id,
    sourceKind: row.source_kind,
    authority: row.authority,
    sourceType: row.source_type,
    sourceRef: row.source_ref,
    ...(row.observed_at ? { observedAt: row.observed_at } : {}),
    retrievedAt: row.retrieved_at,
    content: row.content,
    provenance: asRecord(row.provenance),
  }));
}

function baselineParameters(decisionVariables: unknown): Record<string, unknown> {
  const variables = asRecord(decisionVariables);
  const explicit = asRecord(variables.baseline);
  if (Object.keys(explicit).length > 0) return explicit;
  if (Object.keys(variables).length > 0) return variables;
  return { scenarioIntensity: 0 };
}

function ensureTwoCandidates(
  candidates: Awaited<ReturnType<CouncilPort["propose"]>>["candidates"],
  baseline: Record<string, unknown>,
) {
  const output = candidates.slice(0, 2);
  const defaults = [
    {
      name: "Alternativa conservadora",
      description: "Variação sintética controlada para comparação inicial.",
      parameters: { ...baseline, scenarioIntensity: 0.5 },
      assumptions: ["Parâmetro exploratório, sem calibração preditiva."],
      risks: ["Exige validação com evidência real."],
      evidenceRefs: [],
    },
    {
      name: "Alternativa completa",
      description: "Variação sintética de maior intensidade para ampliar o contraste.",
      parameters: { ...baseline, scenarioIntensity: 1 },
      assumptions: ["Parâmetro exploratório, sem calibração preditiva."],
      risks: ["Exige validação com evidência real."],
      evidenceRefs: [],
    },
  ];
  for (const fallback of defaults) {
    if (output.length >= 2) break;
    if (!output.some((candidate) => candidate.name.trim().toLowerCase() === fallback.name.toLowerCase())) output.push(fallback);
  }
  return output.slice(0, 2);
}

async function transition(
  client: pg.PoolClient,
  organizationId: string,
  scenarioId: string,
  from: string,
  to: string,
  compilerVersion?: string,
): Promise<void> {
  const result = await client.query(
    `update scenario_definitions
        set status = $4,
            compiler_version = coalesce($5, compiler_version),
            updated_at = now()
      where organization_id = $1 and id = $2 and status = $3
      returning id`,
    [organizationId, scenarioId, from, to, compilerVersion ?? null],
  );
  if (result.rows.length !== 1) throw new Error(`Scenario preparation conflict for ${scenarioId}: expected ${from}.`);
  await client.query(
    `insert into event_log (organization_id, event_type, entity_kind, entity_id, payload, metadata)
     values ($1, 'scenario.status_changed', 'scenario', $2,
       jsonb_build_object('from', $3, 'to', $4),
       jsonb_build_object('synthetic', false, 'source', 'scenario_lab'))`,
    [organizationId, scenarioId, from, to],
  );
}

export async function prepareScenario(
  db: pg.Pool,
  organizationId: string,
  scenarioId: string,
  deps: PrepareScenarioDependencies = {},
): Promise<PreparedScenarioSetup> {
  const { rows } = await db.query<ScenarioRow>(
    `select id, organization_id, title, question, status, decision_variables, constraints, budget
       from scenario_definitions
      where organization_id = $1 and id = $2
      limit 1`,
    [organizationId, scenarioId],
  );
  const scenario = rows[0];
  if (!scenario) throw new Error(`Scenario ${scenarioId} not found in organization.`);
  if (scenario.status !== "DRAFT") throw new Error(`Scenario preparation conflict for ${scenarioId}: expected DRAFT.`);

  const evidenceResult = await db.query<EvidenceRow>(
    `select id, organization_id, scenario_id, source_kind, authority, source_type, source_ref,
            observed_at, retrieved_at, content, provenance
       from scenario_evidence
      where organization_id = $1 and scenario_id = $2
      order by created_at asc`,
    [organizationId, scenarioId],
  );
  const evidence = mapEvidence(evidenceResult.rows);
  const budget = budgetFrom(scenario.budget);
  const id = deps.id ?? randomUUID;
  const compilerVersion = deps.compilerVersion ?? "scenario-compiler@1";
  const baselineParams = baselineParameters(scenario.decision_variables);
  const baseline: ScenarioStrategy = {
    id: id(),
    organizationId,
    scenarioId,
    name: "Baseline atual",
    description: "Configuração-base usada como referência para a comparação sintética.",
    parameters: baselineParams,
    isBaseline: true,
    source: "system",
    evidenceRefs: evidence.map((item) => item.id),
  };

  const council = deps.council ?? createScenarioRuntimeCouncilForDb(db, {
    maxRuntimeMs: Math.min(30_000, budget.maxRuntimeMs),
    ...(budget.maxTokens === undefined ? {} : { maxTokens: budget.maxTokens }),
    ...(budget.maxCostCents === undefined ? {} : { maxCostCents: budget.maxCostCents }),
  });
  const proposal = await council.propose({
    organizationId,
    scenarioId,
    question: scenario.question,
    evidence,
    existingStrategies: [baseline],
    maxCandidates: 2,
  });
  const challenge = await council.challenge({
    organizationId,
    scenarioId,
    question: scenario.question,
    proposal,
    evidence,
  });
  const candidates = ensureTwoCandidates(proposal.candidates, baselineParams);
  const strategies: ScenarioStrategy[] = [
    baseline,
    ...candidates.map((candidate) => ({
      id: id(),
      organizationId,
      scenarioId,
      name: candidate.name,
      description: candidate.description,
      parameters: candidate.parameters,
      isBaseline: false,
      source: "council" as const,
      evidenceRefs: candidate.evidenceRefs,
    })),
  ];

  const assumptionStatements = [
    ...candidates.flatMap((candidate) => candidate.assumptions),
    ...challenge.fragileAssumptions,
  ].map((value) => value.trim()).filter(Boolean);
  const uniqueAssumptions = [...new Set(assumptionStatements)].slice(0, 20);
  const assumptions: ScenarioAssumption[] = uniqueAssumptions.map((statement, index) => ({
    id: id(),
    organizationId,
    scenarioId,
    statement,
    sourceKind: "council_hypothesis",
    sensitivityKey: `council_assumption_${index + 1}`,
    evidenceRefs: evidence.map((item) => item.id),
  }));
  const actorTemplates: ScenarioActorTemplate[] = [{
    id: id(),
    organizationId,
    scenarioId,
    key: "general_customer",
    label: "Cliente sintético geral",
    weight: 1,
    traits: { syntheticSegment: "general" },
    incentives: {},
    constraints: asRecord(scenario.constraints),
    evidenceRefs: evidence.map((item) => item.id),
  }];

  const client = await db.connect();
  try {
    await client.query("begin");
    for (const strategy of strategies) {
      await client.query(
        `insert into scenario_strategies
          (id, organization_id, scenario_id, name, description, parameters, is_baseline, source, evidence_refs)
         values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9::jsonb)`,
        [strategy.id, organizationId, scenarioId, strategy.name, strategy.description, JSON.stringify(strategy.parameters), strategy.isBaseline, strategy.source, JSON.stringify(strategy.evidenceRefs)],
      );
    }
    for (const assumption of assumptions) {
      await client.query(
        `insert into scenario_assumptions
          (id, organization_id, scenario_id, statement, source_kind, sensitivity_key, value, evidence_refs)
         values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)`,
        [assumption.id, organizationId, scenarioId, assumption.statement, assumption.sourceKind, assumption.sensitivityKey ?? null, assumption.value === undefined ? null : JSON.stringify(assumption.value), JSON.stringify(assumption.evidenceRefs)],
      );
    }
    for (const template of actorTemplates) {
      await client.query(
        `insert into scenario_actor_templates
          (id, organization_id, scenario_id, key, label, weight, traits, incentives, constraints, evidence_refs)
         values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb)`,
        [template.id, organizationId, scenarioId, template.key, template.label, template.weight, JSON.stringify(template.traits), JSON.stringify(template.incentives), JSON.stringify(template.constraints), JSON.stringify(template.evidenceRefs)],
      );
    }
    await transition(client, organizationId, scenarioId, "DRAFT", "EVIDENCE_READY");
    await transition(client, organizationId, scenarioId, "EVIDENCE_READY", "COMPILED", compilerVersion);
    await transition(client, organizationId, scenarioId, "COMPILED", "READY");
    await client.query(
      `insert into event_log (organization_id, event_type, entity_kind, entity_id, payload, metadata)
       values ($1, 'scenario.prepared', 'scenario', $2, $3::jsonb,
         jsonb_build_object('synthetic', false, 'source', 'scenario_lab'))`,
      [organizationId, scenarioId, JSON.stringify({ strategy_count: strategies.length, evidence_count: evidence.length, actor_template_count: actorTemplates.length })],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  return {
    scenarioId,
    organizationId,
    status: "READY",
    strategies,
    assumptions,
    actorTemplates,
    evidenceCount: evidence.length,
    council: {
      synthesis: proposal.synthesis,
      disagreements: proposal.disagreements,
      challenges: challenge.challenges,
      missingEvidence: challenge.missingEvidence,
      fragileAssumptions: challenge.fragileAssumptions,
    },
  };
}
