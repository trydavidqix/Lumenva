/**
 * Asynchronous temporal-graph projection.
 *
 * Structural sibling of `workers/memory-projection.handler.ts` (Phase 2/3,
 * Mem0) for the same shape of problem: observe official CRM events only,
 * never participate in the inbound reply path, and keep provenance/
 * idempotency in `ai_projection_ledger` so retries/redeliveries can never
 * duplicate or regress an already-applied projection.
 *
 * Scope for this task (Phase 4 Task 6, Step 2): `message.received` only.
 * Additional official events (`lead.stage_changed`, contact/company
 * relationship updates) are deliberately out of scope — each gets its own
 * dedicated test when it is added, per the task brief.
 *
 * `GraphitiClient.addEpisode()` (Task 4/5) already sanitizes every wire-bound
 * field before egress and derives FalkorDB/Neo4j's `group_id` from
 * `organizationId` internally — this handler never sanitizes or builds a raw
 * group id itself; both are the trusted adapter's job, not the caller's.
 */
import type pg from "pg";

import { createPool } from "@/lib/agent-engine/db/pool";
import { GraphitiClient, GraphitiProviderError } from "@/lib/agent-engine/graph/graphiti-client";
import { NullGraphContextPort, type GraphContextPort } from "@/lib/agent-engine/graph/port";
import type { GraphEpisode } from "@/lib/agent-engine/graph/types";
import { resolveAiPlatformFeature, type ResolvedAiPlatformFeature } from "@/lib/agent-engine/platform/features";
import { beginProjection, markProjectionApplied, markProjectionRetry } from "@/lib/agent-engine/platform/projection-ledger";
import type { EventRow, HandlerResult } from "@/lib/event-log/dispatcher";
import { createAdminClient } from "@/lib/supabase/admin";

export const GRAPH_PROJECTION_CONSUMER_KEY = "graph_projection_v1";

const GRAPH_PROJECTION_PROVIDER = "graphiti";

type SourceMessage = {
  id: string;
  body: string | null;
  organization_id: string;
  contact_id: string;
  direction: string;
  sent_at: string;
};

type SourceQuery = {
  select: (columns: string) => SourceQuery;
  eq: (column: string, value: string) => SourceQuery;
  maybeSingle: () => Promise<{ data: unknown; error: unknown | null }>;
};

type SourceAdminClient = {
  from: (table: string) => { select: (columns: string) => SourceQuery };
};

// A superset of the row shape `beginProjection`/`markProjectionApplied`
// assume (`{ id, status }`), plus the one extra column this handler's own
// stale-version guard reads. Kept local to this file like the analogous
// `Queryable` in memory-projection.handler.ts — each projection handler
// declares its own narrow view of the pool it needs.
type Queryable = {
  query: (sql: string, values: unknown[]) => Promise<{ rows: Array<{ id: string; status: string; source_version?: string }> }>;
};

export type GraphProjectionDeps = {
  resolveFeature?: (input: { organizationId: string; feature: "graphiti" }) => Promise<ResolvedAiPlatformFeature>;
  admin?: SourceAdminClient;
  db?: Queryable;
  graphPort?: GraphContextPort;
  now?: () => Date;
};

let pool: pg.Pool | undefined;

function projectionPool(): pg.Pool {
  pool ??= createPool(process.env.SUPABASE_DB_URL ?? "");
  return pool;
}

function retryAt(now: Date): string {
  return new Date(now.getTime() + 60_000).toISOString();
}

/**
 * `feature.mode !== "off"` for this org is the normal gate for reaching this
 * code at all — `GraphitiClient`'s constructor still validates config
 * eagerly and throws if it's missing regardless. That combination (feature
 * on for an org, sidecar never configured instance-wide) is an inconsistent
 * deploy state, not a reason to fail every `message.received` event outright
 * — degrade to the null port (same shape as `defaultMemoryPort` in
 * memory-projection.handler.ts) instead of throwing before anything is
 * attempted.
 */
function defaultGraphPort(): GraphContextPort {
  try {
    return new GraphitiClient({
      baseUrl: process.env.GRAPHITI_BASE_URL ?? "",
      apiKey: process.env.GRAPHITI_API_KEY ?? "",
      timeoutMs: Number(process.env.GRAPHITI_TIMEOUT_MS ?? 2_000),
    });
  } catch {
    return new NullGraphContextPort();
  }
}

/**
 * Refuses to let a delayed/redelivered event carrying an older
 * `source_version` project over a source whose newer version already
 * applied. Not exercised by `message.received` today (a message row is
 * immutable, so `sent_at` for a given `source_id` never changes between
 * calls) — this guard exists for the shared write path every future graph
 * event type (`lead.stage_changed` etc.) will reuse, where the same
 * `source_id` (e.g. a lead id) legitimately recurs across events with a
 * strictly increasing `source_version` (e.g. `updated_at`). Equal versions
 * are intentionally left to `beginProjection`'s own idempotency-key match —
 * this check only rejects strictly-older versions, so it never duplicates
 * the "already applied" detection path.
 */
