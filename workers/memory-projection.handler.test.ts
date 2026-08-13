import { describe, expect, it, vi } from "vitest";

import type { EventRow } from "@/lib/event-log/dispatcher";
import type { MemoryPort } from "@/lib/agent-engine/memory/port";
import { Mem0ProviderError } from "@/lib/agent-engine/memory/mem0-client";
import { processMemoryProjection, MEMORY_PROJECTION_CONSUMER_KEY } from "./memory-projection.handler";

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
    payload: { message_id: messageId },
    metadata: {},
    consumed_by: [],
    attempts: 0,
    ...overrides,
  };
}

function harness(overrides: Record<string, unknown> = {}) {
  const messageQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { id: messageId, body: "Prefere contactos por WhatsApp.", organization_id: orgA, conversation_id: "conversation-a", created_at: "2026-08-10T12:00:00.000Z" },
      error: null,
    }),
  };
  const conversationQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { id: "conversation-a", organization_id: orgA, contact_id: contactId },
      error: null,
    }),
  };
  const admin = { from: vi.fn((table: string) => table === "messages" ? messageQuery : conversationQuery) };
  const query = vi.fn()
    .mockResolvedValueOnce({ rows: [{ id: "ledger-1", status: "pending" }] })
    .mockResolvedValue({ rows: [{ id: "ledger-1", status: "applied" }] });
  const memoryPort: MemoryPort = {
    upsert: vi.fn().mockResolvedValue(undefined),
    search: vi.fn(), deleteContact: vi.fn(), health: vi.fn(),
  };
  const deps = {
    resolveFeature: vi.fn().mockResolvedValue({ mode: "shadow", config: {}, killed: false }),
    admin,
    db: { query },
    llmConfig: {},
    extract: vi.fn().mockResolvedValue([{ type: "preference", authorityDomain: "customer_preference", risk: "low", confidence: 0.9, actionable: false, sensitiveClassification: "none", text: "Prefere contactos por WhatsApp." }]),
    memoryPort,
    now: () => new Date("2026-08-10T12:01:00.000Z"),
    ...overrides,
  };
  return { deps, admin, messageQuery, conversationQuery, query, memoryPort };
}

