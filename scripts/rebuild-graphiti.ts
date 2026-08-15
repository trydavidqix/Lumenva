/**
 * Purge and rebuild the Graphiti temporal graph for one tenant from official
 * Postgres sources (`messages`).
 *
 * Unlike `scripts/rebuild-mem0.ts` (rebuild-only — a Mem0 wipe is a manual
 * Docker-volume operation outside that script), this script performs the
 * FULL purge -> reset -> replay sequence itself, because tenant-scoped purge
 * (`GraphContextPort.deleteOrganization`) is a first-class capability this
 * task introduces (see `workers/graph-lifecycle.handler.ts` for the
 * automatic LGPD-triggered counterpart, which purges on a `tenant`-scope
 * `lgpd.redact_applied` event; this script is the equivalent MANUAL path for
 * a Neo4j-side wipe, a schema/embedding change, or any operator-approved
 * "start this tenant's graph over" request).
 *
 * `docs/runbooks/graphiti.md` ("Wipe e reconstrução completos") explicitly
 * deferred both purge-by-tenant and rebuild/replay to this task — this file
 * and `workers/graph-lifecycle.handler.ts` are that deferred work.
 *
 * Sequence:
 *   1. read (kill switch + per-org rollout mode) before touching anything —
 *      recorded so step 6 can decide correctly.
 *   2. purge: `GraphContextPort.deleteOrganization(organizationId)` deletes
 *      the whole Neo4j group for the tenant.
 *   3. reset the ledger: every 'applied' graph/graphiti ledger row for this
 *      org (optionally scoped further to one contact) becomes
 *      replay-eligible again (`status='pending'`). Rows already 'deleted'
 *      (an irreversible LGPD tombstone — see
 *      `markProjectionDeletedByEntity` /
 *      `markOrganizationGraphProjectionsDeleted` in
 *      `workers/graph-lifecycle.handler.ts`) are never touched, so an LGPD
 *      purge can never be undone by a rebuild.
 *   4. replay: reuse `workers/graph-projection.handler.ts`'s
 *      `processGraphProjection` for every eligible message, one synthetic
 *      `message.received`-shaped event per message, so "rebuilt" can never
 *      mean something structurally different from "live-projected". The
 *      per-message feature-mode gate is forced to `shadow` for the duration
 *      of the replay call only — this does NOT write the org's real feature
 *      flag row; it only ensures the replay actually projects regardless of
 *      the org's live mode (an explicit operator rebuild should not be
 *      silently skipped because the org happens to be `off` today).
 *   5. compare counts: the printed JSON line reports applied/skipped/
 *      retried/ledgerReset counts for the operator to sanity-check against
 *      the pre-purge state before deciding to promote the feature mode.
 *   6. never escalate rollout: if the org's REAL stored mode was `on` or
 *      `canary`, force it down to `shadow` (a purge+rebuild that has not
 *      been re-verified must not keep serving live/canary traffic
 *      automatically). If it was already `off`/`shadow`, it is left
 *      untouched. This script never writes `on` or `canary`.
 *
 * Usage:
 *   pnpm exec tsx scripts/rebuild-graphiti.ts --org <organization_id> --confirm-purge
 *   pnpm exec tsx scripts/rebuild-graphiti.ts --org <organization_id> --contact <contact_id> --confirm-purge
 *
 * No `--all-orgs`: `deleteOrganization` is destructive per tenant (interface
 * doctrine for this task is "tenant-scoped purge/rebuild by default") — a
 * global purge+rebuild loop across every tenant is not offered as a single
 * command. `--confirm-purge` is required because, unlike `rebuild-mem0.ts`,
 * this script itself deletes provider-side data before rebuilding it.
 *
 * Only aggregate counts are printed — no message text, no episode text.
 */
import type pg from "pg";

