import { describe, expect, it, vi } from "vitest";

import { Mem0ProviderError } from "@/lib/agent-engine/memory/mem0-client";
import type { MemoryPort } from "@/lib/agent-engine/memory/port";
import { projectMessage } from "./project-message";

const orgA = "00000000-0000-4000-8000-000000000001";
const contactId = "00000000-0000-4000-8000-000000000020";
const message = { id: "00000000-0000-4000-8000-000000000010", body: "Prefere contactos por WhatsApp.", created_at: "2026-08-10T12:00:00.000Z" };

function harness(overrides: Record<string, unknown> = {}) {
  const query = vi.fn()
    .mockResolvedValueOnce({ rows: [{ id: "ledger-1", status: "pending" }] })
    .mockResolvedValue({ rows: [{ id: "ledger-1", status: "applied" }] });
  const memoryPort: MemoryPort = {
    upsert: vi.fn().mockResolvedValue(undefined),
    search: vi.fn(), deleteContact: vi.fn(), health: vi.fn(),
  };
  const input = {
    db: { query } as never,
    llmConfig: {} as never,
    memoryPort,
    organizationId: orgA,
    contactId,
    message,
    extract: vi.fn().mockResolvedValue([{ type: "preference", authorityDomain: "customer_preference", risk: "low", confidence: 0.9, actionable: false, sensitiveClassification: "none", text: "Prefere contactos por WhatsApp." }]),
    now: () => new Date("2026-08-10T12:01:00.000Z"),
    ...overrides,
  };
  return { input, query, memoryPort: input.memoryPort };
}

