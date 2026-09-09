import { describe, expect, it } from "vitest";

import type { GraphContextPort } from "@/lib/agent-engine/graph/port";
import type { GraphEpisode } from "@/lib/agent-engine/graph/types";
import type { FeatureMode } from "@/lib/agent-engine/platform/contracts";
import type { EventRow } from "@/lib/event-log/dispatcher";
import { processGraphLifecycle } from "@/workers/graph-lifecycle.handler";
import { processGraphProjection, type GraphProjectionDeps } from "@/workers/graph-projection.handler";
import { rebuildTenant, type RebuildDeps } from "@/scripts/rebuild-graphiti";

/**
 * Step 1 proof suite for Task 8. Wired against the REAL production modules
 * (`processGraphProjection`, `processGraphLifecycle`, `rebuildTenant`), not a
 * re-description of what they do — only the Postgres ledger, the `messages`
 * admin fetch, and the Graphiti provider are faked, each as a plain
 * in-memory stand-in satisfying the exact interfaces those modules already
 * depend on.
 */

const orgA = "00000000-0000-4000-8000-000000000001";
const orgB = "00000000-0000-4000-8000-000000000002";
const contactId = "00000000-0000-4000-8000-000000000020";
const contactIdB = "00000000-0000-4000-8000-000000000021";

type MessageRow = {
  id: string;
  body: string | null;
  organization_id: string;
  contact_id: string;
  direction: string;
  sent_at: string;
};

function message(overrides: Partial<MessageRow> = {}): MessageRow {
  return {
    id: "00000000-0000-4000-8000-000000000010",
    body: "Prefere contato só depois das 18h.",
    organization_id: orgA,
    contact_id: contactId,
    direction: "inbound",
    sent_at: "2026-08-10T12:00:00.000Z",
    ...overrides,
  };
}

/** Minimal in-memory stand-in for the `messages` table lookups `processGraphProjection` issues via `admin`. */
function fakeAdmin(messages: MessageRow[]): GraphProjectionDeps["admin"] {
  return {
    from: (_table: string) => ({
      select: (_cols: string) => {
        const filters: Record<string, string> = {};
        const builder = {
          eq(col: string, val: string) {
            filters[col] = val;
            return builder;
          },
          async maybeSingle() {
            const found = messages.find((m) => m.id === filters.id && m.organization_id === filters.organization_id);
            return { data: found ?? null, error: null };
          },
        };
        return builder;
      },
    }),
  } as unknown as GraphProjectionDeps["admin"];
}

type LedgerRow = {
  id: string;
  organization_id: string;
  projection_type: string;
  provider: string;
  entity_type: string;
  entity_id: string;
  source_id: string;
  source_version: string;
  idempotency_key: string;
  status: string;
};

/**
 * Single in-memory stand-in for `ai_projection_ledger`, satisfying every
 * exact SQL shape the real modules under test issue against it:
 * `beginProjection`/`markProjectionApplied`/`markProjectionRetry`
 * (projection-ledger.ts), `isStaleSourceVersion`
 * (graph-projection.handler.ts), `markProjectionDeletedByEntity`
 * (projection-ledger.ts, contact-scope lifecycle),
 * `markOrganizationGraphProjectionsDeleted` (graph-lifecycle.handler.ts,
 * tenant-scope purge), and the eligible-messages page query +
 * `resetAppliedGraphLedger`/`downgradeIfEscalated` (rebuild-graphiti.ts).
 */
