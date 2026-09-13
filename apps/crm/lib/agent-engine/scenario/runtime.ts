import type pg from "pg";

import { createPool } from "@/lib/agent-engine/db/pool";
import { env } from "@/lib/env";

import { createScenarioRepository, type ScenarioRepository } from "./repository";

let pool: pg.Pool | undefined;
let repository: ScenarioRepository | undefined;

/**
 * Server-only Scenario Lab persistence seam. The caller supplies tenant identity
 * separately; this module owns connection reuse only and never derives org ids
 * from request payloads.
 */
export function getScenarioDbPool(): pg.Pool {
  if (!pool) pool = createPool(env.SUPABASE_DB_URL);
  return pool;
}

export function getScenarioRepository(): ScenarioRepository {
  if (!repository) repository = createScenarioRepository(getScenarioDbPool());
  return repository;
}
