import { describe, expect, it, vi } from "vitest";

import type { EventRow } from "@/lib/event-log/dispatcher";
import type { GraphContextPort } from "@/lib/agent-engine/graph/port";
import type { GraphEpisode } from "@/lib/agent-engine/graph/types";
import { GraphitiProviderError } from "@/lib/agent-engine/graph/graphiti-client";
import { sanitizeGraphEpisode } from "@/lib/agent-engine/graph/episode-sanitize";
import { GRAPH_PROJECTION_CONSUMER_KEY, processGraphProjection } from "./graph-projection.handler";

const orgA = "00000000-0000-4000-8000-000000000001";
const orgB = "00000000-0000-4000-8000-000000000002";
const messageId = "00000000-0000-4000-8000-000000000010";
const contactId = "00000000-0000-4000-8000-000000000020";

function event(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: "00000000-0000-4000-8000-000000000030",
    organization_id: orgA,
    event_type: "message.received",
    entity_kind: "message",
    entity_id: messageId,
    payload: { conversation_id: "conversation-a", contact_id: contactId, channel_session_id: "session-a", body_preview: "Oi" },
    metadata: {},
    consumed_by: [],
    attempts: 0,
    ...overrides,
  };
}

function fakeGraphPort(overrides: Partial<GraphContextPort> = {}): GraphContextPort {
  return {
    addEpisode: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue([]),
    deleteOrganization: vi.fn().mockResolvedValue(undefined),
    health: vi.fn().mockResolvedValue({ ok: true, latencyMs: 0 }),
    ...overrides,
  };
}

function harness(overrides: Record<string, unknown> = {}) {
  const messageQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: {
        id: messageId,
        body: "Prefere contactos por WhatsApp.",
        organization_id: orgA,
        contact_id: contactId,
        direction: "inbound",
        sent_at: "2026-08-10T12:00:00.000Z",
      },
      error: null,
    }),
  };
  const admin = { from: vi.fn(() => messageQuery) };
  const query = vi.fn(async (sql: string) => {
    if (sql.startsWith("select id, status, source_version")) {
      return { rows: [] };
    }
    if (sql.startsWith("insert into ai_projection_ledger")) {
      return { rows: [{ id: "ledger-1", status: "pending" }] };
    }
    return { rows: [{ id: "ledger-1", status: "applied" }] };
  });
  const graphPort = fakeGraphPort();
  const deps = {
    resolveFeature: vi.fn().mockResolvedValue({ mode: "shadow", config: {}, killed: false }),
    admin,
    db: { query },
    graphPort,
    now: () => new Date("2026-08-10T12:01:00.000Z"),
    ...overrides,
  };
  return { deps, admin, messageQuery, query, graphPort };
}

