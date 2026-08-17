/**
 * Shared process-wide runtime deps for the proposal workflow HTTP routes.
 *
 * A `pg.Pool` owns a real connection pool — constructing a fresh one PER
 * REQUEST (as a naive route handler might) leaks connections toward
 * Postgres's `max_connections`, exactly the pitfall `lib/agent-engine/db/pool.ts`'s
 * own docblock warns about. Route handlers in this Next.js process share ONE
 * lazily-created pool/llmCfg instead, mirroring how `lib/supabase/admin.ts`
 * memoizes its client.
 */
import type pg from 'pg';

import { env } from '@/lib/env';
import { createPool } from '@/lib/agent-engine/db/pool';
import { llmEdgeConfigFromEnv, type LlmEdgeConfig } from '@/lib/agent-engine/edge/llm/run-model-call';

let pool: pg.Pool | null = null;

/** Lazily-created, process-wide pg.Pool for the proposal workflow graph/nodes. */
export function getWorkflowDbPool(): pg.Pool {
  if (!pool) {
    pool = createPool(env.SUPABASE_DB_URL);
  }
  return pool;
}

/**
 * Base LLM edge config from platform env fallback keys. Per-org
 * BYOK/model/budget resolution happens inside `runModelCall` itself
 * (`resolveOrgLlmConfig`) — this is only the platform-level fallback.
 */
export function getWorkflowLlmCfg(): LlmEdgeConfig {
  return llmEdgeConfigFromEnv({
    ...(env.ANTHROPIC_API_KEY ? { ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY } : {}),
    ...(env.OPENAI_API_KEY ? { OPENAI_API_KEY: env.OPENAI_API_KEY } : {}),
  });
}
