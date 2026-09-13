export const SCENARIO_STATUSES = [
  "DRAFT",
  "EVIDENCE_READY",
  "COMPILED",
  "READY",
  "RUNNING",
  "ANALYZING",
  "COMPLETED",
  "CANCELLED",
  "FAILED",
  "EXPIRED",
] as const;

export type ScenarioStatus = (typeof SCENARIO_STATUSES)[number];

export const SCENARIO_SOURCE_KINDS = [
  "observed_fact",
  "derived_fact",
  "user_assumption",
  "council_hypothesis",
  "simulation_parameter",
] as const;

export type ScenarioSourceKind = (typeof SCENARIO_SOURCE_KINDS)[number];

export const EVIDENCE_AUTHORITY_LEVELS = [
  "authoritative_crm",
  "published_knowledge",
  "derived_memory",
  "external_research",
  "model_prior",
] as const;

export type EvidenceAuthorityLevel = (typeof EVIDENCE_AUTHORITY_LEVELS)[number];

export const SCENARIO_ENGINE_MODES = ["off", "shadow", "on"] as const;
export type ScenarioEngineMode = (typeof SCENARIO_ENGINE_MODES)[number];

export interface ScenarioProvenance {
  sourceKind: ScenarioSourceKind;
  sourceRef?: string;
  evidenceRefs: string[];
  createdAt: string;
  generatorVersion?: string;
  modelVersion?: string;
}

export interface ScenarioBudget {
  maxCouncilRounds: number;
  maxSimulationRuns: number;
  maxRuntimeMs: number;
  maxTokens?: number;
  maxCostCents?: number;
  maxFailedRuns: number;
  minimumImprovement?: number;
  noProgressLimit: number;
}

