import { describe, expect, it, vi } from "vitest";

import { runIntelligenceWorker, type IntelligenceWorkerSource } from "@/lib/content-os/intelligence/worker";

const source = (id: string, organizationId: string, provider = "rsshub"): IntelligenceWorkerSource => ({
  id,
  organizationId,
  provider,
  status: "active",
  configuration: {},
});

describe("Content OS intelligence worker", () => {
  it("processes all tenants and isolates one provider failure", async () => {
    const sources = [source("source-a", "org-a"), source("source-b", "org-b", "changedetection")];
    const collect = vi.fn(async (item: IntelligenceWorkerSource) => {
      if (item.organizationId === "org-a") throw new Error("provider unavailable");
      return { sourceId: item.id, fetched: 1, createdSignals: 1, duplicateSignals: 0, skippedSignals: 0, createdOpportunities: 1 };
    });

    await expect(runIntelligenceWorker({ listActiveSources: async () => sources, collect })).resolves.toEqual({
      sources: 2,
      succeeded: 1,
      failed: 1,
      collected: [{ sourceId: "source-b", fetched: 1, createdSignals: 1, duplicateSignals: 0, skippedSignals: 0, createdOpportunities: 1 }],
      failures: [{ sourceId: "source-a", organizationId: "org-a", provider: "rsshub", code: "collection_failed" }],
    });
    expect(collect).toHaveBeenCalledWith(sources[0]);
    expect(collect).toHaveBeenCalledWith(sources[1]);
  });

  it("reports an unconfigured provider without leaking its error", async () => {
    const item = source("source-a", "org-a", "rsshub");
    const collect = vi.fn(async () => { throw new Error("provider_not_configured"); });
    const result = await runIntelligenceWorker({ listActiveSources: async () => [item], collect });
    expect(result.failures).toEqual([{ sourceId: "source-a", organizationId: "org-a", provider: "rsshub", code: "collection_failed" }]);
  });

  it("does not run an unlisted tenant or disabled source", async () => {
    const collect = vi.fn();
    const result = await runIntelligenceWorker({ listActiveSources: async () => [], collect });
    expect(result).toMatchObject({ sources: 0, succeeded: 0, failed: 0 });
    expect(collect).not.toHaveBeenCalled();
  });
});
