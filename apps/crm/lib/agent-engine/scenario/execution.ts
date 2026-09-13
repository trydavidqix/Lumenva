import { randomUUID } from "node:crypto";
import type pg from "pg";

import type {
  CouncilPort,
  ScenarioActorTemplate,
  ScenarioAssumption,
  ScenarioBudget,
  ScenarioEvidenceItem,
  ScenarioEvaluator,
  ScenarioStrategy,
  SimulationEnginePort,
} from "../contracts/scenario";
import { getScenarioRuntimeConfig, type ScenarioRuntimeConfig } from "./config";
import { createScenarioEvaluator } from "./evaluator";
import { MockSimulationEngine } from "./mock-simulation-engine";
import { OasisSimulationEngine } from "./oasis-simulation-engine";
import {
  createScenarioOrchestrator,
  type ExecuteScenarioInput,
  type ScenarioOrchestrationResult,
} from "./orchestrator";
import { buildSyntheticPopulation } from "./population";
import { createScenarioRuntimeCouncilForDb } from "./runtime-council";

interface ScenarioRow {
  id: string;
  organization_id: string;
  question: string;
  status: string;
  decision_variables: unknown;
  constraints: unknown;
  budget: unknown;
  compiler_version: string | null;
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

interface AssumptionRow {
  id: string;
  organization_id: string;
  scenario_id: string;
  statement: string;
  source_kind: ScenarioAssumption["sourceKind"];
  sensitivity_key: string | null;
  value: unknown;
  evidence_refs: unknown;
}

interface StrategyRow {
  id: string;
  organization_id: string;
  scenario_id: string;
  name: string;
  description: string;
  parameters: unknown;
  is_baseline: boolean;
  source: ScenarioStrategy["source"];
  evidence_refs: unknown;
}

interface ActorTemplateRow {
  id: string;
  organization_id: string;
  scenario_id: string;
  key: string;
  label: string;
  weight: number | string;
  traits: unknown;
  incentives: unknown;
  constraints: unknown;
  evidence_refs: unknown;
}

export interface ScenarioExecutionDependencies {
  orchestrate?: (input: ExecuteScenarioInput) => Promise<ScenarioOrchestrationResult>;
  council?: CouncilPort;
  engine?: SimulationEnginePort;
  evaluator?: ScenarioEvaluator;
  config?: ScenarioRuntimeConfig;
  id?: () => string;
  now?: () => Date;
}

export interface ScenarioExecutionSummary {
  scenarioId: string;
  organizationId: string;
  status: "COMPLETED";
  runCount: number;
  reportId: string;
  comparisonId: string;
  engine: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function finiteInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function budgetFrom(value: unknown): ScenarioBudget {
  const row = asRecord(value);
  return {
    maxCouncilRounds: finiteInt(row.maxCouncilRounds, 1, 1, 5),
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

function mapAssumptions(rows: AssumptionRow[]): ScenarioAssumption[] {
  return rows.map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    scenarioId: row.scenario_id,
    statement: row.statement,
    sourceKind: row.source_kind,
    ...(row.sensitivity_key ? { sensitivityKey: row.sensitivity_key } : {}),
    ...(row.value === null || row.value === undefined ? {} : { value: row.value }),
    evidenceRefs: asStringArray(row.evidence_refs),
  }));
}

function mapStrategies(rows: StrategyRow[]): ScenarioStrategy[] {
  return rows.map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    scenarioId: row.scenario_id,
    name: row.name,
    description: row.description,
    parameters: asRecord(row.parameters),
    isBaseline: row.is_baseline,
    source: row.source,
    evidenceRefs: asStringArray(row.evidence_refs),
  }));
}

function mapActorTemplates(rows: ActorTemplateRow[]): ScenarioActorTemplate[] {
  return rows.map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    scenarioId: row.scenario_id,
    key: row.key,
    label: row.label,
    weight: Number(row.weight),
    traits: asRecord(row.traits),
    incentives: asRecord(row.incentives),
    constraints: asRecord(row.constraints),
    evidenceRefs: asStringArray(row.evidence_refs),
  }));
}

function reviewOnlyCouncil(delegate: CouncilPort): CouncilPort {
  return {
    async propose() {
      return {
        candidates: [],
        disagreements: [],
        memberProvenance: [],
        synthesis: "Strategies were approved during the preparation step; execution does not silently add new candidates.",
      };
    },
    challenge: (input) => delegate.challenge(input),
    review: (input) => delegate.review(input),
  };
}

function chooseEngine(config: ScenarioRuntimeConfig): SimulationEnginePort {
  if (config.oasisMode === "on" && config.oasisUrl) {
    return new OasisSimulationEngine({
      baseUrl: config.oasisUrl,
      mode: "on",
      requestTimeoutMs: Math.min(30_000, config.maxRuntimeMs),
    });
  }
  return new MockSimulationEngine();
}

