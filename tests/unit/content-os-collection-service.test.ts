import { describe, expect, it, vi } from "vitest";

import { ContentCollectionService, type ContentOpportunityRecord, type ContentSignalRecord, type SignalCollectionRepository } from "@/lib/content-os/intelligence/collection-service";
import type { IntelligenceProvider, RawSignal } from "@/lib/content-os/providers/intelligence";
import type { ContentSourceRecord } from "@/lib/content-os/intelligence/source-service";

function fixture() {
  const source: ContentSourceRecord = { id: "source-1", organizationId: "org-1", name: "Feed", provider: "rsshub", sourceType: "news", configuration: {}, status: "active", externalRef: null };
  const signals: ContentSignalRecord[] = [];
  const opportunities: ContentOpportunityRecord[] = [];
  const repository: SignalCollectionRepository = {
    findSource: async () => source,
    findSignalByDedupKey: async ({ externalId, rawHash }) => signals.find((item) => item.externalId === externalId || item.rawHash === rawHash) ?? null,
    createSignal: async (input) => { const value = { id: `signal-${signals.length + 1}`, ...input }; signals.push(value); return value; },
    findOpportunityBySignal: async (_org, signalId) => opportunities.find((item) => item.signalId === signalId) ?? null,
    createOpportunity: async (input) => { const value = { id: `opportunity-${opportunities.length + 1}`, ...input }; opportunities.push(value); return value; },
    emit: vi.fn(async () => undefined),
  };
  return { source, signals, opportunities, repository };
}

function provider(signals: RawSignal[]): IntelligenceProvider {
  return { provider: "rsshub", collect: vi.fn(async () => signals), health: vi.fn(async () => ({ ok: true, checkedAt: "2026-08-14T10:00:00.000Z" })) };
}

describe("Content OS collection service", () => {
  it("normalizes, deduplicates the batch, creates opportunities and emits events", async () => {
    const state = fixture();
    const item: RawSignal = { externalId: "item-1", sourceType: "rsshub", sourceUrl: "https://example.com/news/1", title: "  Nova versão  ", body: "Resumo", publishedAt: "2026-08-14T09:00:00Z", observedAt: "2026-08-14T10:00:00Z", rawHash: "ignored", metadata: { feed: "x" } };
    const service = new ContentCollectionService(state.repository, { get: () => provider([item, item]) });

    await expect(service.collect({ organizationId: "org-1", sourceId: "source-1" })).resolves.toEqual({ sourceId: "source-1", fetched: 2, createdSignals: 1, duplicateSignals: 1, skippedSignals: 0, createdOpportunities: 1 });
    expect(state.signals[0]).toMatchObject({ title: "Nova versão", body: "Resumo" });
    expect(state.opportunities[0]).toMatchObject({ signalId: "signal-1", status: "new" });
    expect(state.repository.emit).toHaveBeenCalledTimes(2);
  });

  it("does not insert a signal or opportunity when collecting the same source twice", async () => {
    const state = fixture();
    const item: RawSignal = { externalId: "item-1", sourceType: "rsshub", sourceUrl: "https://example.com/news/1", title: "Nova versão", observedAt: "2026-08-14T10:00:00Z", rawHash: "ignored", metadata: {} };
    const collect = vi.fn(async () => [item]);
    const service = new ContentCollectionService(state.repository, { get: () => ({ provider: "rsshub", collect, health: vi.fn() }) });
    await service.collect({ organizationId: "org-1", sourceId: "source-1" });
    await expect(service.collect({ organizationId: "org-1", sourceId: "source-1" })).resolves.toMatchObject({ createdSignals: 0, duplicateSignals: 1, createdOpportunities: 0 });
    expect(state.signals).toHaveLength(1);
    expect(state.opportunities).toHaveLength(1);
  });

  it("blocks disabled sources and unknown providers", async () => {
    const state = fixture();
    state.source.status = "disabled";
    const service = new ContentCollectionService(state.repository, { get: () => undefined });
    await expect(service.collect({ organizationId: "org-1", sourceId: "source-1" })).rejects.toThrow("Only active sources can be collected");
    state.source.status = "active";
    await expect(service.collect({ organizationId: "org-1", sourceId: "source-1" })).rejects.toThrow("provider is not configured");
  });

  it("classifies a concurrent unique violation as a duplicate after rereading", async () => {
    const state = fixture();
    const item: RawSignal = { externalId: "raced", sourceType: "rsshub", sourceUrl: "https://example.com/raced", title: "Concorrente", observedAt: "2026-08-14T10:00:00Z", rawHash: "ignored", metadata: {} };
    let raced = false;
    state.repository.createSignal = async () => {
      raced = true;
      const error = new Error("duplicate key value violates unique constraint") as Error & { code: string };
      error.code = "23505";
      throw error;
    };
    state.repository.findSignalByDedupKey = async () => raced ? { id: "signal-winner", organizationId: "org-1", sourceId: "source-1", provider: "rsshub", externalId: "raced", rawHash: "hash", sourceUrl: item.sourceUrl, title: item.title!, body: null, publishedAt: null, observedAt: item.observedAt, metadata: {} } : null;
    const service = new ContentCollectionService(state.repository, { get: () => provider([item]) });

    await expect(service.collect({ organizationId: "org-1", sourceId: "source-1" })).resolves.toMatchObject({ createdSignals: 0, duplicateSignals: 1, createdOpportunities: 0 });
  });
});
