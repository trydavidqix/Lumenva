import { describe, expect, it, vi } from "vitest";
import { createGovernedVoiceOutboundService } from "./service";

describe("governed voice outbound service", () => {
  it("accepts contact + goal, resolves phone/source server-side, gets Agent OS opening, then dials", async () => {
    const resolveContactPhone = vi.fn().mockResolvedValue("+351912345678");
    const resolveWorker = vi.fn().mockResolvedValue({ endpoint: "https://voice.internal", phoneE164: "+351211234567" });
    const createCall = vi.fn().mockResolvedValue("11111111-1111-4111-8111-111111111111");
    const generateOpening = vi.fn().mockResolvedValue({ kind: "reply", text: "Olá, falo da Lumenva." });
    const dial = vi.fn().mockResolvedValue(undefined);
    const markFailed = vi.fn().mockResolvedValue(undefined);
    const service = createGovernedVoiceOutboundService({ resolveContactPhone, resolveWorker, createCall, generateOpening, dial, markFailed });

    await expect(service.initiate({
      organizationId: "org-1",
      contactId: "contact-1",
      agentId: "atendimento",
      goal: "Confirmar o horário combinado.",
    })).resolves.toEqual({ kind: "accepted", voiceCallId: "11111111-1111-4111-8111-111111111111" });

    expect(resolveContactPhone).toHaveBeenCalledWith("org-1", "contact-1");
    expect(createCall).toHaveBeenCalledWith({
      organizationId: "org-1",
      contactId: "contact-1",
      agentId: "atendimento",
      fromE164: "+351211234567",
      toE164: "+351912345678",
    });
    expect(generateOpening).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: "org-1",
      contactId: "contact-1",
      agentId: "atendimento",
      goal: "Confirmar o horário combinado.",
      voiceCallId: "11111111-1111-4111-8111-111111111111",
    }));
    expect(dial).toHaveBeenCalledWith({
      organizationId: "org-1",
      endpoint: "https://voice.internal",
      voiceCallId: "11111111-1111-4111-8111-111111111111",
      toE164: "+351912345678",
      firstMessage: "Olá, falo da Lumenva.",
    });
    expect(markFailed).not.toHaveBeenCalled();
  });

  it("does not dial when Agent OS governance blocks the opening", async () => {
    const dial = vi.fn();
    const markFailed = vi.fn().mockResolvedValue(undefined);
    const service = createGovernedVoiceOutboundService({
      resolveContactPhone: vi.fn().mockResolvedValue("+351912345678"),
      resolveWorker: vi.fn().mockResolvedValue({ endpoint: "https://voice.internal", phoneE164: "+351211234567" }),
      createCall: vi.fn().mockResolvedValue("11111111-1111-4111-8111-111111111111"),
      generateOpening: vi.fn().mockResolvedValue({ kind: "blocked", reason: "voice_delivery_not_authorized" }),
      dial,
      markFailed,
    });

    await expect(service.initiate({ organizationId: "org-1", contactId: "contact-1", agentId: "atendimento", goal: "Confirmar o horário." }))
      .resolves.toEqual({ kind: "blocked", reason: "voice_delivery_not_authorized", voiceCallId: "11111111-1111-4111-8111-111111111111" });
    expect(dial).not.toHaveBeenCalled();
    expect(markFailed).toHaveBeenCalledWith("org-1", "11111111-1111-4111-8111-111111111111", "voice_delivery_not_authorized");
  });

  it("fails closed when contact has no phone or worker is unavailable", async () => {
    const createCall = vi.fn();
    const service = createGovernedVoiceOutboundService({
      resolveContactPhone: vi.fn().mockResolvedValue(null),
      resolveWorker: vi.fn(),
      createCall,
      generateOpening: vi.fn(),
      dial: vi.fn(),
      markFailed: vi.fn(),
    });
    await expect(service.initiate({ organizationId: "org-1", contactId: "contact-1", agentId: "atendimento", goal: "Follow-up" }))
      .resolves.toEqual({ kind: "blocked", reason: "contact_phone_missing" });
    expect(createCall).not.toHaveBeenCalled();
  });
});
