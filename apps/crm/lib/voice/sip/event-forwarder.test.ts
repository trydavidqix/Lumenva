import { describe, expect, it, vi } from "vitest";
import { createSipEventForwarder } from "./event-forwarder";
import type { NormalizedSipCallEvent } from "./gateway";
import type { SipBrainClient } from "./brain-client";

function normalizedEvent(overrides: Partial<NormalizedSipCallEvent> = {}): NormalizedSipCallEvent {
  return {
    organizationId: "org-1",
    connectionId: "sip-conn-abc",
    gateway: "asterisk",
    providerEventId: "channel-1",
    eventType: "StasisStart",
    occurredAt: "2026-08-28T00:00:00.000Z",
    direction: "inbound",
    callerE164: "+351911234567",
    calledE164: "+351211234567",
    attributes: { callControlId: "channel-1", callSessionId: null },
    ...overrides,
  };
}

function fakeBrainClient(): SipBrainClient & { resolveContext: ReturnType<typeof vi.fn>; recordEvent: ReturnType<typeof vi.fn>; runTurn: ReturnType<typeof vi.fn> } {
  return {
    resolveContext: vi.fn().mockResolvedValue({ voice_call_id: "call-1", contact_id: null, caller_kind: "unknown", locale: "pt" }),
    recordEvent: vi.fn().mockResolvedValue({ recorded: true }),
    runTurn: vi.fn().mockResolvedValue({ kind: "reply", text: "ok" }),
  };
}

describe("SIP event forwarder (Fase 3, closes the loop to the CRM)", () => {
  it("resolves context then records an 'active' event for StasisStart", async () => {
    const brainClient = fakeBrainClient();
    const forwarder = createSipEventForwarder({ brainClient });

    await forwarder.forward({ status: "normalized", event: normalizedEvent({ eventType: "StasisStart" }) });

    expect(brainClient.resolveContext).toHaveBeenCalledWith({
      provider_call_id: "channel-1",
      connection_id: "sip-conn-abc",
      caller_e164: "+351911234567",
      called_e164: "+351211234567",
      direction: "inbound",
    });
    expect(brainClient.recordEvent).toHaveBeenCalledWith({
      voice_call_id: "call-1",
      connection_id: "sip-conn-abc",
      phone_e164: "+351211234567", // called number, since direction is inbound
      state: "active",
      provider_event_id: "channel-1:StasisStart",
      provider_call_id: "channel-1",
      occurred_at: "2026-08-28T00:00:00.000Z",
    });
  });

  it.each(["StasisEnd", "ChannelHangupRequest"] as const)("records a 'completed' event for %s", async (eventType) => {
    const brainClient = fakeBrainClient();
    const forwarder = createSipEventForwarder({ brainClient });

    await forwarder.forward({ status: "normalized", event: normalizedEvent({ eventType }) });

    expect(brainClient.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ state: "completed", provider_event_id: `channel-1:${eventType}` }),
    );
  });

  it("uses the caller number as the technical number for outbound direction", async () => {
    const brainClient = fakeBrainClient();
    const forwarder = createSipEventForwarder({ brainClient });

    await forwarder.forward({
      status: "normalized",
      event: normalizedEvent({ direction: "outbound", callerE164: "+351211234567", calledE164: "+351911234567" }),
    });

    expect(brainClient.recordEvent).toHaveBeenCalledWith(expect.objectContaining({ phone_e164: "+351211234567" }));
  });

  it("never forwards a rejected result", async () => {
    const brainClient = fakeBrainClient();
    const forwarder = createSipEventForwarder({ brainClient });

    await forwarder.forward({ status: "rejected", error: new Error("unsupported event"), raw: { type: "ChannelVarset" } });

    expect(brainClient.resolveContext).not.toHaveBeenCalled();
    expect(brainClient.recordEvent).not.toHaveBeenCalled();
  });
});