describe("graph projection handler", () => {
  it("skips without loading a source when the feature is off", async () => {
    const { deps, admin, graphPort } = harness({ resolveFeature: vi.fn().mockResolvedValue({ mode: "off", config: {}, killed: false }) });

    await expect(processGraphProjection(event(), deps)).resolves.toEqual({
      consumer_key: GRAPH_PROJECTION_CONSUMER_KEY,
      status: "skipped",
      detail: "feature_off",
    });
    expect(admin.from).not.toHaveBeenCalled();
    expect(graphPort.addEpisode).not.toHaveBeenCalled();
  });

  it.each(["shadow", "canary", "on"])("projects when the feature mode is %s", async (mode) => {
    const { deps, graphPort } = harness({ resolveFeature: vi.fn().mockResolvedValue({ mode, config: {}, killed: false }) });

    await expect(processGraphProjection(event(), deps)).resolves.toEqual({
      consumer_key: GRAPH_PROJECTION_CONSUMER_KEY,
      status: "ok",
    });
    expect(graphPort.addEpisode).toHaveBeenCalledTimes(1);
  });

  it("re-reads the message from the trusted source, filtered by the event's organization id, ignoring event payload content", async () => {
    const { deps, messageQuery } = harness();

    await processGraphProjection(event(), deps);

    expect(messageQuery.eq).toHaveBeenCalledWith("id", messageId);
    expect(messageQuery.eq).toHaveBeenCalledWith("organization_id", orgA);
  });

  it("never accepts a source message returned from another organization", async () => {
    const { deps, graphPort } = harness({
      admin: {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: messageId, body: "text", organization_id: orgB, contact_id: contactId, direction: "inbound", sent_at: "2026-08-10T12:00:00.000Z" },
            error: null,
          }),
        })),
      },
    });

    await expect(processGraphProjection(event(), deps)).resolves.toMatchObject({ status: "skipped", detail: "message_not_found" });
    expect(graphPort.addEpisode).not.toHaveBeenCalled();
  });

  it("skips cleanly when the message has no body to project", async () => {
    const { deps, graphPort } = harness({
      admin: {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: messageId, body: "", organization_id: orgA, contact_id: contactId, direction: "inbound", sent_at: "2026-08-10T12:00:00.000Z" },
            error: null,
          }),
        })),
      },
    });

    await expect(processGraphProjection(event(), deps)).resolves.toMatchObject({ status: "skipped", detail: "message_not_projectable" });
    expect(graphPort.addEpisode).not.toHaveBeenCalled();
  });

  it("builds an episode named by the stable message id, never by phone/name, with the message's own timestamp as reference time", async () => {
    const { deps, graphPort } = harness();

    await processGraphProjection(event(), deps);

    const [episode] = (graphPort.addEpisode as ReturnType<typeof vi.fn>).mock.calls[0] as [GraphEpisode, string];
    expect(episode.name).toBe(`whatsapp_message:${messageId}`);
    expect(episode.sourceId).toBe(messageId);
    expect(episode.referenceTime).toBe("2026-08-10T12:00:00.000Z");
    expect(episode.organizationId).toBe(orgA);
  });

  it("does not write again when the projection ledger is already applied", async () => {
    const { deps, graphPort } = harness({
      db: { query: vi.fn().mockResolvedValue({ rows: [{ id: "ledger-1", status: "applied" }] }) },
    });

    await expect(processGraphProjection(event(), deps)).resolves.toMatchObject({ status: "skipped", detail: "already_applied" });
    expect(graphPort.addEpisode).not.toHaveBeenCalled();
  });

  it("uses source identity and version as the stable ledger and provider idempotency key", async () => {
    const { deps, graphPort } = harness();

    await processGraphProjection(event(), deps);

    expect(graphPort.addEpisode).toHaveBeenCalledWith(
      expect.any(Object),
      `graph_projection_v1:${messageId}:2026-08-10T12:00:00.000Z`,
    );
  });

  it("relies on the adapter's own sanitizer, not a duplicate handler-side check, before any egress", async () => {
    // The handler passes the raw (unsanitized) message body straight through
    // to graphPort.addEpisode. This fake port re-implements exactly what
    // GraphitiClient.addEpisode does before it builds a request — call the
    // real sanitizeGraphEpisode() and fail closed — proving the block comes
    // from the adapter layer, not from any pre-sanitization the handler
    // itself would have to duplicate.
    const sanitizingPort = fakeGraphPort({
      addEpisode: vi.fn(async (episode: GraphEpisode) => {
        const result = sanitizeGraphEpisode(episode);
        if (!result.allowed) {
          throw new GraphitiProviderError("sanitization", `Graphiti episode blocked before egress: ${result.reason}`);
        }
      }),
    });
    const { deps, query } = harness({
      graphPort: sanitizingPort,
      admin: {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: messageId, body: "minha password: hunter2", organization_id: orgA, contact_id: contactId, direction: "inbound", sent_at: "2026-08-10T12:00:00.000Z" },
            error: null,
          }),
        })),
      },
    });

    await expect(processGraphProjection(event(), deps)).resolves.toMatchObject({ status: "retry", detail: "graphiti_sanitization" });
    expect(sanitizingPort.addEpisode).toHaveBeenCalledWith(
      expect.objectContaining({ body: "minha password: hunter2" }),
      expect.any(String),
    );
    // The ledger error code carries only the typed error kind, never the
    // sanitizer's raw reason/matched text.
    expect(JSON.stringify(query.mock.calls)).not.toContain("hunter2");
  });

  it("retries when Graphiti is unreachable, without leaking the raw provider error into the ledger", async () => {
    const outageMessage = "connect ECONNREFUSED 10.0.0.5:8000 apikey=super-secret-value";
    const graphPort = fakeGraphPort({ addEpisode: vi.fn().mockRejectedValue(new GraphitiProviderError("timeout", outageMessage)) });
    const { deps, query } = harness({ graphPort });

    await expect(processGraphProjection(event(), deps)).resolves.toMatchObject({ status: "retry", detail: "graphiti_timeout" });
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining("status='failed'"), ["ledger-1", orgA, "graphiti_timeout", expect.any(String)]);
    expect(JSON.stringify(query.mock.calls)).not.toContain("super-secret-value");
    expect(JSON.stringify(query.mock.calls)).not.toContain("10.0.0.5");
  });

  it("normalizes a non-provider error into a generic retry code, never the raw error payload", async () => {
    const graphPort = fakeGraphPort({ addEpisode: vi.fn().mockRejectedValue(new Error("unexpected: dumped secret=zzz")) });
    const { deps, query } = harness({ graphPort });

    await expect(processGraphProjection(event(), deps)).resolves.toMatchObject({ status: "retry", detail: "graph_projection_failed" });
    expect(JSON.stringify(query.mock.calls)).not.toContain("dumped secret");
  });

  it("marks the ledger applied after a successful projection", async () => {
    const { deps, query } = harness();

    await expect(processGraphProjection(event(), deps)).resolves.toEqual({ consumer_key: GRAPH_PROJECTION_CONSUMER_KEY, status: "ok" });
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining("status = 'applied'"), ["ledger-1", orgA]);
  });

  it("blocks a delayed/redelivered event whose source version is older than one already applied for the same source", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.startsWith("select id, status, source_version")) {
        return { rows: [{ id: "ledger-newer", status: "applied", source_version: "2026-08-10T13:00:00.000Z" }] };
      }
      return { rows: [{ id: "ledger-1", status: "pending" }] };
    });
    const { deps, graphPort } = harness({ db: { query } });

    await expect(processGraphProjection(event(), deps)).resolves.toEqual({
      consumer_key: GRAPH_PROJECTION_CONSUMER_KEY,
      status: "skipped",
      detail: "stale_source_version",
    });
    expect(graphPort.addEpisode).not.toHaveBeenCalled();
    expect(query.mock.calls.some(([sql]) => String(sql).startsWith("insert into ai_projection_ledger"))).toBe(false);
  });

  it("still projects when its own source version is the newest applied so far", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.startsWith("select id, status, source_version")) {
        return { rows: [{ id: "ledger-older", status: "applied", source_version: "2026-08-10T11:00:00.000Z" }] };
      }
      if (sql.startsWith("insert into ai_projection_ledger")) {
        return { rows: [{ id: "ledger-1", status: "pending" }] };
      }
      return { rows: [{ id: "ledger-1", status: "applied" }] };
    });
    const { deps, graphPort } = harness({ db: { query } });

    await expect(processGraphProjection(event(), deps)).resolves.toMatchObject({ status: "ok" });
    expect(graphPort.addEpisode).toHaveBeenCalledTimes(1);
  });

  it("degrades to a no-op null port instead of throwing when the sidecar is unconfigured while the feature is on", async () => {
    const { deps, query } = harness({ graphPort: undefined });
    const previousBaseUrl = process.env.GRAPHITI_BASE_URL;
    const previousApiKey = process.env.GRAPHITI_API_KEY;
    delete process.env.GRAPHITI_BASE_URL;
    delete process.env.GRAPHITI_API_KEY;

    try {
      await expect(processGraphProjection(event(), deps)).resolves.toEqual({ consumer_key: GRAPH_PROJECTION_CONSUMER_KEY, status: "ok" });
      expect(query).toHaveBeenLastCalledWith(expect.stringContaining("status = 'applied'"), ["ledger-1", orgA]);
    } finally {
      if (previousBaseUrl === undefined) delete process.env.GRAPHITI_BASE_URL; else process.env.GRAPHITI_BASE_URL = previousBaseUrl;
      if (previousApiKey === undefined) delete process.env.GRAPHITI_API_KEY; else process.env.GRAPHITI_API_KEY = previousApiKey;
    }
  });
});
