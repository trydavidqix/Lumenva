/**
 * Rebuild Mem0 semantic memory for one tenant from official Postgres sources.
 *
 * Mem0 is a disposable projection (docs/runbooks/mem0.md) — this script is
 * the recovery path after a wipe, a schema/embedding change, or any event
 * that leaves the sidecar's data behind official state. It reuses the exact
 * same extract -> sanitize -> ledger -> upsert path as the live
 * `message.received` consumer (`lib/agent-engine/memory/project-message.ts`),
 * so "rebuilt" and "live-projected" memory can never mean two different
 * things. Idempotent: an already-applied source in `ai_projection_ledger` is
 * skipped, so re-running after a partial run only fills the gap.
 *
 * Usage:
 *   pnpm exec tsx scripts/rebuild-mem0.ts --org <organization_id>
 *   pnpm exec tsx scripts/rebuild-mem0.ts --org <organization_id> --contact <contact_id>
 *   pnpm exec tsx scripts/rebuild-mem0.ts --all-orgs --confirm-global
 *
 * Only aggregate counts are printed — no message text, no candidate text.
 */
import type pg from "pg";

import { createPool } from "@/lib/agent-engine/db/pool";
import { llmEdgeConfigFromEnv, type LlmEdgeConfig } from "@/lib/agent-engine/edge/llm/run-model-call";
import type { extractMemoryCandidates } from "@/lib/agent-engine/memory/extract";
import { Mem0Client } from "@/lib/agent-engine/memory/mem0-client";
import type { MemoryPort } from "@/lib/agent-engine/memory/port";
import { projectMessage, type ProjectableMessage } from "@/lib/agent-engine/memory/project-message";

const PAGE_SIZE = 200;

export type RebuildDeps = {
  db: pg.Pool | { query: pg.Pool["query"] };
  memoryPort: MemoryPort;
  llmConfig: LlmEdgeConfig;
  extract?: typeof extractMemoryCandidates;
};

export type RebuildTarget = { organizationId: string; contactId?: string };

export type RebuildSummary = { applied: number; skipped: number; retried: number };

type EligibleRow = { message_id: string; body: string; created_at: string | null; contact_id: string; organization_id: string };

async function fetchPage(
  db: RebuildDeps["db"],
  target: RebuildTarget,
  offset: number,
): Promise<EligibleRow[]> {
  const result = await db.query(
    `select m.id as message_id, m.body, m.created_at, c.contact_id, m.organization_id
     from messages m
     join conversations c on c.id = m.conversation_id and c.organization_id = m.organization_id
     where m.organization_id = $1
       and ($2::uuid is null or c.contact_id = $2)
       and m.body is not null and length(trim(m.body)) > 0
       and c.contact_id is not null
     order by m.id
     limit $3 offset $4`,
    [target.organizationId, target.contactId ?? null, PAGE_SIZE, offset],
  );
  return (result as unknown as { rows: EligibleRow[] }).rows;
}

/** Rebuilds one tenant (optionally one contact within it). Returns aggregate counts only. */
export async function rebuildTenant(deps: RebuildDeps, target: RebuildTarget): Promise<RebuildSummary> {
  const summary: RebuildSummary = { applied: 0, skipped: 0, retried: 0 };
  let offset = 0;
  for (;;) {
    const rows = await fetchPage(deps.db, target, offset);
    if (rows.length === 0) break;

    for (const row of rows) {
      if (row.organization_id !== target.organizationId) continue; // defense in depth, not expected given the WHERE clause.
      const message: ProjectableMessage = { id: row.message_id, body: row.body, created_at: row.created_at };
      const result = await projectMessage({
        db: deps.db as pg.Pool,
        llmConfig: deps.llmConfig,
        memoryPort: deps.memoryPort,
        organizationId: target.organizationId,
        contactId: row.contact_id,
        message,
        extract: deps.extract,
      });
      if (result.status === "ok") summary.applied++;
      else if (result.status === "retry") summary.retried++;
      else summary.skipped++;
    }

    offset += rows.length;
    if (rows.length < PAGE_SIZE) break;
  }
  return summary;
}

function parseArgs(argv: string[]) {
  const flags = new Map<string, string | boolean>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg?.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      flags.set(key, next);
      i++;
    } else {
      flags.set(key, true);
    }
  }
  return flags;
}

async function listAllOrgIds(db: RebuildDeps["db"]): Promise<string[]> {
  const result = await db.query("select id from organizations order by id", []);
  return (result as unknown as { rows: Array<{ id: string }> }).rows.map((r) => r.id);
}

async function main(): Promise<void> {
  const flags = parseArgs(process.argv.slice(2));
  const org = typeof flags.get("org") === "string" ? (flags.get("org") as string) : null;
  const contact = typeof flags.get("contact") === "string" ? (flags.get("contact") as string) : undefined;
  const allOrgs = flags.get("all-orgs") === true;
  const confirmGlobal = flags.get("confirm-global") === true;

  if (!org && !allOrgs) {
    console.error("usage: rebuild-mem0.ts --org <organization_id> [--contact <contact_id>] | --all-orgs --confirm-global");
    process.exitCode = 1;
    return;
  }
  if (allOrgs && !confirmGlobal) {
    console.error("--all-orgs requires --confirm-global — a global rebuild is not the default command path.");
    process.exitCode = 1;
    return;
  }

  const db = createPool(process.env.SUPABASE_DB_URL ?? "");
  const memoryPort = new Mem0Client({
    baseUrl: process.env.MEM0_BASE_URL ?? "",
    apiKey: process.env.MEM0_API_KEY ?? "",
    timeoutMs: Number(process.env.MEM0_TIMEOUT_MS ?? 2_000),
  });
  const llmConfig = llmEdgeConfigFromEnv({
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    LLM_CACHE_TTL: process.env.LLM_CACHE_TTL,
  });
  const deps: RebuildDeps = { db, memoryPort, llmConfig };

  const targets: RebuildTarget[] = allOrgs
    ? (await listAllOrgIds(db)).map((organizationId) => ({ organizationId }))
    : [{ organizationId: org!, contactId: contact }];

  const total: RebuildSummary = { applied: 0, skipped: 0, retried: 0 };
  for (const target of targets) {
    const summary = await rebuildTenant(deps, target);
    total.applied += summary.applied;
    total.skipped += summary.skipped;
    total.retried += summary.retried;
  }

  console.log(JSON.stringify({ orgs: targets.length, ...total }));
  await db.end();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("[rebuild-mem0] failed", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
