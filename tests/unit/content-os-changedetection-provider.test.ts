import { describe, expect, it, vi } from "vitest";

import { ChangeDetectionClient } from "@/lib/content-os/providers/changedetection/client";
import type { ChangeDetectionClientError } from "@/lib/content-os/providers/changedetection/client";
import { ChangeDetectionIntelligenceProvider } from "@/lib/content-os/providers/changedetection/provider";

describe("changedetection.io intelligence provider", () => {
  it("returns the remote watch ID when provisioning a watch", async () => {
    const client = new ChangeDetectionClient({
      baseUrl: "https://changedetection.internal",
      apiKey: "private-api-key",
      fetch: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ uuid: "watch-created" }), { status: 201 }),
      ),
    });

    await expect(
      client.createWatch({ url: "https://competitor.example/pricing", title: "Pricing" }),
    ).resolves.toBe("watch-created");
  });

  it("maps the latest changed snapshot to a deterministic signal using x-api-key", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            uuid: "watch-1",
            link: "https://competitor.example/pricing",
            title: "Página de preços",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ "1723626000": "/datastore/snapshot.txt" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response("Plano Pro agora inclui suporte 24/7", { status: 200 }));
    const client = new ChangeDetectionClient({
      baseUrl: "https://changedetection.internal",
      apiKey: "private-api-key",
      fetch: fetchMock,
    });
    const provider = new ChangeDetectionIntelligenceProvider({
      client,
      now: () => new Date("2026-08-14T11:00:00Z"),
      resolveSource: async () => ({
        id: "source-1",
        watchId: "watch-1",
        sourceUrl: "https://competitor.example/pricing",
      }),
    });

    await expect(
      provider.collect({ organizationId: "org-1", sourceId: "source-1" }),
    ).resolves.toEqual([
      expect.objectContaining({
        externalId: "watch-1:1723626000",
        sourceType: "changedetection",
        sourceUrl: "https://competitor.example/pricing",
        title: "Página de preços",
        body: "Plano Pro agora inclui suporte 24/7",
        publishedAt: "2024-08-14T09:00:00.000Z",
        observedAt: "2026-08-14T11:00:00.000Z",
      }),
    ]);

    for (const [requestUrl, requestInit] of fetchMock.mock.calls) {
      expect(String(requestUrl)).not.toContain("private-api-key");
      expect(requestInit?.headers).toMatchObject({ "x-api-key": "private-api-key" });
    }
  });

  it("uses safe typed errors for 4xx and 5xx failures", async () => {
    const unauthorized = new ChangeDetectionClient({
      baseUrl: "https://changedetection.internal",
      apiKey: "private-api-key",
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response("no", { status: 401 })),
    });
    const unavailable = new ChangeDetectionClient({
      baseUrl: "https://changedetection.internal",
      apiKey: "private-api-key",
      fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response("no", { status: 503 })),
    });

    await expect(unauthorized.getWatch("watch-1")).rejects.toMatchObject({
      name: "ChangeDetectionClientError",
      code: "unauthorized",
      message: "changedetection.io request failed",
    } satisfies Partial<ChangeDetectionClientError>);
    await expect(unavailable.getWatch("watch-1")).rejects.toMatchObject({
      name: "ChangeDetectionClientError",
      code: "unavailable",
      message: "changedetection.io request failed",
    } satisfies Partial<ChangeDetectionClientError>);
  });
});
