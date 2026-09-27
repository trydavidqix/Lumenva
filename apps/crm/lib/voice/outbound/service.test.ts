import { describe, expect, it, vi } from "vitest";
import { createGovernedVoiceOutboundService } from "./service";

const asteriskRoute = {
  provider: "asterisk" as const,
  endpoint: "https://voice.internal",
  phoneE164: "+37255501234",
  connectionId: "sip-connection-1",
};

describe("governed voice outbound service", () => {
  it("passes the verified provider route through reservation and dialing", async () => {
    const resolveContactPhone = vi.fn().mockResolvedValue("+351912345678");
    const resolveRoute = vi.fn().mockResolvedValue(asteriskRoute);
    const createCall = vi.fn().mockResolvedValue("11111111-1111-4111-8111-111111111111");
    const generateOpening = vi.fn().mockResolvedValue({ kind: "reply", text: "Tens um lembrete programado." });
    const dial = vi.fn().mockResolvedValue(undefined);
    const markFailed = vi.fn().mockResolvedValue(undefined);
    const service = createGovernedVoiceOutboundService({
      resolveContactPhone,
      resolveRoute,
      createCall,
      generateOpening,
      dial,
      markFailed,
    });

    await expect(service.initiate({
      organizationId: "org-1",
      contactId: "contact-1",
      agentId: "support-agent",
      goal: "Deliver scheduled reminder.",
    })).resolves.toEqual({
      kind: "accepted",
      voiceCallId: "11111111-1111-4111-8111-111111111111",
      provider: "asterisk",
    });

    expect(resolveContactPhone).toHaveBeenCalledWith("org-1", "contact-1");
    expect(createCall).toHaveBeenCalledWith({
      organizationId: "org-1",
      contactId: "contact-1",
      agentId: "support-agent",
      fromE164: "+37255501234",
      toE164: "+351912345678",
      provider: "asterisk",
    });
    expect(dial).toHaveBeenCalledWith({
      route: asteriskRoute,
      organizationId: "org-1",
      contactId: "contact-1",
      agentId: "support-agent",
      goal: "Deliver scheduled reminder.",
      voiceCallId: "11111111-1111-4111-8111-111111111111",
      toE164: "+351912345678",
      firstMessage: "Tens um lembrete programado.",
    });
    expect(markFailed).not.toHaveBeenCalled();
  });

  it("does not create a call when an Asterisk route lacks a verified connection id", async () => {
    const createCall = vi.fn();
    const service = createGovernedVoiceOutboundService({
      resolveContactPhone: vi.fn().mockResolvedValue("+351912345678"),
      resolveRoute: vi.fn().mockResolvedValue({ ...asteriskRoute, connectionId: null }),
      createCall,
      generateOpening: vi.fn(),
      dial: vi.fn(),
      markFailed: vi.fn(),
    });

    await expect(service.initiate({
      organizationId: "org-1",
      contactId: "contact-1",
      agentId: "support-agent",
      goal: "Reminder",
    })).resolves.toEqual({ kind: "blocked", reason: "voice_route_connection_missing" });
    expect(createCall).not.toHaveBeenCalled();
  });

  it("fails closed when the contact number is missing", async () => {
    const createCall = vi.fn();
    const service = createGovernedVoiceOutboundService({
      resolveContactPhone: vi.fn().mockResolvedValue(null),
      resolveRoute: vi.fn(),
      createCall,
      generateOpening: vi.fn(),
      dial: vi.fn(),
      markFailed: vi.fn(),
    });

    await expect(service.initiate({
      organizationId: "org-1",
      contactId: "contact-1",
      agentId: "support-agent",
      goal: "Reminder",
    })).resolves.toEqual({ kind: "blocked", reason: "contact_phone_missing" });
    expect(createCall).not.toHaveBeenCalled();
  });
});
