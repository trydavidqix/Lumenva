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
  return { input, query, memoryPort };
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
