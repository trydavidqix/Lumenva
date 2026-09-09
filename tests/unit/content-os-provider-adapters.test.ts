import { describe, expect, it, vi } from "vitest";

import { ComfyClient, ComfyClientError } from "@/lib/content-os/providers/comfy/client";
import { ComfyCreativeProvider } from "@/lib/content-os/providers/comfy/provider";
import { PostizClient, PostizClientError } from "@/lib/content-os/providers/postiz/client";
import { PostizDistributionProvider } from "@/lib/content-os/providers/postiz/provider";
import { VideoComposerClient } from "@/lib/content-os/providers/video-composer/client";
import { MptVideoComposer } from "@/lib/content-os/providers/video-composer/provider";

const jsonResponse = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });

describe("Content OS HTTP provider adapters", () => {
  it("maps Postiz connect/publish/status/metrics and keeps auth server-side", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher = vi.fn(async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith("integrations")) return jsonResponse({ data: { id: "connection-1", redirectUrl: "https://social.example/connect" } });
      if (String(url).endsWith("analytics")) return jsonResponse({ data: { impressions: 4, clicks: 2 } });
      return jsonResponse({ data: { id: "publication-1", status: "published", url: "https://social.example/post/1" } });
    });
    const provider = new PostizDistributionProvider(new PostizClient({ baseUrl: "https://postiz.internal/", apiKey: "secret-do-not-leak", fetch: fetcher }));
    await expect(provider.connect("org-1", { provider: "linkedin" })).resolves.toMatchObject({ connectionId: "connection-1" });
    await expect(provider.publish({ organizationId: "org-1", idempotencyKey: "idem-1", contentId: "content-1", connectionId: "connection-1" })).resolves.toMatchObject({ provider: "postiz", providerPublicationId: "publication-1", state: "succeeded" });
    await expect(provider.status("publication-1")).resolves.toMatchObject({ state: "succeeded" });
    await expect(provider.metrics("publication-1")).resolves.toEqual({ impressions: 4, clicks: 2 });
    expect(calls[0]?.init?.headers).toMatchObject({ Authorization: "Bearer secret-do-not-leak" });
  });

  it("rejects unknown Postiz responses and classifies 429/invalid ids", async () => {
    const provider = new PostizDistributionProvider(new PostizClient({ baseUrl: "https://postiz.internal", fetch: vi.fn(async () => jsonResponse({ data: { id: "p-1", status: "mystery" } })) }));
    await expect(provider.status("p-1")).rejects.toThrow("unknown publication state");
    const limited = new PostizClient({ baseUrl: "https://postiz.internal", fetch: vi.fn(async () => new Response("secret body", { status: 429 })) });
    await expect(limited.status("p-1")).rejects.toMatchObject({ code: "rate_limited" });
    await expect(limited.status("bad/id")).rejects.toMatchObject({ code: "invalid_id" });
    expect(PostizClientError).toBeDefined();
  });

  it("maps ComfyUI prompt/history and cancellation through private endpoints", async () => {
    const calls: string[] = [];
    const fetcher = vi.fn(async (url: string | URL) => {
      calls.push(String(url));
      if (String(url).endsWith("/prompt")) return jsonResponse({ prompt_id: "prompt-1" });
      if (String(url).endsWith("/history/prompt-1")) return jsonResponse({ "prompt-1": { status: { status_str: "success" } } });
      return jsonResponse({});
    });
    const provider = new ComfyCreativeProvider(new ComfyClient({ baseUrl: "https://comfy.internal", fetch: fetcher }), (workflow, parameters) => ({ workflow, ...parameters }));
    await expect(provider.generate({ organizationId: "org-1", idempotencyKey: "k", workflow: "image-v1", parameters: { prompt: "hello" } })).resolves.toMatchObject({ provider: "comfy", providerJobId: "prompt-1", state: "queued" });
    await expect(provider.status("prompt-1")).resolves.toMatchObject({ state: "succeeded" });
    await expect(provider.cancel("prompt-1")).resolves.toBeUndefined();
    expect(calls).toEqual(["https://comfy.internal/prompt", "https://comfy.internal/history/prompt-1", "https://comfy.internal/interrupt"]);
    expect(ComfyClientError).toBeDefined();
  });

  it("maps the MPT-compatible composer contract and rejects malformed responses", async () => {
    const fetcher = vi.fn(async (url: string | URL) => String(url).endsWith("/health") ? jsonResponse({ ok: true }) : jsonResponse({ data: { jobId: "video-1", state: "rendering" } }));
    const provider = new MptVideoComposer(new VideoComposerClient({ baseUrl: "https://composer.internal", apiKey: "composer-secret", fetch: fetcher }));
    await expect(provider.compose({ organizationId: "org-1", idempotencyKey: "k", scriptId: "script-1", format: "9:16", assetIds: [] })).resolves.toMatchObject({ provider: "mpt-composer", providerJobId: "video-1", state: "running" });
    await expect(provider.status("video-1")).resolves.toMatchObject({ state: "running" });
    await expect(provider.cancel("video-1")).resolves.toBeUndefined();
    const malformed = new VideoComposerClient({ baseUrl: "https://composer.internal", fetch: vi.fn(async () => jsonResponse({ nope: true })) });
    await expect(malformed.create({})).rejects.toMatchObject({ code: "invalid_response" });
  });
});
