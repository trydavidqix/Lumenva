import { describe, expect, it, vi } from "vitest";

import type { ChannelAdapter, OutboundEnvelope } from "../types";
import type { GatewayEventEnvelope } from "../gateway/types";
import { createMetaCloudEngine } from "./meta-cloud-engine";
import { createWahaEngine } from "./waha-engine";

const context = {
  organizationId: "org-1",
  accountId: "acct-1",
  sessionRef: "session-1",
};

function fakeAdapter(provider: "waha" | "meta_cloud") {
  const send = vi.fn(async (_envelope: OutboundEnvelope) => ({ externalId: "external-1" }));
  let configured = true;

  const adapter: ChannelAdapter = {
    provider,
    resolveRecipient: () => "recipient",
    isConfigured: () => configured,
    send,
    codes: {
      notConfigured: `${provider}_not_configured`,
      sendFailed: `${provider}_error`,
      unknownError: `${provider}_unknown`,
    },
  };

  return {
    adapter,
    send,
    setConfigured(value: boolean) {
      configured = value;
    },
  };
}

const event: GatewayEventEnvelope = {
  eventId: "evt-1",
  eventType: "message.received",
  organizationId: "org-1",
  channel: "whatsapp",
  accountId: "acct-1",
  conversationId: "conv-1",
  externalMessageId: "msg-1",
  occurredAt: "2026-08-24T12:00:00.000Z",
  traceId: "trace-1",
  content: { type: "text", text: "oi" },
};

describe("existing channel adapters exposed as owned engines", () => {
  it("maps WAHA send, health, capabilities and events without network calls", async () => {
    const fake = fakeAdapter("waha");
    const downloadMedia = vi.fn(async () => ({
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: "image/jpeg",
    }));
    const engine = createWahaEngine({
      context,
      adapter: fake.adapter,
      now: () => "2026-08-24T12:00:00.000Z",
      downloadMedia,
    });

    expect(engine.name).toBe("waha");
    expect(engine.channel).toBe("whatsapp");
    expect(engine.capabilities.has("text")).toBe(true);
    expect(engine.capabilities.has("groups")).toBe(true);
    expect(engine.capabilities.has("templates")).toBe(false);
    await expect(engine.health()).resolves.toEqual({
      state: "up",
      checkedAt: "2026-08-24T12:00:00.000Z",
    });

    await expect(
      engine.send({
        organizationId: "org-1",
        accountId: "acct-1",
        conversationId: "conv-1",
        traceId: "trace-1",
        recipient: "351911111111@c.us",
        content: {
          type: "image",
          text: "legenda",
          media: {
            url: "https://example.invalid/image.jpg",
            mimeType: "image/jpeg",
            fileName: "image.jpg",
          },
        },
      }),
    ).resolves.toEqual({ externalMessageId: "external-1" });

    expect(fake.send).toHaveBeenCalledWith({
      sessionRef: "session-1",
      to: "351911111111@c.us",
      kind: "image",
      body: "legenda",
      media: {
        url: "https://example.invalid/image.jpg",
        mime: "image/jpeg",
        filename: "image.jpg",
        caption: "legenda",
      },
    });

    const handler = vi.fn();
    const unsubscribe = engine.subscribe(handler);
    await engine.ingest(event);
    expect(handler).toHaveBeenCalledWith(event);
    unsubscribe();
    await engine.ingest(event);
    expect(handler).toHaveBeenCalledTimes(1);

    await expect(
      engine.downloadMedia({
        organizationId: "org-1",
        accountId: "acct-1",
        traceId: "trace-1",
        externalMediaId: "media-1",
      }),
    ).resolves.toEqual({ bytes: new Uint8Array([1, 2, 3]), mimeType: "image/jpeg" });

    fake.setConfigured(false);
    await expect(engine.health()).resolves.toEqual({
      state: "down",
      checkedAt: "2026-08-24T12:00:00.000Z",
      reason: "not_configured",
    });
  });

  it("keeps Meta Cloud capabilities honest while preserving adapter send behavior", async () => {
    const fake = fakeAdapter("meta_cloud");
    const engine = createMetaCloudEngine({
      context,
      adapter: fake.adapter,
      now: () => "2026-08-24T12:00:00.000Z",
    });

    expect(engine.name).toBe("meta_cloud");
    expect(engine.capabilities.has("text")).toBe(true);
    expect(engine.capabilities.has("document")).toBe(true);
    expect(engine.capabilities.has("groups")).toBe(false);
    expect(engine.capabilities.has("templates")).toBe(false);

    await expect(
      engine.send({
        organizationId: "org-1",
        accountId: "acct-1",
        conversationId: "conv-1",
        traceId: "trace-1",
        recipient: "351911111111",
        content: { type: "text", text: "olá" },
      }),
    ).resolves.toEqual({ externalMessageId: "external-1" });

    expect(fake.send).toHaveBeenCalledWith({
      sessionRef: "session-1",
      to: "351911111111",
      kind: "text",
      body: "olá",
    });
  });
});