export interface ScenarioDefinition {
  id: string;
  organizationId: string;
  question: string;
  title?: string;
  status: ScenarioStatus;
  decisionVariables: Record<string, unknown>;
  constraints: Record<string, unknown>;
  budget: ScenarioBudget;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScenarioEvidenceItem {
  id: string;
  organizationId: string;
  scenarioId: string;
  sourceKind: ScenarioSourceKind;
  authority: EvidenceAuthorityLevel;
  sourceType: string;
  sourceRef: string;
  observedAt?: string;
  retrievedAt: string;
  content: unknown;
  provenance: Record<string, unknown>;
}

export interface ScenarioAssumption {
  id: string;
  organizationId: string;
  scenarioId: string;
  statement: string;
  sourceKind: Extract<ScenarioSourceKind, "user_assumption" | "council_hypothesis" | "simulation_parameter">;
  sensitivityKey?: string;
  value?: unknown;
  evidenceRefs: string[];
}

export interface ScenarioStrategy {
  id: string;
  organizationId: string;
  scenarioId: string;
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  isBaseline: boolean;
  source: "user" | "council" | "system";
  evidenceRefs: string[];
}

export interface ScenarioActorTemplate {
  id: string;
  organizationId: string;
  scenarioId: string;
  key: string;
  label: string;
  weight: number;
  traits: Record<string, unknown>;
  incentives: Record<string, unknown>;
  constraints: Record<string, unknown>;
  evidenceRefs: string[];
}

export interface SyntheticActor {
  id: string;
  synthetic: true;
  scenarioId: string;
  populationId: string;
  actorTemplateId: string;
  seed: number;
  generatorVersion: string;
  traits: Record<string, unknown>;
  evidenceRefs: string[];
  createdAt: string;
}

export interface ScenarioPopulation {
  id: string;
  organizationId: string;
  scenarioId: string;
  version: number;
  seed: number;
  size: number;
  generatorVersion: string;
  actors: SyntheticActor[];
  config: Record<string, unknown>;
}

export interface CompiledScenarioEntity {
  id: string;
  kind:
    | "Actor"
    | "CustomerSegment"
    | "Organization"
    | "Competitor"
    | "Product"
    | "Offer"
    | "Market"
    | "Channel"
    | "EmployeeRole"
    | "Regulator"
    | "Resource"
    | "Constraint"
    | "Incentive"
    | "Decision"
    | "Event"
    | "Relationship"
    | "KPI";
  label: string;
  attributes: Record<string, unknown>;
  provenance: ScenarioProvenance;
}

export interface CompiledScenario {
  scenarioId: string;
  organizationId: string;
  compilerVersion: string;
  question: string;
  evidence: ScenarioEvidenceItem[];
  assumptions: ScenarioAssumption[];
  strategies: ScenarioStrategy[];
  actorTemplates: ScenarioActorTemplate[];
  entities: CompiledScenarioEntity[];
  parameters: Record<string, unknown>;
  compiledAt: string;
}

export const SIMULATION_RUN_STATUSES = [
  "PENDING",
  "PREPARING",
  "RUNNING",
  "COMPLETED",
  "CANCELLED",
  "FAILED",
  "TIMED_OUT",
] as const;

export type SimulationRunStatus = (typeof SIMULATION_RUN_STATUSES)[number];

export interface SimulationRunHandle {
  id: string;
  engine: string;
  externalId?: string;
}

export interface SimulationRunRecord {
  id: string;
  organizationId: string;
  scenarioId: string;
  strategyId: string;
  populationId: string;
  status: SimulationRunStatus;
  seed: number;
  engine: string;
  engineVersion: string;
  compilerVersion: string;
  councilConfigHash?: string;
  budget: Record<string, unknown>;
  startedAt?: string;
  endedAt?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface SimulationProgressEvent {
  kind: string;
  occurredAt: string;
  round?: number;
  actorId?: string;
  payload: Record<string, unknown>;
}

export interface SyntheticArtifactProvenance {
  synthetic: true;
  scenarioId: string;
  runId: string;
  seed: number;
  engineVersion: string;
  modelVersion?: string;
  evidenceRefs?: string[];
  createdAt?: string;
}

export interface SimulationArtifacts {
  provenance: SyntheticArtifactProvenance;
  events: SimulationProgressEvent[];
  outcomes: Array<{
    key: string;
    value: number | string | boolean | null;
    segment?: string;
    metadata?: Record<string, unknown>;
  }>;
  metrics: Record<string, number>;
  rawArtifactRefs?: string[];
}

export interface PrepareSimulationInput {
  organizationId: string;
  scenario: CompiledScenario;
  population: ScenarioPopulation;
  strategy: ScenarioStrategy;
  seed: number;
  rounds: number;
}

export interface PreparedSimulation {
  preparationId: string;
  engine: string;
  engineVersion: string;
  sanitizedPayloadHash: string;
}

export interface RunSimulationInput {
  organizationId: string;
  scenarioId: string;
  runId: string;
  prepared: PreparedSimulation;
  budget: {
    maxRuntimeMs: number;
    maxRounds: number;
  };
}

export interface SimulationEnginePort {
  readonly name: string;
  readonly version: string;
  prepare(input: PrepareSimulationInput): Promise<PreparedSimulation>;
  run(input: RunSimulationInput): Promise<SimulationRunHandle>;
  status(handle: SimulationRunHandle): Promise<SimulationRunStatus>;
  cancel(handle: SimulationRunHandle): Promise<void>;
  collectArtifacts(handle: SimulationRunHandle): Promise<SimulationArtifacts>;
}

export interface CouncilMemberProvenance {
  memberId: string;
  provider?: string;
  model?: string;
  latencyMs?: number;
  tokens?: number;
  costCents?: number;
  status: "ok" | "failed" | "skipped";
  error?: string;
}

export interface CouncilStrategyCandidate {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  assumptions: string[];
  risks: string[];
  evidenceRefs: string[];
}

export interface CouncilProposalInput {
  organizationId: string;
  scenarioId: string;
  question: string;
  evidence: ScenarioEvidenceItem[];
  existingStrategies?: ScenarioStrategy[];
  maxCandidates: number;
}

export interface CouncilProposalResult {
  candidates: CouncilStrategyCandidate[];
  disagreements: string[];
  memberProvenance: CouncilMemberProvenance[];
  synthesis: string;
}

export interface CouncilChallengeInput {
  organizationId: string;
  scenarioId: string;
  question: string;
  proposal: CouncilProposalResult;
  evidence: ScenarioEvidenceItem[];
}

export interface CouncilChallengeResult {
  challenges: string[];
  missingEvidence: string[];
  fragileAssumptions: string[];
  memberProvenance: CouncilMemberProvenance[];
}

export interface ScenarioEvaluationMetric {
  key: string;
  strategyId?: string;
  segment?: string;
  mean?: number;
  median?: number;
  p10?: number;
  p90?: number;
  variance?: number;
  directionConsistency?: number;
  metadata?: Record<string, unknown>;
}

export interface ScenarioEvaluation {
  scenarioId: string;
  runCount: number;
  failedRunCount: number;
  strategyRanking: Array<{ strategyId: string; score: number; stable: boolean }>;
  metrics: ScenarioEvaluationMetric[];
  sensitivity: Array<{ assumptionKey: string; impact: number; stable: boolean }>;
  evidenceCoverage: number;
  generatedAt: string;
}

export interface CouncilReviewInput {
  organizationId: string;
  scenarioId: string;
  question: string;
  evaluation: ScenarioEvaluation;
  strategies: ScenarioStrategy[];
  evidence: ScenarioEvidenceItem[];
}

export interface CouncilReviewResult {
  summary: string;
  recommendation?: string;
  disagreements: string[];
  criticalAssumptions: string[];
  nextValidationSteps: string[];
  memberProvenance: CouncilMemberProvenance[];
}

export interface CouncilPort {
  propose(input: CouncilProposalInput): Promise<CouncilProposalResult>;
  challenge(input: CouncilChallengeInput): Promise<CouncilChallengeResult>;
  review(input: CouncilReviewInput): Promise<CouncilReviewResult>;
}

export interface ScenarioConfidenceComponents {
  runStability: number;
  evidenceCoverage: number;
  modelAgreement: number;
  sensitivityStability: number;
  historicalCalibration: number | null;
  engineReliability: number;
  dataFreshness: number;
}

export interface ScenarioConfidence {
  components: ScenarioConfidenceComponents;
  composite: number | null;
  formulaVersion: string;
  reasons: string[];
}

export interface ScenarioDecisionBrief {
  scenarioId: string;
  question: string;
  baselineStrategyId?: string;
  comparedStrategyIds: string[];
  strongestEffects: string[];
  uncertainty: string[];
  segmentImpacts: string[];
  criticalAssumptions: string[];
  sensitivityFindings: string[];
  councilDisagreements: string[];
  evidenceCoverage: number;
  confidence: ScenarioConfidence;
  calibrationContext?: string;
  recommendation?: string;
  nextValidationSteps: string[];
  provenance: {
    reportId?: string;
    runIds: string[];
    evidenceRefs: string[];
  };
}

export interface ScenarioEvaluationInput {
  scenarioId: string;
  strategies: ScenarioStrategy[];
  runs: Array<{ run: SimulationRunRecord; artifacts: SimulationArtifacts }>;
  evidenceCount: number;
  expectedEvidenceCount: number;
}

export interface ScenarioEvaluator {
  evaluate(input: ScenarioEvaluationInput): Promise<ScenarioEvaluation>;
}
