/**
 * graph-lifecycle.handler — purges the Graphiti temporal-graph namespace
 * when the official LGPD cascade completes a store-level (tenant)
 * redaction.
 *
 * Subscribes to `lgpd.redact_applied` — the exact same official event
 * `workers/memory-lifecycle.handler.ts` (Phase 2/3, Mem0) already listens
 * to, already emitted by `workers/lgpd-redact-worker.ts` for both scopes
 * ('contact': single `contact_id` in payload; 'tenant': store-level
 * uninstall, `organizations.status='redacted'`, no per-contact id). This
 * handler adds no new event — it reacts to the existing official deletion
 * boundary, so a delayed/redelivered LGPD event is the only trigger, never a
 * free-form message or a guess.
 *
 * Granularity gap vs Mem0 — documented, not silently papered over:
 * `MemoryPort` exposes `deleteContact`, so the Mem0 handler can delete one
 * contact's namespace surgically. `GraphContextPort` (Task 1) exposes only
 * `deleteOrganization(organizationId)` — Graphiti's real wire contract
 * (`zepai/graphiti:0.22.0`, confirmed by Task 4 reading the packaged source)
 * has no per-entity/episode delete route, only `DELETE /group/{group_id}`.
 * The runbook (`docs/runbooks/graphiti.md` "Wipe e reconstrução completos")
 * already scoped tenant purge as this task's deliverable, not contact-level
 * purge. So:
 *
 *   - scope 'tenant' -> the whole Graphiti group for the org is purged via
 *     `graphPort.deleteOrganization()`, and every 'applied' graph ledger row
 *     for the org is marked 'deleted' so a later rebuild/replay can never
 *     silently re-materialize pre-purge data (see
 *     `markOrganizationGraphProjectionsDeleted` below).
 *   - scope 'contact' -> Graphiti cannot selectively remove one contact's
 *     episodes without deleting every other contact's graph data in the same
 *     org group, which would be a disproportionate side effect of a single
 *     contact's redaction. This handler does NOT call `deleteOrganization`
 *     for a contact-scope event. It only marks that contact's own 'applied'
 *     graph ledger rows 'deleted' (`markProjectionDeletedByEntity`, the same
 *     helper `memory-lifecycle.handler.ts` uses), which blocks any future
 *     rebuild from re-projecting that contact's already-redacted messages.
 *     It does NOT claim the contact's existing episodes were removed from
 *     Neo4j — this is a known product gap pending a per-entity deletion
 *     capability upstream/in the port, flagged in
 *     `docs/runbooks/graphiti-rebuild.md`.
 *
 * Mem0 is a disposable projection, never the source of truth
 * (`docs/runbooks/mem0.md`); the same doctrine applies to Graphiti
 * (`docs/runbooks/graphiti.md`): deleting it here is best-effort cleanup on
 * top of an LGPD guarantee that is already complete — the Postgres cascade
 * ran and was audited before this event ever fires. A failure here retries;
 * it never blocks or reverses the cascade.
 *
 * Gated on the sidecar being configured at all (`GRAPHITI_BASE_URL` set) —
 * most orgs never had Graphiti provisioned, and without that guard every
 * redaction on a self-hosted instance that never touched Graphiti would open
 * a provider call that can only fail and retry forever. Deliberately NOT
 * gated on the per-org `graphiti` feature mode: an org that had the feature
 * on during a past SHADOW/CANARY window can still have graph data today even
 * after the feature flipped back to off, and LGPD does not stop applying
 * just because a flag flipped.
 */
import type pg from "pg";

import { createPool } from "@/lib/agent-engine/db/pool";
import { GraphitiClient, GraphitiProviderError } from "@/lib/agent-engine/graph/graphiti-client";
import type { GraphContextPort } from "@/lib/agent-engine/graph/port";
import { markProjectionDeletedByEntity } from "@/lib/agent-engine/platform/projection-ledger";
import type { EventRow, HandlerResult } from "@/lib/event-log/dispatcher";

export const GRAPH_LIFECYCLE_CONSUMER_KEY = "graph_lifecycle_v1";

export const GRAPH_LIFECYCLE_PROVIDER = "graphiti";

type Queryable = { query: (sql: string, values: unknown[]) => Promise<{ rows: Array<{ id: string; status: string }> }> };

export type GraphLifecycleDeps = {
  db?: Queryable;
  graphPort?: GraphContextPort;
  graphitiConfigured?: boolean;
};

