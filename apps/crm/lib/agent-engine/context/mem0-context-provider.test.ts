import { describe, expect, it, vi } from "vitest";

import { Mem0ContextProvider } from "./mem0-context-provider";
import type { MemoryPort } from "../memory/port";
import type { SemanticMemoryRecord } from "../memory/types";

const request = {
  organizationId: "00000000-0000-4000-8000-000000000001",
  contactId: "00000000-0000-4000-8000-000000000002",
  conversationId: "00000000-0000-4000-8000-000000000003",
  agentId: "00000000-0000-4000-8000-000000000004",
  query: "Como este cliente prefere ser contactado?",
  now: "2026-08-11T10:00:00.000Z",
};

const memory: SemanticMemoryRecord = {
  id: "memory-1",
  organizationId: request.organizationId,
  contactId: request.contactId,
  sourceId: "message-1",
  sourceVersion: "1",
  type: "preference",
  authorityDomain: "customer_preference",
  risk: "low",
  actionable: true,
  confidence: 0.8,
  validFrom: "2026-08-10T10:00:00.000Z",
  validUntil: null,
  text: "Prefere receber novidades por WhatsApp.",
};

function memoryPort(records: unknown[] = [memory]): MemoryPort {
  return {
    upsert: vi.fn(),
    search: vi.fn().mockResolvedValue(records),
    deleteContact: vi.fn(),
    health: vi.fn().mockResolvedValue({ ok: true, latencyMs: 1 }),
  };
}

describe("Mem0ContextProvider", () => {
  it("does not call Mem0 while the feature is off", async () => {
    const port = memoryPort();
    const provider = new Mem0ContextProvider({
      memory: port,
      resolveFeature: vi.fn().mockResolvedValue({ mode: "off", config: {}, killed: false }),
    });

    await expect(provider.retrieve(request)).resolves.toMatchObject({
      provider: "mem0",
      items: [],
      influencePrompt: false,
      bucket: "disabled",
    });
    expect(port.search).not.toHaveBeenCalled();
  });

  it("collects a shadow result without making it prompt-influential", async () => {
    const port = memoryPort();
    const metric = vi.fn();
    const provider = new Mem0ContextProvider({
      memory: port,
      resolveFeature: vi.fn().mockResolvedValue({ mode: "shadow", config: {}, killed: false }),
      recordShadowMetric: metric,
    });

    const result = await provider.retrieve({ ...request, nativeSourceIds: ["message-1", "note-1"] });

    expect(port.search).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: request.organizationId,
      contactId: request.contactId,
      topK: 5,
    }));
    expect(result).toMatchObject({
      items: [],
      influencePrompt: false,
      bucket: "shadow",
      shadowItems: [expect.objectContaining({ id: memory.id })],
    });
    expect(metric).toHaveBeenCalledWith(expect.objectContaining({
      provider: "mem0",
      resultCount: 1,
      selectedCount: 0,
      notSelectedCount: 1,
      overlappingSourceIds: 1,
      nativeSourceCount: 2,
    }));
    expect(JSON.stringify(metric.mock.calls)).not.toContain(memory.text);
  });

  it.each(["canary", "on"] as const)("returns bounded candidate items in %s mode", async (mode) => {
    const port = memoryPort();
    const provider = new Mem0ContextProvider({
      memory: port,
      resolveFeature: vi.fn().mockResolvedValue({ mode, config: { topK: 999 }, killed: false }),
    });

    const result = await provider.retrieve(request);

    expect(port.search).toHaveBeenCalledWith(expect.objectContaining({ topK: 10 }));
    expect(result).toMatchObject({
      influencePrompt: true,
      bucket: "candidate",
      items: [expect.objectContaining({
        authorityDomain: "customer_preference",
        authorityLevel: 40,
        risk: "low",
      })],
    });
  });

  it("returns an empty degraded result when the provider times out", async () => {
    const port = memoryPort();
    vi.mocked(port.search).mockRejectedValue(new Error("Mem0 request timed out"));
    const metric = vi.fn();
    const provider = new Mem0ContextProvider({
      memory: port,
      resolveFeature: vi.fn().mockResolvedValue({ mode: "shadow", config: {}, killed: false }),
      recordShadowMetric: metric,
    });

    await expect(provider.retrieve(request)).resolves.toMatchObject({
      items: [],
      shadowItems: [],
      degraded: true,
      influencePrompt: false,
      bucket: "shadow",
    });
    expect(metric).toHaveBeenCalledWith(expect.objectContaining({ degraded: true, resultCount: 0 }));
  });

  it("does not let a successful shadow telemetry failure reject the retrieved result", async () => {
    const provider = new Mem0ContextProvider({
      memory: memoryPort(),
      resolveFeature: vi.fn().mockResolvedValue({ mode: "shadow", config: {}, killed: false }),
      recordShadowMetric: vi.fn().mockRejectedValue(new Error("telemetry unavailable")),
    });

    await expect(provider.retrieve(request)).resolves.toMatchObject({
      shadowItems: [expect.objectContaining({ id: memory.id })],
      degraded: false,
      influencePrompt: false,
      bucket: "shadow",
    });
  });

  it("does not let fallback shadow telemetry failure reject a degraded result", async () => {
    const port = memoryPort();
    vi.mocked(port.search).mockRejectedValue(new Error("Mem0 unavailable"));
    const provider = new Mem0ContextProvider({
      memory: port,
      resolveFeature: vi.fn().mockResolvedValue({ mode: "shadow", config: {}, killed: false }),
      recordShadowMetric: vi.fn().mockRejectedValue(new Error("telemetry unavailable")),
    });

    await expect(provider.retrieve(request)).resolves.toMatchObject({
      items: [],
      shadowItems: [],
      degraded: true,
      influencePrompt: false,
      bucket: "shadow",
    });
  });

  it("rejects malformed provider records instead of granting them authority", async () => {
    const port = memoryPort([{ ...memory, authorityDomain: "legal", risk: "high", confidence: 0.8, validFrom: "not-a-date" }]);
    const provider = new Mem0ContextProvider({
      memory: port,
      resolveFeature: vi.fn().mockResolvedValue({ mode: "on", config: {}, killed: false }),
    });

    const result = await provider.retrieve(request);

    expect(result.items).toEqual([]);
    expect(result.degraded).toBe(true);
  });
});
