import { describe, expect, it, vi } from "vitest";
import { createGovernedVoiceOutboundService } from "./service";

describe("governed voice outbound service", () => {
  it("accepts contact + goal, resolves provider-neutral route, gets Agent OS opening, then dials", async () => {
    const resolveContactPhone = vi.fn().mockResolvedValue("+351912345678");
    const resolveRoute = vi.fn().mockResolvedValue({
      provider: "asterisk",
      endpoint: "https://voice.internal",
      phoneE164: "+37255501234",
      connectionId: "twilio-ee",
    });
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
      agentId: "atendimento",
      goal: "Entregar lembrete.",
    })).resolves.toEqual({
      kind: "accepted",
      voiceCallId: "11111111-1111-4111-8111-111111111111",
      provider: "asterisk",
    });

    expect(resolveContactPhone).toHaveBeenCalledWith("org-1", "contact-1");
    expect(createCall).toHaveBeenCalledWith({
      organizationId: "org-1",
      contactId: "contact-1",
      agentId: "atendimento",
      fromE164: "+37255501234",
      toE164: "+351912345678",
      provider: "asterisk",
    });
    expect(generateOpening).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: "org-1",
      contactId: "contact-1",
      agentId: "atendimento",
      goal: "Entregar lembrete.",
      voiceCallId: "11111111-1111-4111-8111-111111111111",
    }));
    expect(dial).toHaveBeenCalledWith({
      route: {
        provider: "asterisk",
        endpoint: "https://voice.internal",
        phoneE164: "+37255501234",
        connectionId: "twilio-ee",
      },
      organizationId: "org-1",
      contactId: "contact-1",
      agentId: "atendimento",
      goal: "Entregar lembrete.",
      voiceCallId: "11111111-1111-4111-8111-111111111111",
      toE164: "+351912345678",
      firstMessage: "Tens um lembrete programado.",
    });
    expect(markFailed).not.toHaveBeenCalled();
  });

  it("does not dial when Agent OS governance blocks the opening", async () => {
    const dial = vi.fn();
    const markFailed = vi.fn().mockResolvedValue(undefined);
    const service = createGovernedVoiceOutboundService({
      resolveContactPhone: vi.fn().mockResolvedValue("+351912345678"),
      resolveRoute: vi.fn().mockResolvedValue({
        provider: "telnyx",
        endpoint: "https://voice.internal",
        phoneE164: "+351211234567",
        connectionId: null,
      }),
      createCall: vi.fn().mockResolvedValue("11111111-1111-4111-8111-111111111111"),
      generateOpening: vi.fn().mockResolvedValue({ kind: "blocked", reason: "voice_delivery_not_authorized" }),
      dial,
      markFailed,
    });

    await expect(service.initiate({
      organizationId: "org-1",
      contactId: "contact-1",
      agentId: "atendimento",
      goal: "Confirmar o horário.",
    })).resolves.toEqual({
      kind: "blocked",
      reason: "voice_delivery_not_authorized",
      voiceCallId: "11111111-1111-4111-8111-111111111111",
    });
    expect(dial).not.toHaveBeenCalled();
    expect(markFailed).toHaveBeenCalledWith(
      "org-1",
      "11111111-1111-4111-8111-111111111111",
      "telnyx",
      "voice_delivery_not_authorized",
    );
  });

  it("fails closed when contact has no phone or route is unavailable", async () => {
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
      agentId: "atendimento",
      goal: "Follow-up",
    })).resolves.toEqual({ kind: "blocked", reason: "contact_phone_missing" });
    expect(createCall).not.toHaveBeenCalled();
  });

  it("fails closed for an Asterisk route without a verified connection id", async () => {
    const createCall = vi.fn();
    const service = createGovernedVoiceOutboundService({
      resolveContactPhone: vi.fn().mockResolvedValue("+351912345678"),
      resolveRoute: vi.fn().mockResolvedValue({
        provider: "asterisk",
        endpoint: "https://voice.internal",
        phoneE164: "+37255501234",
        connectionId: null,
      }),
      createCall,
      generateOpening: vi.fn(),
      dial: vi.fn(),
      markFailed: vi.fn(),
    });

    await expect(service.initiate({
      organizationId: "org-1",
      contactId: "contact-1",
      agentId: "atendimento",
      goal: "Lembrete",
    })).resolves.toEqual({ kind: "blocked", reason: "voice_route_connection_missing" });
    expect(createCall).not.toHaveBeenCalled();
  });
});