async function markFailed(db: pg.Pool, organizationId: string, scenarioId: string, message: string): Promise<void> {
  await db.query(
    `with changed as (
       update scenario_definitions
          set status = 'FAILED', updated_at = now()
        where organization_id = $1 and id = $2 and status in ('RUNNING','ANALYZING')
        returning id
     )
     insert into event_log (organization_id, event_type, entity_kind, entity_id, payload, metadata)
     select $1, 'scenario.failed', 'scenario', id,
            jsonb_build_object('error', $3),
            jsonb_build_object('synthetic', false, 'source', 'scenario_lab')
       from changed`,
    [organizationId, scenarioId, message.slice(0, 500)],
  );
}

async function transitionTx(
  client: pg.PoolClient,
  organizationId: string,
  scenarioId: string,
  from: "RUNNING" | "ANALYZING",
  to: "ANALYZING" | "COMPLETED",
): Promise<void> {
  const result = await client.query(
    `update scenario_definitions
        set status = $4,
            updated_at = now(),
            completed_at = case when $4 = 'COMPLETED' then now() else completed_at end
      where organization_id = $1 and id = $2 and status = $3
      returning id`,
    [organizationId, scenarioId, from, to],
  );
  if (result.rows.length !== 1) throw new Error(`Scenario execution conflict for ${scenarioId}: expected ${from}.`);
  await client.query(
    `insert into event_log (organization_id, event_type, entity_kind, entity_id, payload, metadata)
     values ($1, 'scenario.status_changed', 'scenario', $2,
       jsonb_build_object('from', $3, 'to', $4),
       jsonb_build_object('synthetic', false, 'source', 'scenario_lab'))`,
    [organizationId, scenarioId, from, to],
  );
}

