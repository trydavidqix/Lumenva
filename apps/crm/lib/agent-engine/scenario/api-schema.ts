import { z } from "zod";

import type { CreateScenarioInput, UpdateScenarioDraftInput } from "./repository";

const jsonObject = z.record(z.string(), z.unknown());
const budgetPatch = z.object({
  maxCouncilRounds: z.number().int().min(1).max(5).optional(),
  maxSimulationRuns: z.number().int().min(1).max(250).optional(),
  maxRuntimeMs: z.number().int().min(1_000).max(3_600_000).optional(),
  maxTokens: z.number().int().positive().optional(),
  maxCostCents: z.number().int().nonnegative().optional(),
  maxFailedRuns: z.number().int().min(0).max(25).optional(),
  minimumImprovement: z.number().nonnegative().optional(),
  noProgressLimit: z.number().int().min(1).max(5).optional(),
}).strict();

const createSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  question: z.string().trim().min(8).max(4_000),
  decisionVariables: jsonObject.optional(),
  constraints: jsonObject.optional(),
  budget: budgetPatch.optional(),
}).strict();

const updateSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  question: z.string().trim().min(8).max(4_000).optional(),
  decisionVariables: jsonObject.optional(),
  constraints: jsonObject.optional(),
  budget: budgetPatch.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required.");

export interface ScenarioApiLimits {
  maxRuns: number;
  maxRuntimeMs: number;
}

function boundedBudget(
  patch: z.infer<typeof budgetPatch> | undefined,
  limits: ScenarioApiLimits,
): Record<string, unknown> {
  const maxRuns = Math.max(1, Math.min(25, limits.maxRuns));
  const maxRuntimeMs = Math.max(1_000, Math.min(120_000, limits.maxRuntimeMs));
  return {
    maxCouncilRounds: patch?.maxCouncilRounds ?? 2,
    maxSimulationRuns: Math.min(patch?.maxSimulationRuns ?? 15, limits.maxRuns),
    maxRuntimeMs: Math.min(patch?.maxRuntimeMs ?? maxRuntimeMs, limits.maxRuntimeMs),
    maxFailedRuns: patch?.maxFailedRuns ?? 2,
    noProgressLimit: patch?.noProgressLimit ?? 1,
    ...(patch?.maxTokens === undefined ? {} : { maxTokens: patch.maxTokens }),
    ...(patch?.maxCostCents === undefined ? {} : { maxCostCents: patch.maxCostCents }),
    ...(patch?.minimumImprovement === undefined ? {} : { minimumImprovement: patch.minimumImprovement }),
    // Keep the platform default meaningful even if a malformed limits object is injected in a unit test.
    _platformMaxRuns: maxRuns,
  };
}

export function parseCreateScenarioInput(body: unknown, limits: ScenarioApiLimits): CreateScenarioInput {
  const parsed = createSchema.parse(body);
  const budget = boundedBudget(parsed.budget, limits);
  delete budget._platformMaxRuns;
  return {
    title: parsed.title,
    question: parsed.question,
    decisionVariables: parsed.decisionVariables ?? {},
    constraints: parsed.constraints ?? {},
    budget,
  };
}

export function parseUpdateScenarioInput(body: unknown): UpdateScenarioDraftInput {
  const parsed = updateSchema.parse(body);
  return {
    ...(parsed.title === undefined ? {} : { title: parsed.title }),
    ...(parsed.question === undefined ? {} : { question: parsed.question }),
    ...(parsed.decisionVariables === undefined ? {} : { decisionVariables: parsed.decisionVariables }),
    ...(parsed.constraints === undefined ? {} : { constraints: parsed.constraints }),
    ...(parsed.budget === undefined ? {} : { budget: parsed.budget }),
  };
}
