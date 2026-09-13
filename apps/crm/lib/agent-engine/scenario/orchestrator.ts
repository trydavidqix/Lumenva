import { randomUUID } from "node:crypto";

import type {
  CompiledScenarioEntity,
  CouncilChallengeResult,
  CouncilPort,
  CouncilProposalResult,
  CouncilReviewResult,
  ScenarioActorTemplate,
  ScenarioAssumption,
  ScenarioBudget,
  ScenarioDecisionBrief,
  ScenarioEvaluation,
  ScenarioEvaluator,
  ScenarioEvidenceItem,
  ScenarioStrategy,
  SimulationArtifacts,
  SimulationEnginePort,
  SimulationRunRecord,
} from "../contracts/scenario";
import { calculateScenarioConfidence } from "./confidence";
import { compileScenario } from "./compiler";
import { createDecisionBrief } from "./decision-brief";
import { buildSyntheticPopulation } from "./population";
import { runSimulation } from "./simulation-kernel";

export interface ScenarioOrchestratorDependencies {
  council: CouncilPort;
  engine: SimulationEnginePort;
  evaluator: ScenarioEvaluator;
  now?: () => Date;
  id?: () => string;
}

export interface ExecuteScenarioInput {
  organizationId: string;
  scenarioId: string;
  question: string;
  compilerVersion: string;
  generatorVersion: string;
  evidence: ScenarioEvidenceItem[];
  assumptions: ScenarioAssumption[];
  strategies: ScenarioStrategy[];
  actorTemplates: ScenarioActorTemplate[];
  entities: CompiledScenarioEntity[];
  parameters: Record<string, unknown>;
  seeds: number[];
  populationSize: number;
  rounds: number;
  budget: ScenarioBudget;
}

export interface ScenarioOrchestrationResult {
  proposal: CouncilProposalResult;
  challenge: CouncilChallengeResult;
  review: CouncilReviewResult;
  strategies: ScenarioStrategy[];
  runs: SimulationRunRecord[];
  artifacts: SimulationArtifacts[];
  evaluation: ScenarioEvaluation;
  brief: ScenarioDecisionBrief;
}

function uniqueStrategies(base: ScenarioStrategy[], proposal: CouncilProposalResult, input: ExecuteScenarioInput): ScenarioStrategy[] {
  const strategies = [...base];
  const keys = new Set(base.map((strategy) => JSON.stringify([strategy.name.toLowerCase(), strategy.parameters])));
  for (const [index, candidate] of proposal.candidates.entries()) {
    const key = JSON.stringify([candidate.name.toLowerCase(), candidate.parameters]);
    if (keys.has(key)) continue;
    keys.add(key);
    strategies.push({
      id: `council-${input.scenarioId}-${index + 1}`,
      organizationId: input.organizationId,
      scenarioId: input.scenarioId,
      name: candidate.name,
      description: candidate.description,
      parameters: candidate.parameters,
      isBaseline: false,
      source: "council",
      evidenceRefs: candidate.evidenceRefs,
    });
  }
  return strategies.slice(0, 5);
}

