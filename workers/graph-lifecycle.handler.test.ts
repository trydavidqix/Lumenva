import { describe, expect, it, vi } from "vitest";

import { GraphitiProviderError } from "@/lib/agent-engine/graph/graphiti-client";
import type { GraphContextPort } from "@/lib/agent-engine/graph/port";
import type { EventRow } from "@/lib/event-log/dispatcher";
import { processGraphLifecycle, GRAPH_LIFECYCLE_CONSUMER_KEY } from "./graph-lifecycle.handler";

const orgA = "00000000-0000-4000-8000-000000000001";
const orgB = "00000000-0000-4000-8000-000000000002";
const contactId = "00000000-0000-4000-8000-000000000020";

function event(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: "00000000-0000-4000-8000-000000000030",
    organization_id: orgA,
    event_type: "lgpd.redact_applied",
    entity_kind: "lgpd_request",
    entity_id: "request-1",
    payload: { request_id: "request-1", scope: "tenant" },
    metadata: {},
    consumed_by: [],
    attempts: 0,
    ...overrides,
  };
}

function harness(overrides: Record<string, unknown> = {}) {
  const query = vi.fn().mockResolvedValue({ rows: [{ id: "ledger-1", status: "deleted" }] });
  const graphPort: GraphContextPort = {
    addEpisode: vi.fn(),
    search: vi.fn(),
    deleteOrganization: vi.fn().mockResolvedValue(undefined),
    health: vi.fn(),
  };
  const deps = {
    graphitiConfigured: true,
    db: { query },
    graphPort,
    ...overrides,
  };
  return { deps, query, graphPort };
}

describe("graph lifecycle handler", () => {
  it("skips without touching the provider or db when Graphiti was never configured", async () => {
    const { deps, graphPort, query } = harness({ graphitiConfigured: false });

    await expect(processGraphLifecycle(event(), deps)).resolves.toEqual({
      consumer_key: GRAPH_LIFECYCLE_CONSUMER_KEY,
      status: "skipped",
      detail: "graphiti_not_configured",
    });
    expect(graphPort.deleteOrganization).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it("tenant scope purges the whole group and bulk-marks the org's applied graph ledger rows deleted", async () => {
    const { deps, graphPort, query } = harness();

    await expect(processGraphLifecycle(event(), deps)).resolves.toEqual({
      consumer_key: GRAPH_LIFECYCLE_CONSUMER_KEY,
      status: "ok",
      detail: "tenant_group_purged",
    });
    expect(graphPort.deleteOrganization).toHaveBeenCalledWith(orgA);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("status='deleted'"),
      [orgA, "graphiti"],
    );
  });

  it("never wipes another org — the trusted event organization id wins even if payload disagreed", async () => {
    const { deps, graphPort, query } = harness();
    const spoofed = event({
      organization_id: orgA,
      payload: { request_id: "request-1", scope: "tenant", organization_id: orgB },
    });

    await processGraphLifecycle(spoofed, deps);

    expect(graphPort.deleteOrganization).toHaveBeenCalledWith(orgA);
    expect(graphPort.deleteOrganization).not.toHaveBeenCalledWith(orgB);
    for (const call of query.mock.calls) {
      expect(call[1]).not.toContain(orgB);
    }
  });

  it("contact scope marks only that contact's applied graph ledger rows deleted — never calls deleteOrganization", async () => {
    const { deps, graphPort, query } = harness();

    await expect(
      processGraphLifecycle(event({ payload: { request_id: "request-1", contact_id: contactId } }), deps),
    ).resolves.toEqual({
      consumer_key: GRAPH_LIFECYCLE_CONSUMER_KEY,
      status: "ok",
      detail: "contact_ledger_marked_deleted",
    });
    expect(graphPort.deleteOrganization).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("status='deleted'"),
      [orgA, "graphiti", "contact", contactId],
    );
  });

  it("skips a non-tenant payload with no contact_id, without calling the provider", async () => {
    const { deps, graphPort, query } = harness();

    await expect(
      processGraphLifecycle(event({ payload: { request_id: "request-1" } }), deps),
    ).resolves.toEqual({ consumer_key: GRAPH_LIFECYCLE_CONSUMER_KEY, status: "skipped", detail: "no_contact_id" });
    expect(graphPort.deleteOrganization).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it("replaying the same tenant purge event twice is idempotent — no error, same effect", async () => {
    const { deps, graphPort } = harness();

    await expect(processGraphLifecycle(event(), deps)).resolves.toMatchObject({ status: "ok" });
    await expect(processGraphLifecycle(event(), deps)).resolves.toMatchObject({ status: "ok" });
    expect(graphPort.deleteOrganization).toHaveBeenCalledTimes(2);
    expect(graphPort.deleteOrganization).toHaveBeenNthCalledWith(1, orgA);
    expect(graphPort.deleteOrganization).toHaveBeenNthCalledWith(2, orgA);
  });

  it("retries with the typed provider error code when Graphiti purge fails, without throwing", async () => {
    const { deps } = harness({
      graphPort: {
        addEpisode: vi.fn(),
        search: vi.fn(),
        deleteOrganization: vi.fn().mockRejectedValue(new GraphitiProviderError("timeout", "Graphiti request timed out")),
        health: vi.fn(),
      },
    });

    await expect(processGraphLifecycle(event(), deps)).resolves.toMatchObject({
      status: "retry",
      detail: "graphiti_timeout",
    });
  });

  it("retries with a generic error code for a non-provider failure, without leaking the raw message", async () => {
    const { deps } = harness({
      graphPort: {
        addEpisode: vi.fn(),
        search: vi.fn(),
        deleteOrganization: vi.fn().mockRejectedValue(new Error("connection refused to secret-internal-host")),
        health: vi.fn(),
      },
    });

    const result = await processGraphLifecycle(event(), deps);
    expect(result).toMatchObject({ status: "retry", detail: "graph_lifecycle_failed" });
    expect(JSON.stringify(result)).not.toContain("secret-internal-host");
  });

  it("a half-configured adapter (GRAPHITI_BASE_URL set, GRAPHITI_API_KEY missing — a plausible self-host mistake) degrades to a retry-eligible result instead of the returned promise rejecting (Finding 5 regression)", async () => {
    // No `graphPort` override in deps — this deliberately exercises the REAL
    // `defaultGraphPort()` construction path (`new GraphitiClient(...)`),
    // not a mock. `GraphitiClient`'s constructor throws synchronously on
    // invalid config. Before the fix, that construction happened OUTSIDE the
    // handler's try block, so the promise this function returns would
    // REJECT — the event-log dispatcher treats a rejected promise as
    // `status:"error"` (a dead end), not `status:"retry"`. After the fix,
    // construction happens inside the try block on the one branch that
    // needs it, so the same misconfiguration must resolve (not reject) with
    // a retry-eligible result, exactly like the sibling
    // `graph-projection.handler.ts` degrades gracefully on the same class of
    // misconfiguration.
    vi.stubEnv("GRAPHITI_BASE_URL", "http://graphiti:8000");
    vi.stubEnv("GRAPHITI_API_KEY", "");
    try {
      const query = vi.fn().mockResolvedValue({ rows: [{ id: "ledger-1", status: "deleted" }] });
      const deps = { graphitiConfigured: true, db: { query } };

      await expect(processGraphLifecycle(event(), deps)).resolves.toMatchObject({
        status: "retry",
        detail: "graphiti_configuration",
      });
      expect(query).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
