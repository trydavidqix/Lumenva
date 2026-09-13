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

export interface ScenarioCouncilRound {
  round: number;
  proposal: CouncilProposalResult;
  challenge: CouncilChallengeResult;
  review: CouncilReviewResult;
  evaluation: ScenarioEvaluation;
  addedStrategyIds: string[];
}

export interface ScenarioOrchestrationResult {
  proposal: CouncilProposalResult;
  challenge: CouncilChallengeResult;
  review: CouncilReviewResult;
  councilRounds: ScenarioCouncilRound[];
  strategies: ScenarioStrategy[];
  runs: SimulationRunRecord[];
  artifacts: SimulationArtifacts[];
  evaluation: ScenarioEvaluation;
  brief: ScenarioDecisionBrief;
}

function uniqueStrategies(base: ScenarioStrategy[], proposal: CouncilProposalResult, input: ExecuteScenarioInput): ScenarioStrategy[] {
  const strategies = [...base];
  const keys = new Set(base.map((strategy) => JSON.stringify([strategy.name.toLowerCase(), strategy.parameters])));
  let ordinal = base.length;
  for (const candidate of proposal.candidates) {
    const key = JSON.stringify([candidate.name.toLowerCase(), candidate.parameters]);
    if (keys.has(key) || strategies.length >= 5) continue;
    keys.add(key);
    ordinal += 1;
    strategies.push({
      id: `council-${input.scenarioId}-${ordinal}`,
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
  return strategies;
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

function bestScore(evaluation: ScenarioEvaluation | undefined): number | null {
  const score = evaluation?.strategyRanking[0]?.score;
  return typeof score === "number" && Number.isFinite(score) ? score : null;
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
      if (input.budget.maxCouncilRounds < 1) throw new Error("Scenario orchestration requires at least one Council round.");
      if (input.budget.maxSimulationRuns < 1) throw new Error("Scenario orchestration requires a positive simulation-run budget.");

      const deadline = Date.now() + input.budget.maxRuntimeMs;
      const runEntries: Array<{ run: SimulationRunRecord; artifacts: SimulationArtifacts }> = [];
      const councilRounds: ScenarioCouncilRound[] = [];
      const missingEvidence = new Set<string>();
      let failedRuns = 0;
      let strategies = [...input.strategies];
      let previousEvaluation: ScenarioEvaluation | undefined;
      let previousReview: CouncilReviewResult | undefined;
      let noProgressRounds = 0;
      let finalProposal: CouncilProposalResult | undefined;
      let finalChallenge: CouncilChallengeResult | undefined;
      let finalReview: CouncilReviewResult | undefined;
      let finalEvaluation: ScenarioEvaluation | undefined;

      const runStrategies = async (batch: ScenarioStrategy[], allStrategies: ScenarioStrategy[]): Promise<void> => {
        const additionalRuns = batch.length * input.seeds.length;
        if (runEntries.length + additionalRuns > input.budget.maxSimulationRuns) {
          throw new Error(
            `Scenario requires ${runEntries.length + additionalRuns} runs, exceeding the simulation-run budget of ${input.budget.maxSimulationRuns}.`,
          );
        }
        const compiled = compileScenario({
          organizationId: input.organizationId,
          scenarioId: input.scenarioId,
          question: input.question,
          compilerVersion: input.compilerVersion,
          evidence: input.evidence,
          assumptions: input.assumptions,
          strategies: allStrategies,
          actorTemplates: input.actorTemplates,
          entities: input.entities,
          parameters: input.parameters,
          requireBaseline: true,
          now: now().toISOString(),
        });

        for (const strategy of batch) {
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
      };

      for (let round = 1; round <= input.budget.maxCouncilRounds; round += 1) {
        if (Date.now() > deadline) throw new Error("Scenario orchestration exceeded its wall-clock budget.");
        if (round > 1 && runEntries.length + input.seeds.length > input.budget.maxSimulationRuns) break;
        if (round > 1 && strategies.length >= 5) break;

        const proposalInput = {
          organizationId: input.organizationId,
          scenarioId: input.scenarioId,
          question: input.question,
          evidence: input.evidence,
          existingStrategies: strategies,
          maxCandidates: Math.max(0, 5 - strategies.length),
          iteration: {
            round,
            previousEvaluation,
            previousReview,
          },
        };
        const proposal = await deps.council.propose(proposalInput);
        const challenge = await deps.council.challenge({
          organizationId: input.organizationId,
          scenarioId: input.scenarioId,
          question: input.question,
          proposal,
          evidence: input.evidence,
        });
        for (const item of challenge.missingEvidence) missingEvidence.add(item);

        const beforeIds = new Set(strategies.map((strategy) => strategy.id));
        const merged = uniqueStrategies(strategies, proposal, input);
        const added = merged.filter((strategy) => !beforeIds.has(strategy.id));
        const batch = round === 1 ? merged : added;

        if (round > 1 && added.length === 0) break;
        await runStrategies(batch, merged);
        strategies = merged;

        const evaluation = await deps.evaluator.evaluate({
          scenarioId: input.scenarioId,
          strategies,
          runs: runEntries,
          evidenceCount: input.evidence.length,
          expectedEvidenceCount: Math.max(1, input.evidence.length + missingEvidence.size),
        });
        const review = await deps.council.review({
          organizationId: input.organizationId,
          scenarioId: input.scenarioId,
          question: input.question,
          evaluation,
          strategies,
          evidence: input.evidence,
        });

        councilRounds.push({
          round,
          proposal,
          challenge,
          review,
          evaluation,
          addedStrategyIds: added.map((strategy) => strategy.id),
        });
        finalProposal = proposal;
        finalChallenge = challenge;
        finalReview = review;
        finalEvaluation = evaluation;

        const priorScore = bestScore(previousEvaluation);
        const currentScore = bestScore(evaluation);
        if (priorScore !== null && currentScore !== null && input.budget.minimumImprovement !== undefined) {
          if (currentScore - priorScore < input.budget.minimumImprovement) noProgressRounds += 1;
          else noProgressRounds = 0;
        } else if (added.length > 0 || round === 1) {
          noProgressRounds = 0;
        }
        previousEvaluation = evaluation;
        previousReview = review;

        if (noProgressRounds >= Math.max(1, input.budget.noProgressLimit)) break;
      }

      if (!finalProposal || !finalChallenge || !finalReview || !finalEvaluation) {
        throw new Error("Scenario orchestration ended before producing an evaluated Council round.");
      }

      const stableCount = finalEvaluation.strategyRanking.filter((entry) => entry.stable).length;
      const confidence = calculateScenarioConfidence({
        runStability: finalEvaluation.strategyRanking.length === 0 ? 0 : stableCount / finalEvaluation.strategyRanking.length,
        evidenceCoverage: finalEvaluation.evidenceCoverage,
        modelAgreement: modelAgreement(finalReview),
        sensitivityStability: finalEvaluation.sensitivity.length === 0
          ? 0.5
          : finalEvaluation.sensitivity.filter((item) => item.stable).length / finalEvaluation.sensitivity.length,
        historicalCalibration: null,
        engineReliability: runEntries.length === 0 ? 0 : (runEntries.length - failedRuns) / runEntries.length,
        dataFreshness: dataFreshness(input.evidence, now()),
      });

      const runs = runEntries.map((entry) => entry.run);
      const brief = createDecisionBrief({
        scenarioId: input.scenarioId,
        question: input.question,
        strategies,
        evaluation: finalEvaluation,
        review: finalReview,
        confidence,
        evidence: input.evidence,
        runs,
      });

      return {
        proposal: finalProposal,
        challenge: finalChallenge,
        review: finalReview,
        councilRounds,
        strategies,
        runs,
        artifacts: runEntries.map((entry) => entry.artifacts),
        evaluation: finalEvaluation,
        brief,
      };
    },
  };
}