function fakeGraphLedgerDb(messages: MessageRow[] = []) {
  const rows = new Map<string, LedgerRow>();
  const featureFlagWrites: Array<{ organizationId: string; mode: string }> = [];
  let seq = 0;

  const query = async (sql: string, values: unknown[]) => {
    if (sql.includes("from messages m")) {
      const [organizationId, contactFilter, limit, offset] = values as [string, string | null, number, number];
      const eligible = messages.filter(
        (m) =>
          m.organization_id === organizationId &&
          (contactFilter === null || m.contact_id === contactFilter) &&
          Boolean(m.body?.trim()),
      );
      return { rows: eligible.slice(offset, offset + limit).map((m) => ({ id: m.id })) };
    }

    if (sql.startsWith("insert into ai_projection_ledger")) {
      const [organization_id, projection_type, provider, entity_type, entity_id, source_id, source_version, idempotency_key] =
        values as string[];
      const existing = [...rows.values()].find(
        (r) =>
          r.organization_id === organization_id &&
          r.projection_type === projection_type &&
          r.provider === provider &&
          r.idempotency_key === idempotency_key,
      );
      if (existing) return { rows: [{ id: existing.id, status: existing.status }] };
      const id = `ledger-${++seq}`;
      rows.set(id, {
        id,
        organization_id: organization_id!,
        projection_type: projection_type!,
        provider: provider!,
        entity_type: entity_type!,
        entity_id: entity_id!,
        source_id: source_id!,
        source_version: source_version!,
        idempotency_key: idempotency_key!,
        status: "pending",
      });
      return { rows: [{ id, status: "pending" }] };
    }

    if (sql.includes("insert into ai_platform_feature_flags")) {
      const [organizationId] = values as string[];
      featureFlagWrites.push({ organizationId: organizationId!, mode: "shadow" });
      return { rows: [] };
    }

    if (sql.includes("applied_at = now()")) {
      const [id, organization_id] = values as string[];
      const row = rows.get(id!);
      if (row && row.organization_id === organization_id) row.status = "applied";
      return { rows: row ? [{ id: row.id, status: row.status }] : [] };
    }

    if (sql.includes("attempts=attempts+1")) {
      const [id, organization_id] = values as string[];
      const row = rows.get(id!);
      if (row && row.organization_id === organization_id) row.status = "failed";
      return { rows: row ? [{ id: row.id, status: row.status }] : [] };
    }

    if (sql.includes("order by source_version desc limit 1")) {
      const [organization_id, provider, source_id] = values as string[];
      const applied = [...rows.values()]
        .filter(
          (r) =>
            r.organization_id === organization_id &&
            r.projection_type === "graph" &&
            r.provider === provider &&
            r.source_id === source_id &&
            r.status === "applied",
        )
        .sort((a, b) => (a.source_version < b.source_version ? 1 : -1));
      const top = applied[0];
      return { rows: top ? [{ id: top.id, status: top.status, source_version: top.source_version }] : [] };
    }

    // markProjectionDeletedByEntity — contact-scope lifecycle (has entity_type/entity_id placeholders).
    if (sql.includes("status='deleted'") && sql.includes("entity_type=$3")) {
      const [organization_id, provider, entity_type, entity_id] = values as string[];
      const matched = [...rows.values()].filter(
        (r) =>
          r.organization_id === organization_id &&
          r.provider === provider &&
          r.entity_type === entity_type &&
          r.entity_id === entity_id &&
          r.status === "applied",
      );
      matched.forEach((r) => (r.status = "deleted"));
      return { rows: matched.map((r) => ({ id: r.id, status: r.status })) };
    }

    // markOrganizationGraphProjectionsDeleted — tenant-scope purge (org-wide, no entity filter).
    if (sql.includes("status='deleted'")) {
      const [organization_id, provider] = values as string[];
      const matched = [...rows.values()].filter(
        (r) =>
          r.organization_id === organization_id &&
          r.projection_type === "graph" &&
          r.provider === provider &&
          r.status === "applied",
      );
      matched.forEach((r) => (r.status = "deleted"));
      return { rows: matched.map((r) => ({ id: r.id, status: r.status })) };
    }

    // resetAppliedGraphLedger — rebuild's own ledger reset ('applied' -> 'pending', never touches 'deleted').
    if (sql.includes("status='pending'")) {
      const organization_id = values[0] as string;
      const provider = values[1] as string;
      const contactFilter = values.length > 2 ? (values[2] as string) : undefined;
      const matched = [...rows.values()].filter(
        (r) =>
          r.organization_id === organization_id &&
          r.projection_type === "graph" &&
          r.provider === provider &&
          r.status === "applied" &&
          (contactFilter === undefined || (r.entity_type === "contact" && r.entity_id === contactFilter)),
      );
      matched.forEach((r) => (r.status = "pending"));
      return { rows: matched.map((r) => ({ id: r.id })) };
    }

    throw new Error(`fakeGraphLedgerDb: unhandled query: ${sql}`);
  };

  return { query, rows, featureFlagWrites };
}

