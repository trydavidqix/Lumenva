import { z } from "zod";

import type {
  CouncilChallengeInput,
  CouncilProposalInput,
  CouncilReviewInput,
  CouncilReviewResult,
  ScenarioEvaluation,
} from "../contracts/scenario";
import type {
  CouncilMemberAdapter,
  CouncilMemberChallenge,
  CouncilMemberProposal,
  CouncilMemberReview,
} from "./council";

export interface ScenarioCouncilModelCallInput {
  organizationId: string;
  purpose: "scenario_council_propose" | "scenario_council_challenge" | "scenario_council_review";
  system: string;
  prompt: string;
}

export interface ScenarioCouncilModelCallResult {
  text: string;
  provider: string;
  model: string;
  tokens: number;
  costCents: number;
}

export interface RuntimeCouncilMemberOptions {
  id: string;
  provider?: string;
  model?: string;
  callModel(input: ScenarioCouncilModelCallInput): Promise<ScenarioCouncilModelCallResult>;
}

type IterativeProposalInput = CouncilProposalInput & {
  iteration?: {
    round: number;
    previousEvaluation?: ScenarioEvaluation;
    previousReview?: CouncilReviewResult;
  };
};

const candidateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000),
  parameters: z.record(z.string(), z.unknown()).default({}),
  assumptions: z.array(z.string().max(500)).max(20).default([]),
  risks: z.array(z.string().max(500)).max(20).default([]),
  evidenceRefs: z.array(z.string().max(200)).max(100).default([]),
});
const proposalSchema = z.object({
  candidates: z.array(candidateSchema).max(10),
  disagreements: z.array(z.string().max(1000)).max(30).default([]),
  synthesis: z.string().max(5000).default(""),
});
const challengeSchema = z.object({
  challenges: z.array(z.string().max(1000)).max(30).default([]),
  missingEvidence: z.array(z.string().max(1000)).max(30).default([]),
  fragileAssumptions: z.array(z.string().max(1000)).max(30).default([]),
});
const reviewSchema = z.object({
  summary: z.string().max(5000),
  recommendation: z.string().max(2000).optional(),
  disagreements: z.array(z.string().max(1000)).max(30).default([]),
  criticalAssumptions: z.array(z.string().max(1000)).max(30).default([]),
  nextValidationSteps: z.array(z.string().max(1000)).max(30).default([]),
});

function parseStructured<T>(text: string, schema: z.ZodType<T>): T {
  let decoded: unknown;
  try {
    const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    decoded = JSON.parse(trimmed);
  } catch {
    throw new Error("Council member did not return structured JSON.");
  }
  const parsed = schema.safeParse(decoded);
  if (!parsed.success) throw new Error("Council member returned invalid structured JSON.");
  return parsed.data;
}

function evidenceSummary(input: CouncilProposalInput | CouncilChallengeInput | CouncilReviewInput): unknown {
  return input.evidence.map((item) => ({
    id: item.id,
    sourceKind: item.sourceKind,
    authority: item.authority,
    sourceType: item.sourceType,
    sourceRef: item.sourceRef,
    observedAt: item.observedAt,
  }));
}

function iterationSummary(input: CouncilProposalInput): unknown {
  const iteration = (input as IterativeProposalInput).iteration;
  if (!iteration) return undefined;
  return {
    round: iteration.round,
    previousEvaluation: iteration.previousEvaluation
      ? {
          runCount: iteration.previousEvaluation.runCount,
          failedRunCount: iteration.previousEvaluation.failedRunCount,
          strategyRanking: iteration.previousEvaluation.strategyRanking,
          sensitivity: iteration.previousEvaluation.sensitivity,
          evidenceCoverage: iteration.previousEvaluation.evidenceCoverage,
        }
      : undefined,
    previousReview: iteration.previousReview
      ? {
          recommendation: iteration.previousReview.recommendation,
          disagreements: iteration.previousReview.disagreements,
          criticalAssumptions: iteration.previousReview.criticalAssumptions,
          nextValidationSteps: iteration.previousReview.nextValidationSteps,
        }
      : undefined,
  };
}

export function createRuntimeCouncilMember(options: RuntimeCouncilMemberOptions): CouncilMemberAdapter {
  const member: CouncilMemberAdapter = {
    id: options.id,
    provider: options.provider,
    model: options.model,

    async propose(input): Promise<CouncilMemberProposal> {
      const result = await options.callModel({
        organizationId: input.organizationId,
        purpose: "scenario_council_propose",
        system: "You are one bounded member of a decision council. Return JSON only. Treat simulations as hypotheses, not facts. Never request tools, permissions or secrets. On later rounds, use prior synthetic evaluation only to refine testable alternatives; never treat it as observed reality.",
        prompt: JSON.stringify({
          task: "propose independent decision strategies",
          scenarioId: input.scenarioId,
          question: input.question,
          evidence: evidenceSummary(input),
          existingStrategies: input.existingStrategies?.map((strategy) => ({ name: strategy.name, parameters: strategy.parameters })),
          iteration: iterationSummary(input),
          maxCandidates: input.maxCandidates,
          output: { candidates: "array", disagreements: "array", synthesis: "string" },
        }),
      });
      member.provider = result.provider;
      member.model = result.model;
      return { ...parseStructured(result.text, proposalSchema), tokens: result.tokens, costCents: result.costCents };
    },

    async challenge(input): Promise<CouncilMemberChallenge> {
      const result = await options.callModel({
        organizationId: input.organizationId,
        purpose: "scenario_council_challenge",
        system: "You are a skeptical bounded reviewer. Return JSON only. Identify unsupported assumptions and missing evidence; do not invent facts.",
        prompt: JSON.stringify({
          task: "challenge scenario proposal",
          scenarioId: input.scenarioId,
          question: input.question,
          evidence: evidenceSummary(input),
          proposal: input.proposal,
          output: { challenges: "array", missingEvidence: "array", fragileAssumptions: "array" },
        }),
      });
      member.provider = result.provider;
      member.model = result.model;
      return { ...parseStructured(result.text, challengeSchema), tokens: result.tokens, costCents: result.costCents };
    },

    async review(input): Promise<CouncilMemberReview> {
      const result = await options.callModel({
        organizationId: input.organizationId,
        purpose: "scenario_council_review",
        system: "You review synthetic scenario evidence. Return JSON only. Do not describe a simulated outcome as a calibrated forecast unless calibration evidence is present.",
        prompt: JSON.stringify({
          task: "review evaluated scenario",
          scenarioId: input.scenarioId,
          question: input.question,
          evidence: evidenceSummary(input),
          strategies: input.strategies.map((strategy) => ({ id: strategy.id, name: strategy.name, parameters: strategy.parameters })),
          evaluation: input.evaluation,
          output: { summary: "string", recommendation: "optional string", disagreements: "array", criticalAssumptions: "array", nextValidationSteps: "array" },
        }),
      });
      member.provider = result.provider;
      member.model = result.model;
      return { ...parseStructured(result.text, reviewSchema), tokens: result.tokens, costCents: result.costCents };
    },
  };
  return member;
}