function dataFreshness(evidence: ScenarioEvidenceItem[], now: Date): number {
  if (evidence.length === 0) return 0;
  const day = 86_400_000;
  const scores = evidence.map((item) => {
    const time = Date.parse(item.observedAt ?? item.retrievedAt);
    if (!Number.isFinite(time)) return 0;
    const ageDays = Math.max(0, (now.getTime() - time) / day);
    if (ageDays <= 30) return 1;
    if (ageDays <= 90) return 0.8;
    if (ageDays <= 180) return 0.6;
    if (ageDays <= 365) return 0.4;
    return 0.2;
  });
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function modelAgreement(review: CouncilReviewResult): number {
  const successful = review.memberProvenance.filter((member) => member.status === "ok").length;
  if (successful === 0) return 0;
  const disagreementPenalty = Math.min(1, review.disagreements.length / Math.max(1, successful * 2));
  return 1 - disagreementPenalty;
}

export function createScenarioOrchestrator(deps: ScenarioOrchestratorDependencies) {
  const now = deps.now ?? (() => new Date());
  const id = deps.id ?? randomUUID;

  return {
    async execute(input: ExecuteScenarioInput): Promise<ScenarioOrchestrationResult> {
      if (input.strategies.filter((strategy) => strategy.isBaseline).length !== 1) {
        throw new Error("Scenario orchestration requires exactly one baseline strategy.");
      }
      if (input.seeds.length === 0) throw new Error("Scenario orchestration requires at least one seed.");

      const proposal = await deps.council.propose({
        organizationId: input.organizationId,
        scenarioId: input.scenarioId,
        question: input.question,
        evidence: input.evidence,
        existingStrategies: input.strategies,
        maxCandidates: Math.max(0, 5 - input.strategies.length),
      });
      const challenge = await deps.council.challenge({
        organizationId: input.organizationId,
        scenarioId: input.scenarioId,
        question: input.question,
        proposal,
        evidence: input.evidence,
      });

      const strategies = uniqueStrategies(input.strategies, proposal, input);
      const requestedRunCount = strategies.length * input.seeds.length;
      if (requestedRunCount > input.budget.maxSimulationRuns) {
        throw new Error(`Scenario requires ${requestedRunCount} runs, exceeding the simulation-run budget of ${input.budget.maxSimulationRuns}.`);
      }

      const compiled = compileScenario({
        organizationId: input.organizationId,
        scenarioId: input.scenarioId,
        question: input.question,
        compilerVersion: input.compilerVersion,
        evidence: input.evidence,
        assumptions: input.assumptions,
        strategies,
        actorTemplates: input.actorTemplates,
        entities: input.entities,
        parameters: input.parameters,
        requireBaseline: true,
        now: now().toISOString(),
      });

      const deadline = Date.now() + input.budget.maxRuntimeMs;
      const runEntries: Array<{ run: SimulationRunRecord; artifacts: SimulationArtifacts }> = [];
      let failedRuns = 0;

      for (const strategy of strategies) {
        for (const seed of input.seeds) {
          if (Date.now() > deadline) throw new Error("Scenario orchestration exceeded its wall-clock budget.");
          const runId = id();
          const population = buildSyntheticPopulation({
            organizationId: input.organizationId,
            scenarioId: input.scenarioId,
            populationId: `population:${input.scenarioId}:${seed}`,
            version: 1,
            seed,
            size: input.populationSize,
            generatorVersion: input.generatorVersion,
            templates: input.actorTemplates,
            now: now().toISOString(),
          });
          const baseRun: SimulationRunRecord = {
            id: runId,
            organizationId: input.organizationId,
            scenarioId: input.scenarioId,
            strategyId: strategy.id,
            populationId: population.id,
            status: "RUNNING",
            seed,
            engine: deps.engine.name,
            engineVersion: deps.engine.version,
            compilerVersion: input.compilerVersion,
            budget: { maxRuntimeMs: input.budget.maxRuntimeMs, rounds: input.rounds },
            startedAt: now().toISOString(),
          };

          try {
            const remainingMs = Math.max(100, deadline - Date.now());
            const result = await runSimulation(deps.engine, {
              organizationId: input.organizationId,
              scenario: compiled,
              population,
              strategy,
              seed,
              rounds: input.rounds,
              runId,
              maxRuntimeMs: remainingMs,
            });
            runEntries.push({
              run: { ...baseRun, status: result.status, endedAt: now().toISOString() },
              artifacts: result.artifacts,
            });
          } catch (error) {
            failedRuns += 1;
            const message = error instanceof Error ? error.message : "Simulation failed.";
            runEntries.push({
              run: { ...baseRun, status: "FAILED", endedAt: now().toISOString(), errorMessage: message.slice(0, 500) },
              artifacts: {
                provenance: {
                  synthetic: true,
                  scenarioId: input.scenarioId,
                  runId,
                  seed,
                  engineVersion: deps.engine.version,
                  evidenceRefs: input.evidence.map((item) => item.id),
                },
                events: [],
                outcomes: [],
                metrics: {},
              },
            });
            if (failedRuns > input.budget.maxFailedRuns) {
              throw new Error(`Scenario exceeded the failed-run budget (${input.budget.maxFailedRuns}).`);
            }
          }
        }
      }

      const evaluation = await deps.evaluator.evaluate({
        scenarioId: input.scenarioId,
        strategies,
        runs: runEntries,
        evidenceCount: input.evidence.length,
        expectedEvidenceCount: Math.max(1, input.evidence.length + challenge.missingEvidence.length),
      });
      const review = await deps.council.review({
        organizationId: input.organizationId,
        scenarioId: input.scenarioId,
        question: input.question,
        evaluation,
        strategies,
        evidence: input.evidence,
      });

      const stableCount = evaluation.strategyRanking.filter((entry) => entry.stable).length;
      const confidence = calculateScenarioConfidence({
        runStability: evaluation.strategyRanking.length === 0 ? 0 : stableCount / evaluation.strategyRanking.length,
        evidenceCoverage: evaluation.evidenceCoverage,
        modelAgreement: modelAgreement(review),
        sensitivityStability: evaluation.sensitivity.length === 0
          ? 0.5
          : evaluation.sensitivity.filter((item) => item.stable).length / evaluation.sensitivity.length,
        historicalCalibration: null,
        engineReliability: requestedRunCount === 0 ? 0 : (requestedRunCount - failedRuns) / requestedRunCount,
        dataFreshness: dataFreshness(input.evidence, now()),
      });

      const runs = runEntries.map((entry) => entry.run);
      const brief = createDecisionBrief({
        scenarioId: input.scenarioId,
        question: input.question,
        strategies,
        evaluation,
        review,
        confidence,
        evidence: input.evidence,
        runs,
      });

      return {
        proposal,
        challenge,
        review,
        strategies,
        runs,
        artifacts: runEntries.map((entry) => entry.artifacts),
        evaluation,
        brief,
      };
    },
  };
}
