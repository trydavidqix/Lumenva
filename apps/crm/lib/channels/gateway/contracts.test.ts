import { describe, expect, expectTypeOf, it } from "vitest";

import { hasCapability } from "./capabilities";
import { DuplicateEngineRegistrationError, UnknownEngineError } from "./errors";
import { EngineRegistry } from "./registry";
import type { MessagingEngine } from "./engine";
import type {
  ChannelCapability,
  ChannelName,
  EngineCapabilities,
  EngineName,
  GatewayEventEnvelope,
} from "./types";

function fakeEngine(name: EngineName = "waha"): MessagingEngine {
  return {
    name,
    channel: "whatsapp",
    capabilities: new Set<ChannelCapability>(["text", "image"]),
    connect: async () => undefined,
    disconnect: async () => undefined,
    health: async () => ({ state: "up", checkedAt: "2026-08-24T12:00:00.000Z" }),
    send: async () => ({ externalMessageId: "external-1" }),
    downloadMedia: async () => ({ bytes: new Uint8Array(), mimeType: "image/jpeg" }),
    ingest: async () => undefined,
    subscribe: () => () => undefined,
  };
}

describe("owned channel gateway contracts", () => {
  it("keeps channel and engine vocabularies project-owned", () => {
    expectTypeOf<ChannelName>().toEqualTypeOf<"whatsapp" | "instagram" | "messenger">();
    expectTypeOf<EngineName>().toEqualTypeOf<"waha" | "meta_cloud" | "baileys" | "browser">();
  });

  it("requires tenant/account/conversation/trace identity in normalized events", () => {
    const event = {
      eventId: "evt-1",
      eventType: "message.received",
      organizationId: "org-1",
      channel: "whatsapp",
      accountId: "acct-1",
      conversationId: "conv-1",
      externalMessageId: "msg-1",
      occurredAt: "2026-08-24T12:00:00.000Z",
      traceId: "trace-1",
      content: { type: "text", text: "olá" },
      diagnostic: { providerEventType: "message" },
    } satisfies GatewayEventEnvelope;

    expect(event.organizationId).toBe("org-1");
    expect(event.accountId).toBe("acct-1");
    expect(event.traceId).toBe("trace-1");
  });

  it("checks capabilities without inspecting an engine name", () => {
    const capabilities: EngineCapabilities = new Set<ChannelCapability>(["text", "audio"]);

    expect(hasCapability(capabilities, "text")).toBe(true);
    expect(hasCapability(capabilities, "templates")).toBe(false);
  });

  it("rejects duplicate engine registration deterministically", () => {
    const registry = new EngineRegistry();
    registry.register("waha", () => fakeEngine("waha"));

    expect(() => registry.register("waha", () => fakeEngine("waha"))).toThrow(
      DuplicateEngineRegistrationError,
    );
  });

  it("fails closed when resolving an unknown or unregistered engine", () => {
    const registry = new EngineRegistry();

    expect(() => registry.resolve("baileys")).toThrow(UnknownEngineError);
  });

  it("resolves the exact registered factory", () => {
    const registry = new EngineRegistry();
    const factory = () => fakeEngine("meta_cloud");
    registry.register("meta_cloud", factory);

    expect(registry.resolve("meta_cloud")).toBe(factory);
  });
});