describe("projectMessage", () => {
  it("upserts and marks the ledger applied for a safe candidate", async () => {
    const { input, memoryPort, query } = harness();

    await expect(projectMessage(input)).resolves.toEqual({ status: "ok" });
    expect(memoryPort.upsert).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining("status = 'applied'"), ["ledger-1", orgA]);
  });

  it("skips without opening a ledger when extraction yields no safe candidates", async () => {
    const { input, query } = harness({ extract: vi.fn().mockResolvedValue([]) });

    await expect(projectMessage(input)).resolves.toEqual({ status: "skipped", detail: "no_safe_candidates" });
    expect(query).not.toHaveBeenCalled();
  });

  it("does not write again when the projection ledger is already applied", async () => {
    const { input, memoryPort } = harness({
      db: { query: vi.fn().mockResolvedValue({ rows: [{ id: "ledger-1", status: "applied" }] }) },
    });

    await expect(projectMessage(input)).resolves.toEqual({ status: "skipped", detail: "already_applied" });
    expect(memoryPort.upsert).not.toHaveBeenCalled();
  });

  it("never resurrects a source whose ledger row an LGPD delete already marked deleted", async () => {
    const { input, memoryPort } = harness({
      db: { query: vi.fn().mockResolvedValue({ rows: [{ id: "ledger-1", status: "deleted" }] }) },
    });

    await expect(projectMessage(input)).resolves.toEqual({ status: "skipped", detail: "resurrection_blocked_deleted_entity" });
    expect(memoryPort.upsert).not.toHaveBeenCalled();
  });

  it("compensates a race where the contact gets anonymized mid-flight, instead of applying a resurrection", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: "ledger-1", status: "pending" }] }) // beginProjection: race hasn't landed yet
      .mockResolvedValueOnce({ rows: [{ is_anonymized: true }] }) // isContactAnonymized: flipped while extract()+upsert() ran
      .mockResolvedValue({ rows: [{ id: "ledger-1", status: "deleted" }] }); // markProjectionDeleted
    const memoryPort: MemoryPort = {
      upsert: vi.fn().mockResolvedValue(undefined),
      search: vi.fn().mockResolvedValue([]),
      deleteContact: vi.fn().mockResolvedValue(undefined),
      health: vi.fn(),
    };
    const { input } = harness({ db: { query }, memoryPort });

    await expect(projectMessage(input)).resolves.toEqual({ status: "skipped", detail: "resurrection_blocked_deleted_entity" });

    // The upsert did happen — the ledger check alone can't prevent a race
    // that completes entirely inside the extract()+upsert() window — but the
    // resurrection gets undone instead of committed as "ok".
    expect(memoryPort.upsert).toHaveBeenCalledTimes(1);
    expect(memoryPort.deleteContact).toHaveBeenCalledWith({ organizationId: orgA, contactId });
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining("status='deleted'"), ["ledger-1", orgA]);
  });

  it("retries extraction failures without marking a projection applied", async () => {
    const { input, query } = harness({ extract: vi.fn().mockRejectedValue(new Error("boom")) });

    await expect(projectMessage(input)).resolves.toMatchObject({ status: "retry", detail: "memory_extraction_failed" });
    expect(query).not.toHaveBeenCalled();
  });

  it("retries a Mem0 provider failure and records the mapped error code, not raw text", async () => {
    const { input, query } = harness({
      memoryPort: { upsert: vi.fn().mockRejectedValue(new Mem0ProviderError("timeout", "customer message: secret words")), search: vi.fn(), deleteContact: vi.fn(), health: vi.fn() },
    });

    await expect(projectMessage(input)).resolves.toMatchObject({ status: "retry", detail: "mem0_timeout" });
    expect(JSON.stringify(query.mock.calls)).not.toContain("secret words");
  });

  it("looks up existing memories and passes them to extraction", async () => {
    const oldRecord = { id: "memory:old:0", organizationId: orgA, contactId, sourceId: "old-msg", sourceVersion: "v1", type: "preference", authorityDomain: "customer_preference", risk: "low", actionable: true, confidence: 0.9, validFrom: null, validUntil: null, text: "Prefere ligação telefônica." };
    const extract = vi.fn().mockResolvedValue([]);
    const memoryPort: MemoryPort = { upsert: vi.fn(), search: vi.fn().mockResolvedValue([oldRecord]), deleteContact: vi.fn(), health: vi.fn() };
    const { input } = harness({ extract, memoryPort });

    await projectMessage(input);

    expect(memoryPort.search).toHaveBeenCalledWith({ organizationId: orgA, contactId, query: message.body, topK: 5 });
    expect(extract).toHaveBeenCalledWith(expect.objectContaining({
      existingMemories: [{ id: "memory:old:0", text: "Prefere ligação telefônica." }],
    }));
  });

  it("retires a superseded memory (validUntil = now) alongside upserting the new one, without deleting it", async () => {
    const oldRecord = { id: "memory:old:0", organizationId: orgA, contactId, sourceId: "old-msg", sourceVersion: "v1", type: "preference", authorityDomain: "customer_preference", risk: "low", actionable: true, confidence: 0.9, validFrom: null, validUntil: null, text: "Prefere ligação telefônica." };
    const memoryPort: MemoryPort = {
      upsert: vi.fn().mockResolvedValue(undefined),
      search: vi.fn().mockResolvedValue([oldRecord]),
      deleteContact: vi.fn(),
      health: vi.fn(),
    };
    const extract = vi.fn().mockResolvedValue([
      { type: "preference", authorityDomain: "customer_preference", risk: "low", confidence: 0.9, actionable: true, sensitiveClassification: "none", text: "Prefere WhatsApp, não ligações.", supersedes: ["memory:old:0"] },
    ]);
    const { input, memoryPort: port } = harness({ extract, memoryPort });

    await expect(projectMessage(input)).resolves.toEqual({ status: "ok" });

    expect(port.upsert).toHaveBeenCalledTimes(2);
    const retireCall = (port.upsert as ReturnType<typeof vi.fn>).mock.calls.find(([record]) => record.id === "memory:old:0");
    expect(retireCall?.[0]).toMatchObject({ id: "memory:old:0", text: "Prefere ligação telefônica.", validUntil: "2026-08-10T12:01:00.000Z" });
    expect(retireCall?.[1]).toContain("retire:memory:old:0");
  });

  it("ignores a supersedes id that no longer resolves to a known existing record, without crashing", async () => {
    const memoryPort: MemoryPort = {
      upsert: vi.fn().mockResolvedValue(undefined),
      search: vi.fn().mockResolvedValue([]),
      deleteContact: vi.fn(),
      health: vi.fn(),
    };
    // extractMemoryCandidates itself would already strip an unknown id — this
    // proves projectMessage doesn't also assume every supersedes id resolves.
    const extract = vi.fn().mockResolvedValue([
      { type: "preference", authorityDomain: "customer_preference", risk: "low", confidence: 0.9, actionable: true, sensitiveClassification: "none", text: "Prefere WhatsApp.", supersedes: ["memory:gone:0"] },
    ]);
    const { input, memoryPort: port } = harness({ extract, memoryPort });

    await expect(projectMessage(input)).resolves.toEqual({ status: "ok" });
    expect(port.upsert).toHaveBeenCalledTimes(1);
  });

  it("degrades to no known memories when the existing-memory search itself fails", async () => {
    const memoryPort: MemoryPort = {
      upsert: vi.fn().mockResolvedValue(undefined),
      search: vi.fn().mockRejectedValue(new Error("mem0 down")),
      deleteContact: vi.fn(),
      health: vi.fn(),
    };
    const { input } = harness({ memoryPort });

    await expect(projectMessage(input)).resolves.toEqual({ status: "ok" });
  });

  it("replaying the same source id+version is idempotent — no second upsert", async () => {
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
    const { input, memoryPort } = harness({ db: { query } });

    await expect(projectMessage(input)).resolves.toEqual({ status: "ok" });
    await expect(projectMessage(input)).resolves.toEqual({ status: "skipped", detail: "already_applied" });
    expect(memoryPort.upsert).toHaveBeenCalledTimes(1);
  });
});
