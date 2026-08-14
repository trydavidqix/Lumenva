import { describe, expect, it } from "vitest";

import type { CreativeProvider } from "@/lib/content-os/providers/creative";
import type { DistributionProvider } from "@/lib/content-os/providers/distribution";
import type { IntelligenceProvider } from "@/lib/content-os/providers/intelligence";
import { ContentOsProviderRegistry } from "@/lib/content-os/providers/registry";
import { providerJobStates } from "@/lib/content-os/providers/types";
import type { VideoComposer } from "@/lib/content-os/providers/video-composer";

describe("Content OS provider contracts", () => {
  it("exposes the states that a provider job may report", () => {
    expect(providerJobStates).toEqual([
      "queued",
      "running",
      "succeeded",
      "failed",
      "cancelled",
    ]);
  });

  it("accepts complete implementations for every provider boundary", async () => {
    const intelligence: IntelligenceProvider = {
      provider: "test-intelligence",
      collect: async () => [],
      health: async () => ({ ok: true, checkedAt: new Date(0).toISOString() }),
    };
    const creative: CreativeProvider = {
      provider: "test-creative",
      generate: async () => ({ provider: "test-creative", providerJobId: "creative-1", state: "queued" }),
      status: async () => ({ provider: "test-creative", providerJobId: "creative-1", state: "queued" }),
      cancel: async () => undefined,
      health: async () => ({ ok: true, checkedAt: new Date(0).toISOString() }),
    };
    const composer: VideoComposer = {
      provider: "test-composer",
      compose: async () => ({ provider: "test-composer", providerJobId: "video-1", state: "queued" }),
      status: async () => ({ provider: "test-composer", providerJobId: "video-1", state: "queued" }),
      cancel: async () => undefined,
      health: async () => ({ ok: true, checkedAt: new Date(0).toISOString() }),
    };
    const distribution: DistributionProvider = {
      provider: "test-distribution",
      connect: async () => ({ connectionId: "connection-1" }),
      publish: async () => ({ provider: "test-distribution", providerPublicationId: "publication-1", state: "queued" }),
      status: async () => ({ provider: "test-distribution", providerPublicationId: "publication-1", state: "queued" }),
      metrics: async () => ({ impressions: 0 }),
      health: async () => ({ ok: true, checkedAt: new Date(0).toISOString() }),
    };

    expect(await intelligence.collect({ organizationId: "org-1", sourceId: "source-1" })).toEqual([]);
    expect((await creative.generate({ organizationId: "org-1", idempotencyKey: "key", workflow: "default", parameters: {} })).state).toBe("queued");
    expect((await composer.compose({ organizationId: "org-1", idempotencyKey: "key", scriptId: "script-1", format: "9:16", assetIds: [] })).provider).toBe("test-composer");
    expect((await distribution.publish({ organizationId: "org-1", idempotencyKey: "key", contentId: "content-1", connectionId: "connection-1" })).providerPublicationId).toBe("publication-1");
  });

  it("resolves only providers that were explicitly registered", () => {
    const registry = new ContentOsProviderRegistry();
    const intelligence: IntelligenceProvider = {
      provider: "test-intelligence",
      collect: async () => [],
      health: async () => ({ ok: true, checkedAt: new Date(0).toISOString() }),
    };
    const creative: CreativeProvider = {
      provider: "test-creative",
      generate: async () => ({ provider: "test-creative", providerJobId: "creative-1", state: "queued" }),
      status: async () => ({ provider: "test-creative", providerJobId: "creative-1", state: "queued" }),
      cancel: async () => undefined,
      health: async () => ({ ok: true, checkedAt: new Date(0).toISOString() }),
    };
    const composer: VideoComposer = {
      provider: "test-composer",
      compose: async () => ({ provider: "test-composer", providerJobId: "video-1", state: "queued" }),
      status: async () => ({ provider: "test-composer", providerJobId: "video-1", state: "queued" }),
      cancel: async () => undefined,
      health: async () => ({ ok: true, checkedAt: new Date(0).toISOString() }),
    };
    const distribution: DistributionProvider = {
      provider: "test-distribution",
      connect: async () => ({ connectionId: "connection-1" }),
      publish: async () => ({ provider: "test-distribution", providerPublicationId: "publication-1", state: "queued" }),
      status: async () => ({ provider: "test-distribution", providerPublicationId: "publication-1", state: "queued" }),
      metrics: async () => ({ impressions: 0 }),
      health: async () => ({ ok: true, checkedAt: new Date(0).toISOString() }),
    };

    registry.registerIntelligence(intelligence);
    registry.registerCreative(creative);
    registry.registerComposer(composer);
    registry.registerDistribution(distribution);

    expect(registry.getIntelligence("test-intelligence")).toBe(intelligence);
    expect(registry.getCreative("test-creative")).toBe(creative);
    expect(registry.getComposer("test-composer")).toBe(composer);
    expect(registry.getDistribution("test-distribution")).toBe(distribution);
    expect(() => registry.getIntelligence("missing")).toThrow(
      "Unknown intelligence provider: missing",
    );
  });
});