async function isStaleSourceVersion(
  db: Queryable,
  input: { organizationId: string; sourceId: string; sourceVersion: string },
): Promise<boolean> {
  const result = await db.query(
    `select id, status, source_version from ai_projection_ledger
     where organization_id = $1 and projection_type = 'graph' and provider = $2
       and source_id = $3 and status = 'applied'
     order by source_version desc limit 1`,
    [input.organizationId, GRAPH_PROJECTION_PROVIDER, input.sourceId],
  );
  const latestApplied = result.rows[0]?.source_version;
  return latestApplied !== undefined && input.sourceVersion < latestApplied;
}

/** Processes one official `message.received` event into a Graphiti episode. */
export async function processGraphProjection(
  row: EventRow,
  deps: GraphProjectionDeps = {},
): Promise<HandlerResult> {
  const consumer_key = GRAPH_PROJECTION_CONSUMER_KEY;
  const feature = await (deps.resolveFeature ?? resolveAiPlatformFeature)({
    organizationId: row.organization_id,
    feature: "graphiti",
  });
  if (feature.mode === "off") {
    return { consumer_key, status: "skipped", detail: "feature_off" };
  }

  const messageId = typeof row.payload.message_id === "string" ? row.payload.message_id : row.entity_id;
  if (!messageId) return { consumer_key, status: "skipped", detail: "missing_message_id" };

  // Trusted source fetch: the event payload is never treated as content —
  // only `messageId`/`row.organization_id` (tenant identity) route the
  // lookup. The live `messages` row is what gets projected.
  const admin = deps.admin ?? (createAdminClient() as unknown as SourceAdminClient);
  const { data: messageData, error: messageError } = await admin
    .from("messages")
    .select("id, body, organization_id, contact_id, direction, sent_at")
    .eq("id", messageId)
    .eq("organization_id", row.organization_id)
    .maybeSingle();
  const message = messageData as SourceMessage | null;
  // Defense in depth for a compromised or incorrectly mocked service client.
  // Event tenant identity always wins.
  if (messageError || !message || message.organization_id !== row.organization_id) {
    return { consumer_key, status: "skipped", detail: "message_not_found" };
  }
  if (!message.contact_id || !message.body?.trim()) {
    return { consumer_key, status: "skipped", detail: "message_not_projectable" };
  }

  const sourceVersion = message.sent_at;
  const idempotencyKey = `${GRAPH_PROJECTION_CONSUMER_KEY}:${message.id}:${sourceVersion}`;
  const db = deps.db ?? projectionPool();

  if (await isStaleSourceVersion(db, { organizationId: row.organization_id, sourceId: message.id, sourceVersion })) {
    return { consumer_key, status: "skipped", detail: "stale_source_version" };
  }

  const ledger = await beginProjection(db, {
    organizationId: row.organization_id,
    projectionType: "graph",
    provider: GRAPH_PROJECTION_PROVIDER,
    entityType: "contact",
    entityId: message.contact_id,
    sourceId: message.id,
    sourceVersion,
    idempotencyKey,
  });
  if (ledger.status === "applied") {
    return { consumer_key, status: "skipped", detail: "already_applied" };
  }
  // Mirrors memory-projection.handler.ts: a ledger row only reaches
  // 'deleted' via an official LGPD cascade. That is deliberate and
  // irreversible, not a state a replayed event is allowed to undo.
  if (ledger.status === "deleted") {
    return { consumer_key, status: "skipped", detail: "resurrection_blocked_deleted_entity" };
  }

  const referenceTime = new Date(message.sent_at).toISOString();
  const episode: GraphEpisode = {
    organizationId: row.organization_id,
    sourceId: message.id,
    sourceVersion,
    // Stable source id, never phone/name (Step 3).
    name: `whatsapp_message:${message.id}`,
    body: message.body.trim(),
    sourceType: "message",
    sourceDescription: message.direction === "inbound" ? "whatsapp_message_inbound" : "whatsapp_message_outbound",
    referenceTime,
  };

  const graphPort = deps.graphPort ?? defaultGraphPort();
  try {
    // `graphPort.addEpisode` (GraphitiClient, Task 4/5) sanitizes `body`/
    // `name`/`sourceDescription` before any request is built and derives the
    // trusted group id from `organizationId` — neither is duplicated here.
    await graphPort.addEpisode(episode, idempotencyKey);
    await markProjectionApplied(db, row.organization_id, ledger.id);
    return { consumer_key, status: "ok" };
  } catch (error) {
    // Only the typed `.kind` ever reaches the ledger/log — never `.message`,
    // which can carry a sanitizer's matched-field detail or a raw upstream
    // response fragment.
    const code = error instanceof GraphitiProviderError ? `graphiti_${error.kind}` : "graph_projection_failed";
    const nextAttemptAt = retryAt((deps.now ?? (() => new Date()))());
    await markProjectionRetry(db, row.organization_id, ledger.id, code, nextAttemptAt);
    return { consumer_key, status: "retry", retry_at: nextAttemptAt, detail: code };
  }
}

export const graphProjectionHandler = {
  key: GRAPH_PROJECTION_CONSUMER_KEY,
  events: ["message.received"],
  handle: processGraphProjection,
};