let pool: pg.Pool | undefined;

function lifecyclePool(): pg.Pool {
  pool ??= createPool(process.env.SUPABASE_DB_URL ?? "");
  return pool;
}

function defaultGraphPort(): GraphContextPort {
  return new GraphitiClient({
    baseUrl: process.env.GRAPHITI_BASE_URL ?? "",
    apiKey: process.env.GRAPHITI_API_KEY ?? "",
    timeoutMs: Number(process.env.GRAPHITI_TIMEOUT_MS ?? 2_000),
  });
}

/**
 * Bulk-marks every 'applied' graph ledger row for an ENTIRE organization as
 * 'deleted' — the org-wide sibling of `markProjectionDeletedByEntity`
 * (entity-scoped). Only ever called after `deleteOrganization` actually
 * purged the whole Graphiti group for that org, so the ledger state matches
 * what really happened to the provider. Scoped strictly by the trusted
 * `organizationId` argument (never the event payload) — no other
 * organization's rows are ever touched by this statement.
 */
async function markOrganizationGraphProjectionsDeleted(
  db: Queryable,
  organizationId: string,
): Promise<void> {
  await db.query(
    `update ai_projection_ledger set status='deleted', updated_at=now()
     where organization_id=$1 and projection_type='graph' and provider=$2 and status='applied'
     returning id, status`,
    [organizationId, GRAPH_LIFECYCLE_PROVIDER],
  );
}

export async function processGraphLifecycle(
  row: EventRow,
  deps: GraphLifecycleDeps = {},
): Promise<HandlerResult> {
  const consumer_key = GRAPH_LIFECYCLE_CONSUMER_KEY;
  const graphitiConfigured = deps.graphitiConfigured ?? Boolean(process.env.GRAPHITI_BASE_URL);
  if (!graphitiConfigured) {
    return { consumer_key, status: "skipped", detail: "graphiti_not_configured" };
  }

  const db = deps.db ?? lifecyclePool();
  // Trusted tenant identity: the dispatcher-verified event row, never the
  // payload — a spoofed `organization_id` inside the payload can never
  // redirect which org's graph gets purged.
  const organizationId = row.organization_id;

  const contactId = typeof row.payload.contact_id === "string" ? row.payload.contact_id : null;
  const scope = typeof row.payload.scope === "string" ? row.payload.scope : "contact";

  try {
    if (scope === "tenant") {
      // Constructed lazily, INSIDE the try block, and only on the one path
      // that actually needs a provider call. `new GraphitiClient(...)`
      // throws synchronously on a half-configured adapter (e.g.
      // `GRAPHITI_BASE_URL` set but `GRAPHITI_API_KEY` missing — a plausible
      // self-host misconfiguration). Outside a try block that throw would
      // escape the handler entirely and the dispatcher would record
      // `status:"error"` (a dead end) instead of a retry-eligible result.
      // Matches `graph-projection.handler.ts`'s discipline of never letting
      // adapter construction throw uncaught out of the handler — the
      // contact-scope branch below never even needs a graph port, so it is
      // never constructed for that path at all.
      const graphPort = deps.graphPort ?? defaultGraphPort();
      await graphPort.deleteOrganization(organizationId);
      await markOrganizationGraphProjectionsDeleted(db, organizationId);
      return { consumer_key, status: "ok", detail: "tenant_group_purged" };
    }

    if (contactId) {
      await markProjectionDeletedByEntity(db, organizationId, {
        provider: GRAPH_LIFECYCLE_PROVIDER,
        entityType: "contact",
        entityId: contactId,
      });
      return { consumer_key, status: "ok", detail: "contact_ledger_marked_deleted" };
    }

    return { consumer_key, status: "skipped", detail: "no_contact_id" };
  } catch (error) {
    // Only the typed `.kind` ever reaches the log/ledger — never
    // `.message`, mirroring graph-projection.handler.ts's discipline.
    const code = error instanceof GraphitiProviderError ? `graphiti_${error.kind}` : "graph_lifecycle_failed";
    const retryAt = new Date(Date.now() + 60_000).toISOString();
    return { consumer_key, status: "retry", retry_at: retryAt, detail: code };
  }
}

export const graphLifecycleHandler = {
  key: GRAPH_LIFECYCLE_CONSUMER_KEY,
  events: ["lgpd.redact_applied"],
  handle: processGraphLifecycle,
};