describe("memory projection handler", () => {
  it("skips without loading a source when the feature is off", async () => {
    const { deps, admin, memoryPort } = harness({ resolveFeature: vi.fn().mockResolvedValue({ mode: "off", config: {}, killed: false }) });

    await expect(processMemoryProjection(event(), deps)).resolves.toEqual({ consumer_key: MEMORY_PROJECTION_CONSUMER_KEY, status: "skipped", detail: "feature_off" });
    expect(admin.from).not.toHaveBeenCalled();
    expect(memoryPort.upsert).not.toHaveBeenCalled();
  });

  it.each(["shadow", "canary", "on"])("projects when the feature mode is %s", async (mode) => {
    const { deps, memoryPort } = harness({ resolveFeature: vi.fn().mockResolvedValue({ mode, config: {}, killed: false }) });

    await expect(processMemoryProjection(event(), deps)).resolves.toMatchObject({ status: "ok" });
    expect(memoryPort.upsert).toHaveBeenCalledTimes(1);
  });

  it("loads both the message and its contact with the trusted organization id", async () => {
    const { deps, messageQuery, conversationQuery } = harness();

    await processMemoryProjection(event(), deps);

    expect(messageQuery.eq).toHaveBeenCalledWith("organization_id", orgA);
    expect(conversationQuery.eq).toHaveBeenCalledWith("organization_id", orgA);
  });

  it("does not write again when the projection ledger is already applied", async () => {
    const { deps, memoryPort } = harness({
      db: { query: vi.fn().mockResolvedValue({ rows: [{ id: "ledger-1", status: "applied" }] }) },
    });

    await expect(processMemoryProjection(event(), deps)).resolves.toMatchObject({ status: "skipped", detail: "already_applied" });
    expect(memoryPort.upsert).not.toHaveBeenCalled();
  });

  it("skips cleanly without opening a ledger or provider when extraction yields no safe candidates", async () => {
    const { deps, query } = harness({
      extract: vi.fn().mockResolvedValue([]),
      memoryPort: undefined,
    });

    await expect(processMemoryProjection(event(), deps)).resolves.toEqual({
      consumer_key: MEMORY_PROJECTION_CONSUMER_KEY,
      status: "skipped",
      detail: "no_safe_candidates",
    });
    expect(query).not.toHaveBeenCalled();
  });

  it("uses source identity and version as the stable ledger and provider idempotency key", async () => {
    const seenKeys = new Set<string>();
    const query = vi.fn(async (sql: string, values: unknown[]) => {
      if (sql.startsWith("insert into ai_projection_ledger")) {
        const key = values[7] as string;
        const prior = seenKeys.has(key);
        seenKeys.add(key);
        return { rows: [{ id: "ledger-1", status: prior ? "applied" : "pending" }] };
      }
      return { rows: [{ id: "ledger-1", status: "applied" }] };
    });
    const { deps, memoryPort } = harness({ db: { query } });
    const replay = event({ id: "00000000-0000-4000-8000-000000000031" });

    await expect(processMemoryProjection(event(), deps)).resolves.toMatchObject({ status: "ok" });
    await expect(processMemoryProjection(replay, deps)).resolves.toMatchObject({ status: "skipped", detail: "already_applied" });

    expect(memoryPort.upsert).toHaveBeenCalledTimes(1);
    expect(memoryPort.upsert).toHaveBeenCalledWith(expect.any(Object), "memory_projection_v1:00000000-0000-4000-8000-000000000010:2026-08-10T12:00:00.000Z:0");
    const insertCalls = query.mock.calls.filter(([sql]) => String(sql).startsWith("insert into ai_projection_ledger"));
    expect(insertCalls.map(([, values]) => values[7])).toEqual([
      "memory_projection_v1:00000000-0000-4000-8000-000000000010:2026-08-10T12:00:00.000Z",
      "memory_projection_v1:00000000-0000-4000-8000-000000000010:2026-08-10T12:00:00.000Z",
    ]);
  });

  it("retries extraction failures without marking a projection applied", async () => {
    const { deps, query } = harness({ extract: vi.fn().mockRejectedValue(new Error("model response included raw customer message")) });

    await expect(processMemoryProjection(event(), deps)).resolves.toMatchObject({ status: "retry", detail: "memory_extraction_failed" });
    expect(query).not.toHaveBeenCalled();
  });

  it("retries a Mem0 timeout without persisting raw text in the ledger error", async () => {
    const { deps, query } = harness({ memoryPort: { upsert: vi.fn().mockRejectedValue(new Mem0ProviderError("timeout", "customer message: secret words")), search: vi.fn(), deleteContact: vi.fn(), health: vi.fn() } });

    await expect(processMemoryProjection(event(), deps)).resolves.toMatchObject({ status: "retry", detail: "mem0_timeout" });
    expect(JSON.stringify(query.mock.calls)).not.toContain("secret words");
  });

  it("marks the ledger applied after a successful projection", async () => {
    const { deps, query } = harness();

    await expect(processMemoryProjection(event(), deps)).resolves.toEqual({ consumer_key: MEMORY_PROJECTION_CONSUMER_KEY, status: "ok" });
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining("status = 'applied'"), ["ledger-1", orgA]);
  });

  it("a delayed event for an already-LGPD-redacted contact does not resurrect memory: the source re-read is live, and redaction already blanked the body", async () => {
    // The handler never trusts the event payload for content — it always
    // re-reads `messages` from Postgres, the source of truth. If the LGPD
    // cascade already ran (contact anonymized, message.body wiped) by the
    // time a delayed/redelivered old `message.received` event is drained,
    // this live read sees the post-redaction row, not a stale snapshot.
    const { deps, memoryPort } = harness({
      admin: {
        from: vi.fn((table: string) =>
          table === "messages"
            ? { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: messageId, body: "", organization_id: orgA, conversation_id: "conversation-a", created_at: "2026-08-10T12:00:00.000Z" }, error: null }) }
            : { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: "conversation-a", organization_id: orgA, contact_id: contactId }, error: null }) },
        ),
      },
    });

    await expect(processMemoryProjection(event(), deps)).resolves.toEqual({
      consumer_key: MEMORY_PROJECTION_CONSUMER_KEY,
      status: "skipped",
      detail: "message_not_projectable",
    });
    expect(memoryPort.upsert).not.toHaveBeenCalled();
  });

  it("never accepts a source message returned from another organization", async () => {
    const { deps, memoryPort } = harness({
      admin: {
        from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: messageId, body: "text", organization_id: orgB, conversation_id: "conversation-a", created_at: "2026-08-10T12:00:00.000Z" }, error: null }) })),
      },
    });

    await expect(processMemoryProjection(event(), deps)).resolves.toMatchObject({ status: "skipped", detail: "message_not_found" });
    expect(memoryPort.upsert).not.toHaveBeenCalled();
  });
});
