import { describe, expect, it, vi } from "vitest";

import { GraphitiContextProvider } from "./graphiti-context-provider";
import { GraphitiProviderError } from "../graph/graphiti-client";
import type { GraphContextPort } from "../graph/port";
import type { GraphFact } from "../graph/types";

const request = {
  organizationId: "00000000-0000-4000-8000-000000000001",
  contactId: "00000000-0000-4000-8000-000000000002",
  conversationId: "00000000-0000-4000-8000-000000000003",
  agentId: "00000000-0000-4000-8000-000000000004",
  query: "Como este cliente prefere ser contactado?",
  now: "2026-08-11T10:00:00.000Z",
};

function fact(overrides: Partial<GraphFact> = {}): GraphFact {
  return {
    id: "fact-1",
    text: "Cliente prefere ser contatado à tarde.",
    sourceId: "episode-1",
    validFrom: "2026-08-01T10:00:00.000Z",
    validUntil: null,
    confidence: 0.6,
    authorityDomain: "customer_preference",
    risk: "low",
    ...overrides,
  };
}

function graphPort(facts: unknown[] = [fact()]): GraphContextPort {
  return {
    addEpisode: vi.fn(),
    search: vi.fn().mockResolvedValue(facts),
    deleteOrganization: vi.fn(),
    health: vi.fn().mockResolvedValue({ ok: true, latencyMs: 1 }),
  };
}

describe("GraphitiContextProvider", () => {
  it("does not call Graphiti while the feature is off", async () => {
    const port = graphPort();
    const provider = new GraphitiContextProvider({
      graph: port,
      resolveFeature: vi.fn().mockResolvedValue({ mode: "off", config: {}, killed: false }),
    });

    await expect(provider.retrieve(request)).resolves.toMatchObject({
      provider: "graphiti",
      items: [],
      influencePrompt: false,
      bucket: "disabled",
    });
    expect(port.search).not.toHaveBeenCalled();
  });

  it("collects a shadow result without making it prompt-influential", async () => {
    const port = graphPort();
    const metric = vi.fn();
    const provider = new GraphitiContextProvider({
      graph: port,
      resolveFeature: vi.fn().mockResolvedValue({ mode: "shadow", config: {}, killed: false }),
      recordShadowMetric: metric,
    });

    const result = await provider.retrieve({ ...request, nativeSourceIds: ["episode-1", "note-1"] });

    expect(result).toMatchObject({
      items: [],
      influencePrompt: false,
      bucket: "shadow",
      shadowItems: [expect.objectContaining({ id: "fact-1" })],
    });
    expect(metric).toHaveBeenCalledWith(expect.objectContaining({
      provider: "graphiti",
      resultCount: 1,
      selectedCount: 0,
      notSelectedCount: 1,
      overlappingSourceIds: 1,
      nativeSourceCount: 2,
    }));
    expect(JSON.stringify(metric.mock.calls)).not.toContain(fact().text);
  });

  it("scopes the graph search to exactly organizationId/query/limit, never contactId or a raw group id", async () => {
    const port = graphPort();
    const provider = new GraphitiContextProvider({
      graph: port,
      resolveFeature: vi.fn().mockResolvedValue({ mode: "shadow", config: {}, killed: false }),
    });

    await provider.retrieve(request);

    expect(port.search).toHaveBeenCalledTimes(1);
    expect(port.search).toHaveBeenCalledWith({
      organizationId: request.organizationId,
      query: request.query,
      limit: 5,
    });
  });

  it.each(["canary", "on"] as const)(
    "returns bounded candidate items eligible for fusion in %s mode, still non-actionable",
    async (mode) => {
      const port = graphPort();
      const provider = new GraphitiContextProvider({
        graph: port,
        resolveFeature: vi.fn().mockResolvedValue({ mode, config: { limit: 999 }, killed: false }),
      });

      const result = await provider.retrieve(request);

      expect(port.search).toHaveBeenCalledWith(expect.objectContaining({ limit: 10 }));
      expect(result).toMatchObject({
        influencePrompt: true,
        bucket: "candidate",
        items: [expect.objectContaining({
          id: "fact-1",
          authorityDomain: "customer_preference",
          risk: "low",
          // No task in this plan has defined a criterion for graph facts to
          // authorize an action: canary/on makes a fact fusion-eligible, not
          // prompt-authoritative.
          actionable: false,
        })],
      });
    },
  );

  it("marks a high-risk (protected/unclassified) fact non-actionable even in on mode", async () => {
    const port = graphPort([fact({
      id: "fact-behavior",
      text: "Detalhe operacional sem classificação de domínio.",
      authorityDomain: "behavior",
    })]);
    const provider = new GraphitiContextProvider({
      graph: port,
      resolveFeature: vi.fn().mockResolvedValue({ mode: "on", config: {}, killed: false }),
    });

    const result = await provider.retrieve(request);

    expect(result.items).toEqual([expect.objectContaining({
      id: "fact-behavior",
      authorityDomain: "behavior",
      risk: "high",
      actionable: false,
    })]);
  });

  it("returns an empty degraded result when the provider times out, without leaking GraphitiProviderError", async () => {
    const port = graphPort();
    vi.mocked(port.search).mockRejectedValue(new GraphitiProviderError("timeout", "Graphiti request timed out"));
    const metric = vi.fn();
    const provider = new GraphitiContextProvider({
      graph: port,
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

  it("degrades to disabled bucket (not shadow) when a timeout happens outside shadow mode", async () => {
    const port = graphPort();
    vi.mocked(port.search).mockRejectedValue(new GraphitiProviderError("timeout", "Graphiti request timed out"));
    const provider = new GraphitiContextProvider({
      graph: port,
      resolveFeature: vi.fn().mockResolvedValue({ mode: "on", config: {}, killed: false }),
    });

    await expect(provider.retrieve(request)).resolves.toMatchObject({
      items: [],
      shadowItems: [],
      degraded: true,
      influencePrompt: false,
      bucket: "disabled",
    });
  });

  it("does not let a successful shadow telemetry failure reject the retrieved result", async () => {
    const provider = new GraphitiContextProvider({
      graph: graphPort(),
      resolveFeature: vi.fn().mockResolvedValue({ mode: "shadow", config: {}, killed: false }),
      recordShadowMetric: vi.fn().mockRejectedValue(new Error("telemetry unavailable")),
    });

    await expect(provider.retrieve(request)).resolves.toMatchObject({
      shadowItems: [expect.objectContaining({ id: "fact-1" })],
      degraded: false,
      influencePrompt: false,
      bucket: "shadow",
    });
  });

  it("rejects malformed provider records instead of granting them authority", async () => {
    const port = graphPort([{ ...fact(), confidence: "not-a-number" }]);
    const provider = new GraphitiContextProvider({
      graph: port,
      resolveFeature: vi.fn().mockResolvedValue({ mode: "on", config: {}, killed: false }),
    });

    const result = await provider.retrieve(request);

    expect(result.items).toEqual([]);
    expect(result.degraded).toBe(true);
  });
});