/** Minimal in-memory stand-in for the Graphiti group/episode store, namespaced exactly like the real adapter. */
function fakeGraphPort(): GraphContextPort & { episodes(organizationId: string): Array<{ uuid: string; body: string }> } {
  const store = new Map<string, { organizationId: string; uuid: string; body: string }>();
  return {
    async addEpisode(episode: GraphEpisode, idempotencyKey: string) {
      // Mirrors Graphiti's real Cypher `MERGE (n:Episodic {uuid: $uuid})` — the
      // same idempotencyKey always upserts the same node, never a second one.
      store.set(idempotencyKey, { organizationId: episode.organizationId, uuid: idempotencyKey, body: episode.body });
    },
    async search() {
      return [];
    },
    async deleteOrganization(organizationId: string) {
      for (const [key, rec] of store) {
        if (rec.organizationId === organizationId) store.delete(key);
      }
    },
    async health() {
      return { ok: true, latencyMs: 0 };
    },
    episodes(organizationId: string) {
      return [...store.values()].filter((r) => r.organizationId === organizationId);
    },
  };
}

function fakeResolveFeature(mode: FeatureMode) {
  return async () => ({ mode, config: {}, killed: false });
}

function messageReceivedEvent(organizationId: string, messageId: string): EventRow {
  return {
    id: `event:${messageId}`,
    organization_id: organizationId,
    event_type: "message.received",
    entity_kind: "message",
    entity_id: messageId,
    payload: { message_id: messageId },
    metadata: {},
    consumed_by: [],
    attempts: 0,
  };
}

function tenantRedactEvent(organizationId: string): EventRow {
  return {
    id: "event:tenant-redact",
    organization_id: organizationId,
    event_type: "lgpd.redact_applied",
    entity_kind: "lgpd_request",
    entity_id: "request-1",
    payload: { request_id: "request-1", scope: "tenant" },
    metadata: {},
    consumed_by: [],
    attempts: 0,
  };
}

