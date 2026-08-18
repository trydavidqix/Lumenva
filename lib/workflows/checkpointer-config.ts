/**
 * Phase 7 LangGraph pilot — checkpointer configuration.
 *
 * SCOPE NOTE (documented per `.claude/rules/git-workflow.md` "disciplina de
 * escopo", same convention as `commercial-proposal-graph.ts`'s docblock):
 * the SDD ledger for this initiative
 * (`.superpowers/sdd/2026-08-10-ai-platform-phase-7-langgraph/progress.md`)
 * numbers this session's "Task 4: Checkpointer configuration +
 * interrupt/resume tests" — the collapsed/simplified slice of what
 * `docs/superpowers/plans/2026-08-10-ai-platform-phase-7-langgraph.md`
 * spreads across its own Task 3 (vendored `langgraph_internal` checkpoint
 * DDL as a versioned migration) and Task 7 (`PostgresSaver` factory + graph
 * interrupt wiring). Coordinator explicitly approved this session-local
 * renumbering (see `.superpowers/sdd/2026-08-10-ai-platform-phase-7-langgraph/task-4-report.md`).
 *
 * KNOWN DEVIATION — read before reusing this in a non-pilot path:
 * `.claude/rules/database-migrations.md` and `CLAUDE.md` invariant #3
 * ("schema sai em tripla") require every schema change to ship as a
 * versioned migration + `supabase/baseline.sql` appendix + `MANIFEST.md`
 * row — self-host clones only get schema that made it into the baseline.
 * `createCheckpointer()` below calls `PostgresSaver.setup()`, which creates
 * its checkpoint tables **at runtime** instead. The coordinator explicitly
 * approved this as a documented pilot deviation, acceptable only because:
 *   1. these tables hold LangGraph's own execution-state bookkeeping, never
 *      CRM business data (no `organization_id`/RLS-relevant row lives here);
 *   2. they live in a dedicated schema (`langgraph_internal`, matching the
 *      plan's intended Task-3 schema name so a future vendored migration
 *      converges on the same objects instead of colliding with them);
 *   3. the graph that uses this checkpointer (`commercial-proposal-graph.ts`)
 *      is not yet wired into any user-facing/self-host-required flow.
 * Before this pilot becomes a real self-host feature, replace the runtime
 * `.setup()` call with the plan's Task 3 (vendor the exact DDL as a
 * migration, `revoke`/`grant` per `.claude/rules/database-migrations.md`,
 * stop calling `.setup()` at runtime) — do not let this deviation ride to
 * production silently.
 *
 * This module is INTERNAL to LangGraph's own execution bookkeeping; it must
 * never be used to persist business/domain state — that continues to live
 * in the CRM's own tenant-aware tables per `.claude/rules/data-modeling.md`.
 */
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';

import { createPool } from '../agent-engine/db/pool';
import { env } from '../env';

/**
 * Dedicated schema for LangGraph's internal checkpoint tables — never
 * `public`, so a self-host clone's tenant-aware/PostgREST-exposed schema
 * never accidentally surfaces workflow execution internals. Matches the
 * schema name `docs/superpowers/plans/2026-08-10-ai-platform-phase-7-langgraph.md`
 * Task 3 designates for the eventual vendored migration.
 */
export const LANGGRAPH_CHECKPOINT_SCHEMA = 'langgraph_internal';

export interface CreateCheckpointerOptions {
  /**
   * Direct Postgres connection string. Defaults to `env.SUPABASE_DB_URL`
   * (the same direct-connection seam `lib/agent-engine/db/pool.ts` and
   * `lib/ai/skills/db.ts` already use — see `lib/env.ts`). Tests inject an
   * isolated/ephemeral database here instead of touching whatever
   * `SUPABASE_DB_URL` resolves to for the running process.
   */
  connectionString?: string;
  /** Overrides `LANGGRAPH_CHECKPOINT_SCHEMA` — tests use this for isolation between runs. */
  schema?: string;
  /** Same error seam as `createPool()` — defaults to the structured logger. */
  onPoolError?: (err: Error) => void;
}

/**
 * Builds a `PostgresSaver` wired to this project's Postgres connection
 * convention. Does **not** call `.setup()` — the caller decides when to run
 * it (once per process/deploy, not per graph invocation; see the
 * `PostgresSaver` docblock: "MUST be called directly by the user the first
 * time checkpointer is used").
 *
 * Throws instead of silently connecting nowhere when no connection string is
 * configured — a `pg.Pool` with an empty/undefined `connectionString` would
 * fall back to libpq defaults (`127.0.0.1:5432`) and fail three layers away
 * from the real cause (the exact pitfall `scripts/lib/env-de-teste.ts`
 * documents for the seed scripts).
 */
export function createCheckpointer(options: CreateCheckpointerOptions = {}): PostgresSaver {
  const connectionString = options.connectionString ?? env.SUPABASE_DB_URL;
  if (!connectionString) {
    throw new Error(
      'createCheckpointer: nenhuma connection string configurada — defina SUPABASE_DB_URL ' +
        'ou passe { connectionString } explicitamente.',
    );
  }
  const pool = createPool(connectionString, options.onPoolError);
  return new PostgresSaver(pool, undefined, {
    schema: options.schema ?? LANGGRAPH_CHECKPOINT_SCHEMA,
  });
}

/**
 * Runs `PostgresSaver.setup()` idempotently and returns the ready-to-use
 * checkpointer. Convenience for callers (and tests) that don't need to
 * separate "build" from "provision" — `.setup()` itself is safe to call
 * repeatedly (it creates-if-missing and runs the package's own internal
 * migrations). See the module docblock: this is the pilot's documented
 * runtime-DDL deviation, approved as a temporary measure.
 */
export async function createAndSetupCheckpointer(
  options: CreateCheckpointerOptions = {},
): Promise<PostgresSaver> {
  const checkpointer = createCheckpointer(options);
  await checkpointer.setup();
  return checkpointer;
}
