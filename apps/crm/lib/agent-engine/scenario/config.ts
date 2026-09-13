import { z } from "zod";

import type { ScenarioEngineMode } from "../contracts/scenario";

const intFromEnv = (fallback: number, min: number, max: number) =>
  z.preprocess(
    (value) => (value === undefined || value === "" ? fallback : Number(value)),
    z.number().int().min(min).max(max),
  );

const schema = z.object({
  SCENARIO_OASIS_MODE: z.enum(["off", "shadow", "on"]).default("off"),
  SCENARIO_OASIS_URL: z.string().url().optional(),
  SCENARIO_MAX_ACTORS: intFromEnv(50, 24, 500),
  SCENARIO_MAX_ROUNDS: intFromEnv(12, 1, 100),
  SCENARIO_MAX_RUNS: intFromEnv(25, 1, 250),
  SCENARIO_MAX_RUNTIME_MS: intFromEnv(120_000, 1_000, 3_600_000),
});

export interface ScenarioRuntimeConfig {
  oasisMode: ScenarioEngineMode;
  oasisUrl: string | null;
  maxActors: number;
  maxRounds: number;
  maxRuns: number;
  maxRuntimeMs: number;
}

export function parseScenarioRuntimeConfig(env: Record<string, string | undefined>): ScenarioRuntimeConfig {
  const parsed = schema.parse(env);
  if (parsed.SCENARIO_OASIS_MODE !== "off" && !parsed.SCENARIO_OASIS_URL) {
    throw new Error("SCENARIO_OASIS_URL is required when external OASIS simulation is shadow/on.");
  }
  return {
    oasisMode: parsed.SCENARIO_OASIS_MODE,
    oasisUrl: parsed.SCENARIO_OASIS_URL ?? null,
    maxActors: parsed.SCENARIO_MAX_ACTORS,
    maxRounds: parsed.SCENARIO_MAX_ROUNDS,
    maxRuns: parsed.SCENARIO_MAX_RUNS,
    maxRuntimeMs: parsed.SCENARIO_MAX_RUNTIME_MS,
  };
}

export function getScenarioRuntimeConfig(): ScenarioRuntimeConfig {
  return parseScenarioRuntimeConfig(process.env);
}
