export interface ScenarioReadDb {
  query(text: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
}

export interface ScenarioWorkspace {
  scenario: Record<string, unknown>;
  evidence: Array<Record<string, unknown>>;
  assumptions: Array<Record<string, unknown>>;
  strategies: Array<Record<string, unknown>>;
  actorTemplates: Array<Record<string, unknown>>;
  runs: Array<Record<string, unknown>>;
  latestReport: Record<string, unknown> | null;
}

function camelScenario(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    organizationId: row.organization_id,
    title: row.title ?? null,
    question: row.question,
    status: row.status,
    decisionVariables: row.decision_variables ?? {},
    constraints: row.constraints ?? {},
    budget: row.budget ?? {},
    compilerVersion: row.compiler_version ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    completedAt: row.completed_at ?? null,
  };
}

function camelEvidence(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    sourceKind: row.source_kind,
    authority: row.authority,
    sourceType: row.source_type,
    sourceRef: row.source_ref,
    observedAt: row.observed_at ?? null,
    retrievedAt: row.retrieved_at,
    content: row.content ?? {},
    provenance: row.provenance ?? {},
  };
}

function camelAssumption(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    statement: row.statement,
    sourceKind: row.source_kind,
    sensitivityKey: row.sensitivity_key ?? null,
    value: row.value ?? null,
    evidenceRefs: row.evidence_refs ?? [],
  };
}

function camelStrategy(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    parameters: row.parameters ?? {},
    isBaseline: row.is_baseline,
    source: row.source,
    evidenceRefs: row.evidence_refs ?? [],
    createdAt: row.created_at ?? null,
  };
}

function camelActorTemplate(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    weight: Number(row.weight ?? 0),
    traits: row.traits ?? {},
    incentives: row.incentives ?? {},
    constraints: row.constraints ?? {},
    evidenceRefs: row.evidence_refs ?? [],
  };
}

function camelRun(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    strategyId: row.strategy_id,
    populationId: row.population_id,
    status: row.status,
    seed: Number(row.seed),
    engine: row.engine,
    engineVersion: row.engine_version,
    compilerVersion: row.compiler_version,
    budget: row.budget ?? {},
    startedAt: row.started_at ?? null,
    endedAt: row.ended_at ?? null,
    errorCode: row.error_code ?? null,
    errorMessage: row.error_message ?? null,
  };
}

function camelReport(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    comparisonId: row.comparison_id ?? null,
    reportKind: row.report_kind,
    question: row.question,
    recommendation: row.recommendation ?? null,
    strongestEffects: row.strongest_effects ?? [],
    uncertainty: row.uncertainty ?? [],
    segmentImpacts: row.segment_impacts ?? [],
    criticalAssumptions: row.critical_assumptions ?? [],
    sensitivityFindings: row.sensitivity_findings ?? [],
    councilDisagreements: row.council_disagreements ?? [],
    evidenceCoverage: Number(row.evidence_coverage ?? 0),
    confidenceComponents: row.confidence_components ?? {},
    confidenceComposite: row.confidence_composite === null || row.confidence_composite === undefined
      ? null
      : Number(row.confidence_composite),
    confidenceFormulaVersion: row.confidence_formula_version,
    nextValidationSteps: row.next_validation_steps ?? [],
    provenance: row.provenance ?? {},
    createdAt: row.created_at ?? null,
  };
}

export async function loadScenarioWorkspace(
  db: ScenarioReadDb,
  organizationId: string,
  scenarioId: string,
): Promise<ScenarioWorkspace | null> {
  const scenarioResult = await db.query(
    `select id, organization_id, title, question, status, decision_variables, constraints, budget,
            compiler_version, created_at, updated_at, completed_at
       from scenario_definitions
      where organization_id = $1 and id = $2
      limit 1`,
    [organizationId, scenarioId],
  );
  const scenarioRow = scenarioResult.rows[0];
  if (!scenarioRow) return null;

  const [evidenceResult, assumptionsResult, strategiesResult, actorTemplatesResult, runsResult, reportResult] = await Promise.all([
    db.query(
      `select id, source_kind, authority, source_type, source_ref, observed_at, retrieved_at, content, provenance
         from scenario_evidence
        where organization_id = $1 and scenario_id = $2
        order by created_at asc`,
      [organizationId, scenarioId],
    ),
    db.query(
      `select id, statement, source_kind, sensitivity_key, value, evidence_refs
         from scenario_assumptions
        where organization_id = $1 and scenario_id = $2
        order by created_at asc`,
      [organizationId, scenarioId],
    ),
    db.query(
      `select id, name, description, parameters, is_baseline, source, evidence_refs, created_at
         from scenario_strategies
        where organization_id = $1 and scenario_id = $2
        order by is_baseline desc, created_at asc`,
      [organizationId, scenarioId],
    ),
    db.query(
      `select id, key, label, weight, traits, incentives, constraints, evidence_refs
         from scenario_actor_templates
        where organization_id = $1 and scenario_id = $2
        order by created_at asc`,
      [organizationId, scenarioId],
    ),
    db.query(
      `select id, strategy_id, population_id, status, seed, engine, engine_version, compiler_version,
              budget, started_at, ended_at, error_code, error_message
         from scenario_runs
        where organization_id = $1 and scenario_id = $2
        order by created_at desc
        limit 100`,
      [organizationId, scenarioId],
    ),
    db.query(
      `select id, comparison_id, report_kind, question, recommendation, strongest_effects, uncertainty,
              segment_impacts, critical_assumptions, sensitivity_findings, council_disagreements,
              evidence_coverage, confidence_components, confidence_composite, confidence_formula_version,
              next_validation_steps, provenance, created_at
         from scenario_reports
        where organization_id = $1 and scenario_id = $2 and report_kind = 'decision_brief'
        order by created_at desc
        limit 1`,
      [organizationId, scenarioId],
    ),
  ]);

  return {
    scenario: camelScenario(scenarioRow),
    evidence: evidenceResult.rows.map(camelEvidence),
    assumptions: assumptionsResult.rows.map(camelAssumption),
    strategies: strategiesResult.rows.map(camelStrategy),
    actorTemplates: actorTemplatesResult.rows.map(camelActorTemplate),
    runs: runsResult.rows.map(camelRun),
    latestReport: reportResult.rows[0] ? camelReport(reportResult.rows[0]) : null,
  };
}
