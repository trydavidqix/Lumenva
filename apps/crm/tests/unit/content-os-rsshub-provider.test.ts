import { describe, expect, it, vi } from "vitest";

import { RssHubClient } from "@/lib/content-os/providers/rsshub/client";
import type { RssHubClientError } from "@/lib/content-os/providers/rsshub/client";
import { RSSHubIntelligenceProvider } from "@/lib/content-os/providers/rsshub/provider";

describe("RSSHub intelligence provider", () => {
  it("maps controlled JSON Feed items and keeps the internal key out of URLs", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          version: "https://jsonfeed.org/version/1.1",
          items: [
            {
              id: "post-42",
              url: "https://publisher.example/news/42",
              title: "Uma notícia relevante",
              content_text: "Resumo público da notícia.",
              date_published: "2026-08-14T09:00:00Z",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/feed+json" } },
      ),
    );
    const client = new RssHubClient({
      baseUrl: "https://rsshub.internal",
      accessKey: "internal-secret",
      fetch: fetchMock,
    });
    const provider = new RSSHubIntelligenceProvider({
      client,
      now: () => new Date("2026-08-14T10:00:00Z"),
      resolveSource: async () => ({
        id: "source-1",
        route: "/github/DIYgod/RSSHub/releases",
        sourceUrl: "https://github.com/DIYgod/RSSHub/releases",
      }),
    });

    await expect(
      provider.collect({ organizationId: "org-1", sourceId: "source-1" }),
    ).resolves.toEqual([
      expect.objectContaining({
        externalId: "post-42",
        sourceType: "rsshub",
        sourceUrl: "https://publisher.example/news/42",
        title: "Uma notícia relevante",
        body: "Resumo público da notícia.",
        publishedAt: "2026-08-14T09:00:00.000Z",
        observedAt: "2026-08-14T10:00:00.000Z",
      }),
    ]);

    const [requestUrl, requestInit] = fetchMock.mock.calls[0] ?? [];
    expect(String(requestUrl)).toBe(
      "https://rsshub.internal/github/DIYgod/RSSHub/releases?format=json",
    );
    expect(String(requestUrl)).not.toContain("internal-secret");
    expect(requestInit?.headers).toMatchObject({
      "X-Content-OS-Access-Key": "internal-secret",
    });
  });

  it("returns a safe typed failure for provider errors", async () => {
    const client = new RssHubClient({
      baseUrl: "https://rsshub.internal",
      accessKey: "internal-secret",
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response("unavailable", { status: 503 })),
    });

    await expect(client.fetchFeed("/github/DIYgod/RSSHub/releases")).rejects.toMatchObject({
      name: "RssHubClientError",
      code: "unavailable",
      message: "RSSHub request failed",
    } satisfies Partial<RssHubClientError>);
  });
});
