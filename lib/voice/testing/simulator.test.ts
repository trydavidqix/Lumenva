import { describe, expect, it, vi } from "vitest";
import { createVoiceE2ESimulator } from "./simulator";

describe("voice E2E simulator", () => {
  it("runs tenant context -> Agent OS turn -> provider-neutral lifecycle without external providers", async () => {
    const resolveContext = vi.fn().mockResolvedValue({
      voiceCallId: "voice-1",
      organizationId: "org-1",
      contactId: "contact-1",
      callerKind: "known",
      locale: "pt-PT",
    });
    const runTurn = vi.fn().mockResolvedValue({ kind: "reply", text: "O seu pedido chega sexta-feira." });
    const recordEvent = vi.fn().mockResolvedValue(undefined);

    const simulator = createVoiceE2ESimulator({ resolveContext, runTurn, recordEvent });
    const result = await simulator.run({
      providerCallId: "sim-call-1",
      callerE164: "+351912345678",
      calledE164: "+351211234567",
      transcripts: ["Onde está o meu pedido?"],
    });

    expect(resolveContext).toHaveBeenCalledWith({
      providerCallId: "sim-call-1",
      callerE164: "+351912345678",
      calledE164: "+351211234567",
      direction: "inbound",
    });
    expect(runTurn).toHaveBeenCalledWith({
      organizationId: "org-1",
      contactId: "contact-1",
      voiceCallId: "voice-1",
      transcript: "Onde está o meu pedido?",
    });
    expect(result.replies).toEqual(["O seu pedido chega sexta-feira."]);
    expect(recordEvent).toHaveBeenNthCalledWith(1, expect.objectContaining({ state: "active" }));
    expect(recordEvent).toHaveBeenLastCalledWith(expect.objectContaining({ state: "completed" }));
  });

  it("fails closed when delivery governance blocks the turn", async () => {
    const simulator = createVoiceE2ESimulator({
      resolveContext: vi.fn().mockResolvedValue({
        voiceCallId: "voice-2",
        organizationId: "org-1",
        contactId: null,
        callerKind: "unknown",
        locale: "pt-PT",
      }),
      runTurn: vi.fn().mockResolvedValue({ kind: "blocked", reason: "voice_delivery_not_authorized" }),
      recordEvent: vi.fn().mockResolvedValue(undefined),
    });

    const result = await simulator.run({
      providerCallId: "sim-call-2",
      callerE164: "+351900000000",
      calledE164: "+351211234567",
      transcripts: ["Olá"],
    });

    expect(result.replies).toEqual([]);
    expect(result.blockedReason).toBe("voice_delivery_not_authorized");
  });
});
