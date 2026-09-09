import { describe, expect, it, vi } from "vitest";

import type { EventRow } from "@/lib/event-log/dispatcher";
import type { MemoryPort } from "@/lib/agent-engine/memory/port";
import { processMemoryLifecycle, MEMORY_LIFECYCLE_CONSUMER_KEY } from "./memory-lifecycle.handler";

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
    payload: { request_id: "request-1", contact_id: contactId },
    metadata: {},
    consumed_by: [],
    attempts: 0,
    ...overrides,
  };
}

function harness(overrides: Record<string, unknown> = {}) {
  const query = vi.fn().mockResolvedValue({ rows: [{ id: "ledger-1", status: "deleted" }] });
  const memoryPort: MemoryPort = {
    upsert: vi.fn(), search: vi.fn(),
    deleteContact: vi.fn().mockResolvedValue(undefined),
    health: vi.fn(),
  };
  const deps = {
    mem0Configured: true,
    db: { query },
    memoryPort,
    ...overrides,
  };
  return { deps, query, memoryPort };
}

describe("memory lifecycle handler", () => {
  it("skips without touching the provider when Mem0 was never configured", async () => {
    const { deps, memoryPort, query } = harness({ mem0Configured: false });

    await expect(processMemoryLifecycle(event(), deps)).resolves.toEqual({
      consumer_key: MEMORY_LIFECYCLE_CONSUMER_KEY,
      status: "skipped",
      detail: "mem0_not_configured",
    });
    expect(memoryPort.deleteContact).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it("deletes the contact namespace scoped to the trusted event organization id", async () => {
    const { deps, memoryPort, query } = harness();

    await expect(processMemoryLifecycle(event(), deps)).resolves.toEqual({
      consumer_key: MEMORY_LIFECYCLE_CONSUMER_KEY,
      status: "ok",
      detail: "contact_deleted",
    });
    expect(memoryPort.deleteContact).toHaveBeenCalledWith({ organizationId: orgA, contactId });
    expect(query).toHaveBeenCalledWith(expect.stringContaining("status='deleted'"), [orgA, "mem0", "contact", contactId]);
  });

  it("never wipes another org — the trusted event organization id wins even if payload disagreed", async () => {
    const { deps, memoryPort } = harness();
    const spoofed = event({
      organization_id: orgA,
      payload: { request_id: "request-1", contact_id: contactId, organization_id: orgB },
    });

    await processMemoryLifecycle(spoofed, deps);

    expect(memoryPort.deleteContact).toHaveBeenCalledWith({ organizationId: orgA, contactId });
    expect(memoryPort.deleteContact).not.toHaveBeenCalledWith({ organizationId: orgB, contactId });
  });

  it("replaying the same delete event twice is idempotent — no error, same effect", async () => {
    const { deps, memoryPort } = harness();

    await expect(processMemoryLifecycle(event(), deps)).resolves.toMatchObject({ status: "ok" });
    await expect(processMemoryLifecycle(event(), deps)).resolves.toMatchObject({ status: "ok" });
    expect(memoryPort.deleteContact).toHaveBeenCalledTimes(2);
    expect(memoryPort.deleteContact).toHaveBeenNthCalledWith(1, { organizationId: orgA, contactId });
    expect(memoryPort.deleteContact).toHaveBeenNthCalledWith(2, { organizationId: orgA, contactId });
  });

  it("retries when the Mem0 provider call fails, without throwing", async () => {
    const { deps } = harness({
      memoryPort: { upsert: vi.fn(), search: vi.fn(), deleteContact: vi.fn().mockRejectedValue(new Error("timeout")), health: vi.fn() },
    });

    await expect(processMemoryLifecycle(event(), deps)).resolves.toMatchObject({ status: "retry", detail: "mem0_delete_failed" });
  });

  it("skips a non-contact, non-tenant payload without calling the provider", async () => {
    const { deps, memoryPort } = harness();

    await expect(
      processMemoryLifecycle(event({ payload: { request_id: "request-1" } }), deps),
    ).resolves.toEqual({ consumer_key: MEMORY_LIFECYCLE_CONSUMER_KEY, status: "skipped", detail: "no_contact_id" });
    expect(memoryPort.deleteContact).not.toHaveBeenCalled();
  });

  it("tenant scope pages through anonymized contacts of the trusted org and deletes each namespace", async () => {
    const contactsPage1 = Array.from({ length: 100 }, (_, i) => ({ id: `contact-${i}` }));
    const contactsPage2 = [{ id: "contact-100" }];
    let call = 0;
    const rangeMock = vi.fn(async () => {
      call++;
      return call === 1 ? { data: contactsPage1, error: null } : { data: contactsPage2, error: null };
    });
    const admin = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: rangeMock,
      })),
    };
    const { deps, memoryPort } = harness({ admin });

    const result = await processMemoryLifecycle(
      event({ payload: { request_id: "request-1", scope: "tenant" } }),
      deps,
    );

    expect(result).toEqual({ consumer_key: MEMORY_LIFECYCLE_CONSUMER_KEY, status: "ok", detail: "tenant_deleted:101" });
    expect(memoryPort.deleteContact).toHaveBeenCalledTimes(101);
    expect(memoryPort.deleteContact).toHaveBeenCalledWith({ organizationId: orgA, contactId: "contact-0" });
    expect(memoryPort.deleteContact).toHaveBeenCalledWith({ organizationId: orgA, contactId: "contact-100" });
  });

  it("tenant scope with zero anonymized contacts is a clean ok, not an error", async () => {
    const admin = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    };
    const { deps, memoryPort } = harness({ admin });

    await expect(
      processMemoryLifecycle(event({ payload: { request_id: "request-1", scope: "tenant" } }), deps),
    ).resolves.toEqual({ consumer_key: MEMORY_LIFECYCLE_CONSUMER_KEY, status: "ok", detail: "tenant_deleted:0" });
    expect(memoryPort.deleteContact).not.toHaveBeenCalled();
  });
});
