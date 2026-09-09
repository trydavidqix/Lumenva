import { describe, expect, it, vi } from "vitest";
import type { VoiceEngineSession } from "../engine/contracts";
import { createVoiceEngineTransferTransport } from "./engine-transport";

describe("VoiceEngine transfer transport", () => {
  it("maps a confirmed engine transfer into the two-phase handoff transport", async () => {
    const session = {
      transfer: vi.fn().mockResolvedValue({ status: "transferred", humanParticipantId: "human-1" }),
      interrupt: vi.fn(),
    } as unknown as VoiceEngineSession;
    const transport = createVoiceEngineTransferTransport(session);

    await expect(transport.bridgeToHuman({
      voiceCallId: "call-a",
      destination: "+351210000000",
      context: {
        organizationId: "org-a",
        contactId: "contact-a",
        conversationId: "conv-a",
        reason: "requested_human",
        conversationSummary: "resumo",
        quickMemorySummary: "memoria",
      },
    })).resolves.toEqual({ confirmed: true, humanParticipantId: "human-1" });

    expect(session.transfer).toHaveBeenCalledWith({ destination: "+351210000000" });
  });

  it("keeps failed transfers unconfirmed", async () => {
    const session = {
      transfer: vi.fn().mockResolvedValue({ status: "failed", reason: "no_answer" }),
      interrupt: vi.fn(),
    } as unknown as VoiceEngineSession;
    const transport = createVoiceEngineTransferTransport(session);

    await expect(transport.bridgeToHuman({
      voiceCallId: "call-a",
      destination: "+351210000000",
      context: {
        organizationId: "org-a",
        contactId: "contact-a",
        conversationId: "conv-a",
        reason: "requested_human",
        conversationSummary: "resumo",
        quickMemorySummary: "memoria",
      },
    })).resolves.toEqual({ confirmed: false, reason: "no_answer" });
  });

  it("stops AI playback through the engine interrupt operation", async () => {
    const interrupt = vi.fn();
    const session = { transfer: vi.fn(), interrupt } as unknown as VoiceEngineSession;
    const transport = createVoiceEngineTransferTransport(session);
    await transport.stopAiPlayback("call-a");
    expect(interrupt).toHaveBeenCalledTimes(1);
  });
});
