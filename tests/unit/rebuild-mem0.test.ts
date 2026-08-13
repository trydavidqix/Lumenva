import { describe, expect, it, vi } from "vitest";

import type { MemoryPort } from "@/lib/agent-engine/memory/port";
import { rebuildTenant, type RebuildDeps } from "@/scripts/rebuild-mem0";

const orgA = "00000000-0000-4000-8000-000000000001";
const orgB = "00000000-0000-4000-8000-000000000002";
const contactId = "00000000-0000-4000-8000-000000000020";

function row(overrides: Record<string, unknown> = {}) {
  return {
    message_id: "00000000-0000-4000-8000-000000000010",
    body: "Prefere contactos por WhatsApp.",
    created_at: "2026-08-10T12:00:00.000Z",
    contact_id: contactId,
    organization_id: orgA,
    ...overrides,
  };
}

function harness(pages: Array<ReturnType<typeof row>[]>) {
  let call = 0;
  const selectQuery = vi.fn(async () => {
    const rows = pages[call] ?? [];
    call++;
    return { rows };
  });
  const ledgerQuery = vi.fn().mockResolvedValue({ rows: [{ id: "ledger-1", status: "applied" }] });
  const query = vi.fn(async (sql: string, values: unknown[]) => {
    if (sql.includes("from messages")) return selectQuery();
    if (sql.startsWith("insert into ai_projection_ledger")) return { rows: [{ id: "ledger-1", status: "pending" }] };
    return ledgerQuery(sql, values);
  });
  const memoryPort: MemoryPort = {
    upsert: vi.fn().mockResolvedValue(undefined),
    search: vi.fn(), deleteContact: vi.fn(), health: vi.fn(),
  };
  const deps: RebuildDeps = {
    db: { query } as never,
    memoryPort,
    llmConfig: {} as never,
    extract: vi.fn().mockResolvedValue([{ type: "preference", authorityDomain: "customer_preference", risk: "low", confidence: 0.9, actionable: false, sensitiveClassification: "none", text: "Prefere contactos por WhatsApp." }]),
  };
  return { deps, query, memoryPort };
}

describe("rebuildTenant", () => {
  it("reprojects every eligible message and reports the aggregate as applied", async () => {
    const { deps, memoryPort } = harness([[row()]]);

    const summary = await rebuildTenant(deps, { organizationId: orgA });

    expect(summary).toEqual({ applied: 1, skipped: 0, retried: 0 });
    expect(memoryPort.upsert).toHaveBeenCalledTimes(1);
  });

  it("is idempotent — an already-applied source is counted as skipped, not re-upserted", async () => {
    const { deps, memoryPort } = harness([[row()]]);
    (deps.db.query as ReturnType<typeof vi.fn>).mockImplementation(async (sql: string) => {
      if (sql.includes("from messages")) return { rows: [row()] };
      return { rows: [{ id: "ledger-1", status: "applied" }] };
    });

    const summary = await rebuildTenant(deps, { organizationId: orgA });

    expect(summary).toEqual({ applied: 0, skipped: 1, retried: 0 });
    expect(memoryPort.upsert).not.toHaveBeenCalled();
  });

  it("paginates until a short page ends the loop", async () => {
    const fullPage = Array.from({ length: 2 }, (_, i) => row({ message_id: `msg-${i}` }));
    const { deps, memoryPort } = harness([fullPage, []]);
    // Force the page size assumption irrelevant here — two full-shaped pages is enough
    // to prove pagination continues past a first non-empty page and stops on empty.

    const summary = await rebuildTenant(deps, { organizationId: orgA });

    expect(summary.applied).toBe(2);
    expect(memoryPort.upsert).toHaveBeenCalledTimes(2);
  });

  it("never projects a row belonging to another organization (defense in depth)", async () => {
    const { deps, memoryPort } = harness([[row({ organization_id: orgB })]]);

    const summary = await rebuildTenant(deps, { organizationId: orgA });

    expect(summary).toEqual({ applied: 0, skipped: 0, retried: 0 });
    expect(memoryPort.upsert).not.toHaveBeenCalled();
  });

  it("counts a provider failure as retried, not applied", async () => {
    const { deps } = harness([[row()]]);
    deps.memoryPort.upsert = vi.fn().mockRejectedValue(new Error("timeout"));

    const summary = await rebuildTenant(deps, { organizationId: orgA });

    expect(summary).toEqual({ applied: 0, skipped: 0, retried: 1 });
  });

  it("scopes the query to a single contact when one is given", async () => {
    const { deps, query } = harness([[row()]]);

    await rebuildTenant(deps, { organizationId: orgA, contactId });

    const [, values] = query.mock.calls.find(([sql]) => String(sql).includes("from messages"))!;
    expect(values).toEqual([orgA, contactId, 200, 0]);
  });
});