describe("rebuildTenant (Task 8 Step 1 purge/rebuild proof)", () => {
  it("purges, resets nothing on a first run, and replays every eligible message as applied", async () => {
    const msg = message();
    const db = fakeGraphLedgerDb([msg]);
    const admin = fakeAdmin([msg]);
    const graphPort = fakeGraphPort();

    const deps: RebuildDeps = { db: db as never, admin, graphPort, resolveStoredMode: fakeResolveFeature("off") };
    const summary = await rebuildTenant(deps, { organizationId: orgA });

    expect(summary).toEqual({
      applied: 1,
      skipped: 0,
      retried: 0,
      ledgerReset: 0,
      featureModeBefore: "off",
      featureModeAfter: "off",
    });
    expect(graphPort.episodes(orgA)).toHaveLength(1);
  });

  it("replay is stable and duplicate replay produces no duplicate graph nodes — two full rebuild passes converge on one episode", async () => {
    const msg = message();
    const db = fakeGraphLedgerDb([msg]);
    const admin = fakeAdmin([msg]);
    const graphPort = fakeGraphPort();
    const deps: RebuildDeps = { db: db as never, admin, graphPort, resolveStoredMode: fakeResolveFeature("shadow") };

    const first = await rebuildTenant(deps, { organizationId: orgA });
    expect(first.applied).toBe(1);
    expect(graphPort.episodes(orgA)).toHaveLength(1);

    // Second full purge+reset+replay pass: the same source, same idempotency
    // key — must reproject cleanly (ledgerReset picks the just-applied row
    // back up) without ever producing a second episode.
    const second = await rebuildTenant(deps, { organizationId: orgA });
    expect(second.applied).toBe(1);
    expect(second.ledgerReset).toBe(1);
    expect(graphPort.episodes(orgA)).toHaveLength(1);
    expect(graphPort.episodes(orgA)[0]?.body).toBe(msg.body);
  });

  it("org A purge never touches org B — deleteOrganization and the ledger reset are scoped strictly to the target org", async () => {
    const msgA = message({ id: "msg-a", organization_id: orgA, contact_id: contactId });
    const msgB = message({ id: "msg-b", organization_id: orgB, contact_id: contactIdB });
    const db = fakeGraphLedgerDb([msgA, msgB]);
    const admin = fakeAdmin([msgA, msgB]);
    const graphPort = fakeGraphPort();
    const deps: RebuildDeps = { db: db as never, admin, graphPort, resolveStoredMode: fakeResolveFeature("off") };

    // Seed both orgs with an applied episode first.
    await rebuildTenant(deps, { organizationId: orgA });
    await rebuildTenant(deps, { organizationId: orgB });
    expect(graphPort.episodes(orgA)).toHaveLength(1);
    expect(graphPort.episodes(orgB)).toHaveLength(1);

    // Purge+rebuild org A only.
    await rebuildTenant(deps, { organizationId: orgA });

    expect(graphPort.episodes(orgA)).toHaveLength(1); // rebuilt, not lost
    expect(graphPort.episodes(orgB)).toHaveLength(1); // completely untouched
    const orgBLedgerRows = [...db.rows.values()].filter((r) => r.organization_id === orgB);
    expect(orgBLedgerRows.every((r) => r.status === "applied")).toBe(true);
  });

  it("a delayed pre-purge message.received event cannot resurrect stale graph state, even via an explicit rebuild — no valid newer source version exists", async () => {
    const msg = message();
    const db = fakeGraphLedgerDb([msg]);
    const admin = fakeAdmin([msg]);
    const graphPort = fakeGraphPort();

    // 1. live projection happens first.
    const projected = await processGraphProjection(messageReceivedEvent(orgA, msg.id), {
      admin,
      db: db as never,
      graphPort,
      resolveFeature: fakeResolveFeature("shadow"),
    });
    expect(projected).toMatchObject({ status: "ok" });
    expect(graphPort.episodes(orgA)).toHaveLength(1);

    // 2. the official LGPD tenant-scope deletion boundary fires — full group purge.
    const lifecycle = await processGraphLifecycle(tenantRedactEvent(orgA), {
      graphitiConfigured: true,
      db: db as never,
      graphPort,
    });
    expect(lifecycle).toMatchObject({ status: "ok", detail: "tenant_group_purged" });
    expect(graphPort.episodes(orgA)).toHaveLength(0);

    // 3. a delayed/redelivered copy of the SAME pre-purge event arrives late.
    const delayedReplay = await processGraphProjection(messageReceivedEvent(orgA, msg.id), {
      admin,
      db: db as never,
      graphPort,
      resolveFeature: fakeResolveFeature("shadow"),
    });
    expect(delayedReplay).toMatchObject({ status: "skipped", detail: "resurrection_blocked_deleted_entity" });
    expect(graphPort.episodes(orgA)).toHaveLength(0);

    // 4. an operator, unaware of the LGPD purge, runs an explicit rebuild —
    // it must not resurrect this message either: resetAppliedGraphLedger
    // only flips 'applied' rows, never 'deleted' ones, so the same
    // idempotency key still resolves to the tombstoned row.
    const rebuildAfterPurge = await rebuildTenant(
      { db: db as never, admin, graphPort, resolveStoredMode: fakeResolveFeature("shadow") },
      { organizationId: orgA },
    );
    expect(rebuildAfterPurge.applied).toBe(0);
    expect(rebuildAfterPurge.skipped).toBe(1);
    expect(rebuildAfterPurge.ledgerReset).toBe(0);
    expect(graphPort.episodes(orgA)).toHaveLength(0);
  });

  it("rebuild DOES restore projection after a genuine provider-side wipe that never went through the LGPD lifecycle handler", async () => {
    const msg = message();
    const db = fakeGraphLedgerDb([msg]);
    const admin = fakeAdmin([msg]);
    const graphPort = fakeGraphPort();

    const projected = await processGraphProjection(messageReceivedEvent(orgA, msg.id), {
      admin,
      db: db as never,
      graphPort,
      resolveFeature: fakeResolveFeature("shadow"),
    });
    expect(projected).toMatchObject({ status: "ok" });
    expect(graphPort.episodes(orgA)).toHaveLength(1);

    // Simulate a raw Neo4j-side wipe directly on the provider (NOT through
    // graph-lifecycle.handler.ts) — the ledger row is still 'applied'.
    await graphPort.deleteOrganization(orgA);
    expect(graphPort.episodes(orgA)).toHaveLength(0);
    const ledgerRow = [...db.rows.values()].find((r) => r.source_id === msg.id);
    expect(ledgerRow?.status).toBe("applied");

    const rebuilt = await rebuildTenant(
      { db: db as never, admin, graphPort, resolveStoredMode: fakeResolveFeature("shadow") },
      { organizationId: orgA },
    );
    expect(rebuilt).toMatchObject({ applied: 1, skipped: 0, retried: 0, ledgerReset: 1 });
    expect(graphPort.episodes(orgA)).toHaveLength(1);
  });

  it("downgrades an org stored at 'on' to 'shadow' even though `resolveStoredMode` is the ONLY mode-read this function can see — proving a kill-switch-masked read (which would report 'off' and cause a silent no-op) is structurally never consulted for this decision (Finding 2 regression; unmasking itself is proven directly in lib/agent-engine/platform/features.test.ts's 'under an active kill switch' block)", async () => {
    const db = fakeGraphLedgerDb([]);
    const admin = fakeAdmin([]);
    const graphPort = fakeGraphPort();

    // fakeResolveFeature("on") plays the role of the real
    // `resolveStoredAiPlatformFeatureMode` under an active kill switch: per
    // features.test.ts, that function reports the org's true stored mode
    // ('on') regardless of AI_PLATFORM_KILL_GRAPHITI. Before the fix,
    // rebuild-graphiti.ts read `resolveAiPlatformFeature` instead, which
    // WOULD have masked this same stored 'on' row down to 'off', making
    // `downgradeIfEscalated` see "already off" and no-op — leaving the org
    // stored at 'on' after an unverified purge+rebuild.
    const summary = await rebuildTenant(
      { db: db as never, admin, graphPort, resolveStoredMode: fakeResolveFeature("on") },
      { organizationId: orgA },
    );

    expect(summary.featureModeBefore).toBe("on");
    expect(summary.featureModeAfter).toBe("shadow");
    expect(db.featureFlagWrites).toEqual([{ organizationId: orgA, mode: "shadow" }]);
  });

  it("never escalates rollout: downgrades on/canary to shadow, leaves off/shadow completely untouched", async () => {
    const db = fakeGraphLedgerDb([]);
    const admin = fakeAdmin([]);
    const graphPort = fakeGraphPort();

    for (const mode of ["off", "shadow"] as const) {
      const summary = await rebuildTenant(
        { db: db as never, admin, graphPort, resolveStoredMode: fakeResolveFeature(mode) },
        { organizationId: orgA },
      );
      expect(summary.featureModeBefore).toBe(mode);
      expect(summary.featureModeAfter).toBe(mode);
    }
    expect(db.featureFlagWrites).toHaveLength(0);

    for (const mode of ["on", "canary"] as const) {
      const summary = await rebuildTenant(
        { db: db as never, admin, graphPort, resolveStoredMode: fakeResolveFeature(mode) },
        { organizationId: orgA },
      );
      expect(summary.featureModeBefore).toBe(mode);
      expect(summary.featureModeAfter).toBe("shadow");
    }
    // Never wrote 'on' or 'canary' as a target mode, only ever 'shadow'.
    expect(db.featureFlagWrites.every((w) => w.mode === "shadow")).toBe(true);
    expect(db.featureFlagWrites).toHaveLength(2);
  });

  it("scopes the rebuild to a single contact when one is given, without touching the rest of the org's ledger", async () => {
    const msgX = message({ id: "msg-x", contact_id: contactId });
    const msgY = message({ id: "msg-y", contact_id: contactIdB });
    const db = fakeGraphLedgerDb([msgX, msgY]);
    const admin = fakeAdmin([msgX, msgY]);
    const graphPort = fakeGraphPort();
    const deps: RebuildDeps = { db: db as never, admin, graphPort, resolveStoredMode: fakeResolveFeature("off") };

    const summary = await rebuildTenant(deps, { organizationId: orgA, contactId });

    expect(summary.applied).toBe(1);
    expect(graphPort.episodes(orgA)).toHaveLength(1);
  });

  it("--contact rebuild does NOT purge the whole org — the OTHER contact's already-projected episode and 'applied' ledger row survive completely untouched (Finding 1 regression)", async () => {
    const msgX = message({ id: "msg-x", contact_id: contactId, body: "Prefere contato pela manhã." });
    const msgY = message({ id: "msg-y", contact_id: contactIdB, body: "Prefere contato à noite." });
    const db = fakeGraphLedgerDb([msgX, msgY]);
    const admin = fakeAdmin([msgX, msgY]);
    const graphPort = fakeGraphPort();
    const deps: RebuildDeps = { db: db as never, admin, graphPort, resolveStoredMode: fakeResolveFeature("off") };

    // Seed BOTH contacts' projections first via a whole-org rebuild, so
    // there is something real for a buggy whole-org purge to destroy.
    await rebuildTenant(deps, { organizationId: orgA });
    expect(graphPort.episodes(orgA)).toHaveLength(2);
    const beforeStatuses = [...db.rows.values()].filter((r) => r.organization_id === orgA).map((r) => r.status);
    expect(beforeStatuses).toEqual(["applied", "applied"]);

    // Now run a --contact-scoped rebuild targeting ONLY `contactId` (msg-x).
    // Before the fix, `rebuildTenant` called `deps.graphPort.deleteOrganization()`
    // unconditionally BEFORE the ledger reset narrowed to contactId, wiping
    // BOTH contacts' episodes from the graph store even though only
    // contactId's ledger row was reset/replayed — leaving contactIdB's
    // ledger row still saying 'applied' while its graph data was gone.
    const summary = await rebuildTenant(deps, { organizationId: orgA, contactId });

    expect(summary.applied).toBe(1);
    expect(summary.ledgerReset).toBe(1);

    // contactIdB's episode must still be present and queryable in the graph
    // store — not just "the ledger wasn't reset", the underlying data
    // genuinely survives.
    const episodesAfter = graphPort.episodes(orgA);
    expect(episodesAfter).toHaveLength(2);
    expect(episodesAfter.some((episode) => episode.body === msgY.body)).toBe(true);
    expect(episodesAfter.some((episode) => episode.body === msgX.body)).toBe(true);

    const contactBLedgerRow = [...db.rows.values()].find((row) => row.source_id === msgY.id);
    expect(contactBLedgerRow?.status).toBe("applied");
    const contactALedgerRow = [...db.rows.values()].find((row) => row.source_id === msgX.id);
    expect(contactALedgerRow?.status).toBe("applied");
  });
});