import { createPool } from "@/lib/agent-engine/db/pool";
import { GraphitiClient } from "@/lib/agent-engine/graph/graphiti-client";
import type { GraphContextPort } from "@/lib/agent-engine/graph/port";
import { resolveAiPlatformFeature, type ResolvedAiPlatformFeature } from "@/lib/agent-engine/platform/features";
import type { FeatureMode } from "@/lib/agent-engine/platform/contracts";
import { processGraphProjection, type GraphProjectionDeps } from "@/workers/graph-projection.handler";
import type { EventRow } from "@/lib/event-log/dispatcher";
import { createAdminClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 200;
const GRAPH_PROVIDER = "graphiti";

type Queryable = pg.Pool | { query: pg.Pool["query"] };

export type RebuildDeps = {
  db: Queryable;
  admin: GraphProjectionDeps["admin"];
  graphPort: GraphContextPort;
  resolveFeature?: (input: { organizationId: string; feature: "graphiti" }) => Promise<ResolvedAiPlatformFeature>;
  processProjection?: typeof processGraphProjection;
};

export type RebuildTarget = { organizationId: string; contactId?: string };

export type RebuildSummary = {
  applied: number;
  skipped: number;
  retried: number;
  ledgerReset: number;
  featureModeBefore: FeatureMode;
  featureModeAfter: FeatureMode;
};

function syntheticMessageReceivedEvent(organizationId: string, messageId: string): EventRow {
  return {
    id: `rebuild-graphiti:${messageId}`,
    organization_id: organizationId,
    event_type: "message.received",
    entity_kind: "message",
    entity_id: messageId,
    payload: { message_id: messageId },
    metadata: { source: "rebuild-graphiti" },
    consumed_by: [],
    attempts: 0,
  };
}

async function fetchEligibleMessageIds(
  db: Queryable,
  target: RebuildTarget,
  offset: number,
): Promise<Array<{ id: string }>> {
  const result = await db.query(
    `select m.id
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
  return (result as unknown as { rows: Array<{ id: string }> }).rows;
}

/**
 * Resets 'applied' graph/graphiti ledger rows back to 'pending' so a later
 * `beginProjection` call (inside `processGraphProjection`) treats the source
 * as eligible again instead of short-circuiting on "already_applied". Rows
 * with status='deleted' are excluded by construction (`status='applied'` in
 * the WHERE clause) — an LGPD tombstone is never reset/resurrected by this
 * statement, no matter how many times a rebuild runs.
 */
async function resetAppliedGraphLedger(db: Queryable, target: RebuildTarget): Promise<number> {
  const result = target.contactId
    ? await db.query(
        `update ai_projection_ledger set status='pending', updated_at=now()
         where organization_id=$1 and projection_type='graph' and provider=$2
           and entity_type='contact' and entity_id=$3 and status='applied'
         returning id`,
        [target.organizationId, GRAPH_PROVIDER, target.contactId],
      )
    : await db.query(
        `update ai_projection_ledger set status='pending', updated_at=now()
         where organization_id=$1 and projection_type='graph' and provider=$2 and status='applied'
         returning id`,
        [target.organizationId, GRAPH_PROVIDER],
      );
  return (result as unknown as { rows: unknown[] }).rows.length;
}

/**
 * Never escalates rollout: only writes when the org's real stored mode is
 * `on`/`canary`, and only ever writes `shadow` — this function cannot
 * produce `on` or `canary` as an output under any input. `off`/`shadow` are
 * left completely untouched (no write at all), matching "leave rollout mode
 * exactly as it found it or explicitly force it to shadow, never escalate".
 */
async function downgradeIfEscalated(
  db: Queryable,
  organizationId: string,
  before: FeatureMode,
): Promise<FeatureMode> {
  if (before !== "on" && before !== "canary") return before;
  await db.query(
    `insert into ai_platform_feature_flags (organization_id, feature, mode)
     values ($1, 'graphiti', 'shadow')
     on conflict (organization_id, feature) do update set mode='shadow', updated_at=now()`,
    [organizationId],
  );
  return "shadow";
}

/** Purges, resets the ledger, and replays one tenant (optionally one contact within it). */
export async function rebuildTenant(deps: RebuildDeps, target: RebuildTarget): Promise<RebuildSummary> {
  const resolveFeature = deps.resolveFeature ?? resolveAiPlatformFeature;

  // Step 1: read before touching anything.
  const resolved = await resolveFeature({ organizationId: target.organizationId, feature: "graphiti" });
  const featureModeBefore = resolved.mode;

  // Step 2: purge tenant group.
  await deps.graphPort.deleteOrganization(target.organizationId);

  // Step 3: reset ledger (LGPD-deleted rows are excluded by construction).
  const ledgerReset = await resetAppliedGraphLedger(deps.db, target);

  // Step 4: replay selected official sources through the exact same live
  // path (`processGraphProjection`), one synthetic event per eligible
  // message.
  const processProjection = deps.processProjection ?? processGraphProjection;
  const counts = { applied: 0, skipped: 0, retried: 0 };
  let offset = 0;
  for (;;) {
    const rows = await fetchEligibleMessageIds(deps.db, target, offset);
    if (rows.length === 0) break;

    for (const row of rows) {
      const result = await processProjection(syntheticMessageReceivedEvent(target.organizationId, row.id), {
        admin: deps.admin,
        db: deps.db as unknown as GraphProjectionDeps["db"],
        graphPort: deps.graphPort,
        resolveFeature: async () => ({ mode: "shadow", config: {}, killed: false }),
      });
      if (result.status === "ok") counts.applied++;
      else if (result.status === "retry") counts.retried++;
      else counts.skipped++;
    }

    offset += rows.length;
    if (rows.length < PAGE_SIZE) break;
  }

  // Step 6: never escalate rollout.
  const featureModeAfter = await downgradeIfEscalated(deps.db, target.organizationId, featureModeBefore);

  return { ...counts, ledgerReset, featureModeBefore, featureModeAfter };
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

async function main(): Promise<void> {
  const flags = parseArgs(process.argv.slice(2));
  const org = typeof flags.get("org") === "string" ? (flags.get("org") as string) : null;
  const contact = typeof flags.get("contact") === "string" ? (flags.get("contact") as string) : undefined;
  const confirmPurge = flags.get("confirm-purge") === true;

  if (!org) {
    console.error("usage: rebuild-graphiti.ts --org <organization_id> --confirm-purge [--contact <contact_id>]");
    process.exitCode = 1;
    return;
  }
  if (!confirmPurge) {
    console.error(
      "--confirm-purge is required — this script deletes the tenant's entire Graphiti group before rebuilding it.",
    );
    process.exitCode = 1;
    return;
  }

  const db = createPool(process.env.SUPABASE_DB_URL ?? "");
  const admin = createAdminClient() as unknown as GraphProjectionDeps["admin"];
  const graphPort = new GraphitiClient({
    baseUrl: process.env.GRAPHITI_BASE_URL ?? "",
    apiKey: process.env.GRAPHITI_API_KEY ?? "",
    timeoutMs: Number(process.env.GRAPHITI_TIMEOUT_MS ?? 2_000),
  });

  const summary = await rebuildTenant({ db, admin, graphPort }, { organizationId: org, contactId: contact });
  console.log(JSON.stringify({ org, ...summary }));
  await db.end();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("[rebuild-graphiti] failed", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
