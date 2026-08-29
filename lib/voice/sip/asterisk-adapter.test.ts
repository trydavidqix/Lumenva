import { describe, expect, it, vi } from "vitest";
import { createAsteriskSipGateway, type AsteriskConnectionDirectory } from "./asterisk-adapter";

function directoryResolving(organizationId: string | null): AsteriskConnectionDirectory {
  return { resolveOrganizationByConnection: vi.fn().mockResolvedValue(organizationId) };
}

const ARI_STASIS_START = JSON.stringify({
  type: "StasisStart",
  timestamp: "2026-08-27T00:00:00.000Z",
  channel: {
    id: "channel-1",
    caller: { number: "+351911234567" },
    connected: { number: "+351211234567" },
    channelvars: { SIP_CONNECTION_ID: "sip-conn-abc" },
  },
});

describe("Asterisk/ARI SIP gateway (Fase 2)", () => {
  it("parses a StasisStart event into a normalized SIP call event", async () => {
    const directory = directoryResolving("org-1");
    const gateway = createAsteriskSipGateway({
      directory,
      ariClient: { originate: vi.fn() },
      outboundContext: "lumenva-voice",
    });

    await expect(gateway.parseInboundEvent(ARI_STASIS_START)).resolves.toEqual({
      organizationId: "org-1",
      connectionId: "sip-conn-abc",
      gateway: "asterisk",
      providerEventId: "channel-1",
      eventType: "StasisStart",
      occurredAt: "2026-08-27T00:00:00.000Z",
      direction: "inbound",
      callerE164: "+351911234567",
      calledE164: "+351211234567",
      attributes: { callControlId: "channel-1", callSessionId: null },
    });
    expect(directory.resolveOrganizationByConnection).toHaveBeenCalledWith("sip-conn-abc", "+351211234567");
  });

  it.each(["StasisEnd", "ChannelHangupRequest"] as const)(
    "parses a %s event into a normalized SIP call event",
    async (eventType) => {
      const directory = directoryResolving("org-1");
      const gateway = createAsteriskSipGateway({
        directory,
        ariClient: { originate: vi.fn() },
        outboundContext: "lumenva-voice",
      });
      const rawBody = JSON.stringify({
        type: eventType,
        timestamp: "2026-08-27T00:05:00.000Z",
        channel: {
          id: "channel-1",
          caller: { number: "+351911234567" },
          connected: { number: "+351211234567" },
          channelvars: { SIP_CONNECTION_ID: "sip-conn-abc" },
        },
      });

      await expect(gateway.parseInboundEvent(rawBody)).resolves.toEqual({
        organizationId: "org-1",
        connectionId: "sip-conn-abc",
        gateway: "asterisk",
        providerEventId: "channel-1",
        eventType,
        occurredAt: "2026-08-27T00:05:00.000Z",
        direction: "inbound",
        callerE164: "+351911234567",
        calledE164: "+351211234567",
        attributes: { callControlId: "channel-1", callSessionId: null },
      });
    },
  );

  it("rejects a channel with no SIP_CONNECTION_ID — connection unknown", async () => {
    const gateway = createAsteriskSipGateway({
      directory: directoryResolving("org-1"),
      ariClient: { originate: vi.fn() },
      outboundContext: "lumenva-voice",
    });
    const rawBody = JSON.stringify({
      type: "StasisStart",
      timestamp: "2026-08-27T00:00:00.000Z",
      channel: {
        id: "channel-1",
        caller: { number: "+351911234567" },
        connected: { number: "+351211234567" },
        channelvars: {},
      },
    });
    await expect(gateway.parseInboundEvent(rawBody)).rejects.toThrow(/SIP_CONNECTION_ID/);
  });

  it("rejects when the directory does not recognize the connection", async () => {
    const gateway = createAsteriskSipGateway({
      directory: directoryResolving(null),
      ariClient: { originate: vi.fn() },
      outboundContext: "lumenva-voice",
    });
    await expect(gateway.parseInboundEvent(ARI_STASIS_START)).rejects.toThrow(/organization not found/i);
  });

  it("rejects malformed JSON and unsupported event types", async () => {
    const gateway = createAsteriskSipGateway({
      directory: directoryResolving("org-1"),
      ariClient: { originate: vi.fn() },
      outboundContext: "lumenva-voice",
    });
    await expect(gateway.parseInboundEvent("not json")).rejects.toThrow(/invalid Asterisk ARI JSON/);
    await expect(
      gateway.parseInboundEvent(JSON.stringify({ type: "ChannelDestroyed", timestamp: "2026-08-27T00:00:00Z" })),
    ).rejects.toThrow(/unsupported Asterisk ARI event type/);
  });

  it("originates an outbound call using the customer's own number as Caller ID", async () => {
    const directory = directoryResolving("org-1");
    const originate = vi.fn().mockResolvedValue({ channelId: "channel-2" });
    const gateway = createAsteriskSipGateway({
      directory,
      ariClient: { originate },
      outboundContext: "lumenva-voice",
    });

    await expect(
      gateway.initiateOutboundCall({
        organizationId: "org-1",
        connectionId: "sip-conn-abc",
        contactId: "contact-1",
        agentId: "agent-1",
        goal: "confirmar consulta",
        fromE164: "+351211234567",
        toE164: "+351911234567",
      }),
    ).resolves.toEqual({ providerCallId: "channel-2" });

    expect(directory.resolveOrganizationByConnection).toHaveBeenCalledWith("sip-conn-abc", "+351211234567");
    expect(originate).toHaveBeenCalledWith({
      endpoint: "PJSIP/+351911234567@sip-conn-abc",
      callerId: "+351211234567",
      context: "lumenva-voice",
    });
  });

  it("rejects outbound when the Caller ID does not belong to the requesting organization", async () => {
    const gateway = createAsteriskSipGateway({
      directory: directoryResolving("org-2"),
      ariClient: { originate: vi.fn() },
      outboundContext: "lumenva-voice",
    });

    await expect(
      gateway.initiateOutboundCall({
        organizationId: "org-1",
        connectionId: "sip-conn-abc",
        contactId: "contact-1",
        agentId: "agent-1",
        goal: "confirmar consulta",
        fromE164: "+351211234567",
        toE164: "+351911234567",
      }),
    ).rejects.toThrow(/different organization/i);
  });

  it("rejects outbound when the number isn't owned by any verified connection", async () => {
    const gateway = createAsteriskSipGateway({
      directory: directoryResolving(null),
      ariClient: { originate: vi.fn() },
      outboundContext: "lumenva-voice",
    });

    await expect(
      gateway.initiateOutboundCall({
        organizationId: "org-1",
        connectionId: "sip-conn-abc",
        contactId: "contact-1",
        agentId: "agent-1",
        goal: "confirmar consulta",
        fromE164: "+351211234567",
        toE164: "+351911234567",
      }),
    ).rejects.toThrow(/does not belong to a verified/i);
  });

  it("rejects outbound requests missing contact, agent or goal", async () => {
    const gateway = createAsteriskSipGateway({
      directory: directoryResolving("org-1"),
      ariClient: { originate: vi.fn() },
      outboundContext: "lumenva-voice",
    });
    const base = {
      organizationId: "org-1",
      connectionId: "sip-conn-abc",
      fromE164: "+351211234567",
      toE164: "+351911234567",
    };
    await expect(
      gateway.initiateOutboundCall({ ...base, contactId: "", agentId: "agent-1", goal: "x" }),
    ).rejects.toThrow(/requires a contact/);
    await expect(
      gateway.initiateOutboundCall({ ...base, contactId: "contact-1", agentId: "", goal: "x" }),
    ).rejects.toThrow(/requires an agent/);
    await expect(
      gateway.initiateOutboundCall({ ...base, contactId: "contact-1", agentId: "agent-1", goal: "" }),
    ).rejects.toThrow(/requires a goal/);
  });

  it("fails closed when constructed without an outbound context", () => {
    expect(() =>
      createAsteriskSipGateway({
        directory: directoryResolving("org-1"),
        ariClient: { originate: vi.fn() },
        outboundContext: "  ",
      }),
    ).toThrow(/outboundContext is required/);
  });
});
