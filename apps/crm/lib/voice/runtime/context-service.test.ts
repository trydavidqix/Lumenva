import { describe, expect, it, vi } from "vitest";
import { createVoiceCallContextService } from "./context-service";

describe("voice call context service", () => {
  it("resolves tenant before caller and persists the call", async () => {
    const order: string[] = [];
    const resolveOrganization = vi.fn(async () => {
      order.push("organization");
      return "org-1";
    });
    const resolveCaller = vi.fn(async () => {
      order.push("caller");
      return { kind: "known" as const, contactId: "contact-1", quickMemory: null };
    });
    const persistCall = vi.fn().mockResolvedValue("voice-1");
    const loadConfig = vi.fn().mockResolvedValue({ locale: "pt-PT" });
    const service = createVoiceCallContextService({ resolveOrganization, resolveCaller, persistCall, loadConfig });

    await expect(service.resolve({
      providerCallId: "telnyx-1",
      callerE164: "+351912345678",
      calledE164: "+351211234567",
      direction: "inbound",
    })).resolves.toEqual({
      voiceCallId: "voice-1",
      organizationId: "org-1",
      contactId: "contact-1",
      callerKind: "known",
      locale: "pt-PT",
    });
    expect(order).toEqual(["organization", "caller"]);
    expect(resolveCaller).toHaveBeenCalledWith("org-1", "+351912345678");
  });

  it("fails closed for an unowned technical number", async () => {
    const service = createVoiceCallContextService({
      resolveOrganization: async () => null,
      resolveCaller: vi.fn(),
      persistCall: vi.fn(),
      loadConfig: vi.fn(),
    });
    await expect(service.resolve({
      providerCallId: "telnyx-1",
      callerE164: "+351912345678",
      calledE164: "+351211234567",
      direction: "inbound",
    })).rejects.toThrow(/technical number/i);
  });
});