export async function executePersistedScenario(
  db: pg.Pool,
  organizationId: string,
  scenarioId: string,
  deps: ScenarioExecutionDependencies = {},
): Promise<ScenarioExecutionSummary> {
  const scenarioResult = await db.query<ScenarioRow>(
    `select id, organization_id, question, status, decision_variables, constraints, budget, compiler_version
       from scenario_definitions
      where organization_id = $1 and id = $2
      limit 1`,
    [organizationId, scenarioId],
  );
  const scenario = scenarioResult.rows[0];
  if (!scenario) throw new Error(`Scenario ${scenarioId} not found in organization.`);
  if (scenario.status !== "RUNNING") throw new Error(`Scenario execution conflict for ${scenarioId}: expected RUNNING.`);

  const [evidenceResult, assumptionResult, strategyResult, actorTemplateResult] = await Promise.all([
    db.query<EvidenceRow>(
      `select id, organization_id, scenario_id, source_kind, authority, source_type, source_ref, observed_at, retrieved_at, content, provenance
         from scenario_evidence where organization_id = $1 and scenario_id = $2 order by created_at asc`,
      [organizationId, scenarioId],
    ),
    db.query<AssumptionRow>(
      `select id, organization_id, scenario_id, statement, source_kind, sensitivity_key, value, evidence_refs
         from scenario_assumptions where organization_id = $1 and scenario_id = $2 order by created_at asc`,
      [organizationId, scenarioId],
    ),
    db.query<StrategyRow>(
      `select id, organization_id, scenario_id, name, description, parameters, is_baseline, source, evidence_refs
         from scenario_strategies where organization_id = $1 and scenario_id = $2 order by created_at asc`,
      [organizationId, scenarioId],
    ),
    db.query<ActorTemplateRow>(
      `select id, organization_id, scenario_id, key, label, weight, traits, incentives, constraints, evidence_refs
         from scenario_actor_templates where organization_id = $1 and scenario_id = $2 order by created_at asc`,
      [organizationId, scenarioId],
    ),
  ]);

  const evidence = mapEvidence(evidenceResult.rows);
  const assumptions = mapAssumptions(assumptionResult.rows);
  const strategies = mapStrategies(strategyResult.rows);
  const actorTemplates = mapActorTemplates(actorTemplateResult.rows);
  if (strategies.length < 3) throw new Error("Scenario execution requires at least three prepared strategies.");
  if (strategies.filter((strategy) => strategy.isBaseline).length !== 1) throw new Error("Scenario execution requires exactly one baseline strategy.");
  if (actorTemplates.length === 0) throw new Error("Scenario execution requires at least one synthetic actor template.");

  const config = deps.config ?? getScenarioRuntimeConfig();
  const budget = budgetFrom(scenario.budget);
  if (budget.maxSimulationRuns < strategies.length) {
    throw new Error(`Scenario run budget ${budget.maxSimulationRuns} is smaller than the prepared strategy count ${strategies.length}.`);
  }
  const seedCount = Math.max(1, Math.min(5, Math.floor(budget.maxSimulationRuns / strategies.length)));
  const seeds = [11, 29, 47, 71, 97].slice(0, seedCount);
  const populationSize = Math.max(24, Math.min(50, config.maxActors));
  const rounds = Math.max(1, Math.min(12, config.maxRounds));
  const compilerVersion = scenario.compiler_version ?? "scenario-compiler@1";
  const generatorVersion = "synthetic-population@1";
  const runtimeCouncil = deps.council ?? createScenarioRuntimeCouncilForDb(db, {
    maxRuntimeMs: Math.min(30_000, budget.maxRuntimeMs),
    ...(budget.maxTokens === undefined ? {} : { maxTokens: budget.maxTokens }),
    ...(budget.maxCostCents === undefined ? {} : { maxCostCents: budget.maxCostCents }),
  });
  const engine = deps.engine ?? chooseEngine(config);
  const evaluator = deps.evaluator ?? createScenarioEvaluator({ metricDirections: { mock_strategy_signal: "higher" } });
  const executeInput: ExecuteScenarioInput = {
    organizationId,
    scenarioId,
    question: scenario.question,
    compilerVersion,
    generatorVersion,
    evidence,
    assumptions,
    strategies,
    actorTemplates,
    entities: [],
    parameters: asRecord(scenario.decision_variables),
    seeds,
    populationSize,
    rounds,
    budget: { ...budget, maxCouncilRounds: 1 },
  };

  let result: ScenarioOrchestrationResult;
  try {
    if (deps.orchestrate) result = await deps.orchestrate(executeInput);
    else {
      result = await createScenarioOrchestrator({
        council: reviewOnlyCouncil(runtimeCouncil),
        engine,
        evaluator,
        now: deps.now,
        id: deps.id,
      }).execute(executeInput);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scenario orchestration failed.";
    await markFailed(db, organizationId, scenarioId, message).catch(() => undefined);
    throw error;
  }

  const id = deps.id ?? randomUUID;
  const now = deps.now ?? (() => new Date());
  const comparisonId = id();
  const reportId = id();
  const populationDbIdBySeed = new Map<number, string>();
  const client = await db.connect();
  try {
    await client.query("begin");
    await transitionTx(client, organizationId, scenarioId, "RUNNING", "ANALYZING");

    for (const seed of [...new Set(result.runs.map((run) => run.seed))]) {
      const runtimePopulationId = result.runs.find((run) => run.seed === seed)?.populationId ?? `population:${scenarioId}:${seed}`;
      const dbPopulationId = id();
      populationDbIdBySeed.set(seed, dbPopulationId);
      const population = buildSyntheticPopulation({
        organizationId,
        scenarioId,
        populationId: runtimePopulationId,
        version: 1,
        seed,
        size: populationSize,
        generatorVersion,
        templates: actorTemplates,
        now: now().toISOString(),
      });
      await client.query(
        `insert into scenario_populations
          (id, organization_id, scenario_id, version, seed, size, generator_version, synthetic, config, actors)
         values ($1, $2, $3, 1, $4, $5, $6, true, $7::jsonb, $8::jsonb)`,
        [
          dbPopulationId,
          organizationId,
          scenarioId,
          seed,
          population.size,
          generatorVersion,
          JSON.stringify({ ...population.config, runtimePopulationId }),
          JSON.stringify(population.actors),
        ],
      );
    }

    for (let index = 0; index < result.runs.length; index += 1) {
      const run = result.runs[index]!;
      const artifacts = result.artifacts[index];
      const dbPopulationId = populationDbIdBySeed.get(run.seed);
      if (!dbPopulationId) throw new Error(`Missing persisted population for seed ${run.seed}.`);
      await client.query(
        `insert into scenario_runs
          (id, organization_id, scenario_id, strategy_id, population_id, status, seed, engine, engine_version,
           compiler_version, council_config_hash, budget, started_at, ended_at, error_code, error_message)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15,$16)`,
        [run.id, organizationId, scenarioId, run.strategyId, dbPopulationId, run.status, run.seed, run.engine, run.engineVersion, run.compilerVersion, run.councilConfigHash ?? null, JSON.stringify(run.budget), run.startedAt ?? null, run.endedAt ?? null, run.errorCode ?? null, run.errorMessage ?? null],
      );
      if (!artifacts) continue;
      for (const event of artifacts.events) {
        await client.query(
          `insert into scenario_run_events
            (organization_id, scenario_id, run_id, kind, round, actor_id, synthetic, payload, occurred_at)
           values ($1,$2,$3,$4,$5,$6,true,$7::jsonb,$8)`,
          [organizationId, scenarioId, run.id, event.kind, event.round ?? null, event.actorId ?? null, JSON.stringify(event.payload), event.occurredAt],
        );
      }
      for (const outcome of artifacts.outcomes) {
        const numericValue = typeof outcome.value === "number" ? outcome.value : null;
        const textValue = typeof outcome.value === "string" ? outcome.value : null;
        const booleanValue = typeof outcome.value === "boolean" ? outcome.value : null;
        await client.query(
          `insert into scenario_outcomes
            (organization_id, scenario_id, run_id, strategy_id, outcome_key, segment, synthetic, seed,
             engine_version, model_version, evidence_refs, numeric_value, text_value, boolean_value, metadata)
           values ($1,$2,$3,$4,$5,$6,true,$7,$8,$9,$10::jsonb,$11,$12,$13,$14::jsonb)`,
          [organizationId, scenarioId, run.id, run.strategyId, outcome.key, outcome.segment ?? null, run.seed, artifacts.provenance.engineVersion, artifacts.provenance.modelVersion ?? null, JSON.stringify(artifacts.provenance.evidenceRefs ?? []), numericValue, textValue, booleanValue, JSON.stringify(outcome.metadata ?? {})],
        );
      }
    }

    for (const metric of result.evaluation.metrics) {
      await client.query(
        `insert into scenario_metrics
          (organization_id, scenario_id, strategy_id, metric_key, segment, synthetic, mean_value, median_value,
           p10_value, p90_value, variance_value, direction_consistency, metadata)
         values ($1,$2,$3,$4,$5,true,$6,$7,$8,$9,$10,$11,$12::jsonb)`,
        [organizationId, scenarioId, metric.strategyId ?? null, metric.key, metric.segment ?? null, metric.mean ?? null, metric.median ?? null, metric.p10 ?? null, metric.p90 ?? null, metric.variance ?? null, metric.directionConsistency ?? null, JSON.stringify(metric.metadata ?? {})],
      );
    }

    await client.query(
      `insert into scenario_comparisons
        (id, organization_id, scenario_id, baseline_strategy_id, strategy_ranking, sensitivity, evidence_coverage,
         run_count, failed_run_count, evaluator_version, generated_at)
       values ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10,$11)`,
      [comparisonId, organizationId, scenarioId, result.brief.baselineStrategyId ?? null, JSON.stringify(result.evaluation.strategyRanking), JSON.stringify(result.evaluation.sensitivity), result.evaluation.evidenceCoverage, result.evaluation.runCount, result.evaluation.failedRunCount, "scenario-evaluator@1", result.evaluation.generatedAt],
    );
    await client.query(
      `insert into scenario_reports
        (id, organization_id, scenario_id, comparison_id, synthetic, report_kind, question, recommendation,
         strongest_effects, uncertainty, segment_impacts, critical_assumptions, sensitivity_findings,
         council_disagreements, evidence_coverage, confidence_components, confidence_composite,
         confidence_formula_version, next_validation_steps, provenance)
       values ($1,$2,$3,$4,true,'decision_brief',$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,
               $12::jsonb,$13,$14::jsonb,$15,$16,$17::jsonb,$18::jsonb)`,
      [
        reportId, organizationId, scenarioId, comparisonId, result.brief.question, result.brief.recommendation ?? null,
        JSON.stringify(result.brief.strongestEffects), JSON.stringify(result.brief.uncertainty), JSON.stringify(result.brief.segmentImpacts),
        JSON.stringify(result.brief.criticalAssumptions), JSON.stringify(result.brief.sensitivityFindings), JSON.stringify(result.brief.councilDisagreements),
        result.brief.evidenceCoverage, JSON.stringify(result.brief.confidence.components), result.brief.confidence.composite,
        result.brief.confidence.formulaVersion, JSON.stringify(result.brief.nextValidationSteps),
        JSON.stringify({ ...result.brief.provenance, synthetic: true, councilReview: result.review.summary }),
      ],
    );
    await client.query(
      `insert into event_log (organization_id, event_type, entity_kind, entity_id, payload, metadata)
       values ($1, 'scenario.report_generated', 'scenario', $2,
         jsonb_build_object('report_id', $3, 'comparison_id', $4, 'run_count', $5),
         jsonb_build_object('synthetic', true, 'source', 'scenario_lab'))`,
      [organizationId, scenarioId, reportId, comparisonId, result.runs.length],
    );
    await transitionTx(client, organizationId, scenarioId, "ANALYZING", "COMPLETED");
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    const message = error instanceof Error ? error.message : "Scenario persistence failed.";
    await markFailed(db, organizationId, scenarioId, message).catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }

  return {
    scenarioId,
    organizationId,
    status: "COMPLETED",
    runCount: result.runs.length,
    reportId,
    comparisonId,
    engine: result.runs[0]?.engine ?? engine.name,
  };
}
