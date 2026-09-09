import { describe, expect, it } from "vitest";

import {
  normalizeSignal,
  signalDedupKey,
} from "@/lib/content-os/intelligence/normalize-signal";

describe("Content OS signal normalization", () => {
  it("normalizes text, URLs, timestamps, and a stable payload hash", () => {
    const input = {
      externalId: "source-42",
      sourceType: "rss",
      sourceUrl: "HTTPS://Example.COM:443/news/?z=2&a=1#ignored",
      title: "  Novidade\n importante  ",
      body: "  Texto\t com   espaços. ",
      publishedAt: "2026-08-14T10:30:00+01:00",
      observedAt: "2026-08-14T09:31:00Z",
      rawHash: "provider-hash-is-not-authoritative",
      metadata: { source: "fixture" },
    };

    const normalized = normalizeSignal(input);

    expect(normalized).toMatchObject({
      externalId: "source-42",
      sourceUrl: "https://example.com/news?a=1&z=2",
      title: "Novidade importante",
      body: "Texto com espaços.",
      publishedAt: "2026-08-14T09:30:00.000Z",
      observedAt: "2026-08-14T09:31:00.000Z",
      metadata: { source: "fixture" },
    });
    expect(normalized.rawHash).toMatch(/^[a-f0-9]{64}$/);
    expect(normalizeSignal(input).rawHash).toBe(normalized.rawHash);
  });

  it("uses the external ID or canonical hash for tenant-aware deduplication", () => {
    expect(
      signalDedupKey({
        organizationId: "org-a",
        provider: "rsshub",
        sourceId: "source-a",
        externalId: "item-a",
        rawHash: "fallback-hash",
      }),
    ).toBe("org-a:rsshub:source-a:item-a");

    expect(
      signalDedupKey({
        organizationId: "org-a",
        provider: "rsshub",
        sourceId: "source-a",
        rawHash: "fallback-hash",
      }),
    ).toBe("org-a:rsshub:source-a:fallback-hash");
  });
});
