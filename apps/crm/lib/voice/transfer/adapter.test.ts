import { describe, expect, it, vi } from "vitest";
import { createVoiceTransferAdapter } from "./adapter";

const request = {
  organizationId: "org-a",
  contactId: "contact-a",
  conversationId: "conversation-a",
  voiceCallId: "call-a",
  destination: "+351210000000",
  reason: "cliente pediu humano",
  conversationSummary: "Cliente precisa de ajuda humana.",
  quickMemorySummary: "Cliente recorrente.",
};

describe("voice human transfer", () => {
  it("bridges first, then silences AI and commits the existing CRM handoff", async () => {
    const transport = {
      bridgeToHuman: vi.fn().mockResolvedValue({ confirmed: true as const, humanParticipantId: "human-1" }),
      stopAiPlayback: vi.fn().mockResolvedValue(undefined),
    };
    const handoff = { perform: vi.fn().mockResolvedValue(undefined) };
    const adapter = createVoiceTransferAdapter(transport, handoff);
    const result = await adapter.transfer(request);
    expect(result).toEqual({ status: "transferred", humanParticipantId: "human-1" });
    expect(transport.bridgeToHuman).toHaveBeenCalledWith(expect.objectContaining({
      voiceCallId: "call-a",
      destination: "+351210000000",
      context: expect.objectContaining({ quickMemorySummary: "Cliente recorrente." }),
    }));
    expect(transport.stopAiPlayback).toHaveBeenCalledWith("call-a");
    expect(handoff.perform).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: "org-a",
      contactId: "contact-a",
      conversationId: "conversation-a",
    }));
    expect(transport.stopAiPlayback.mock.invocationCallOrder[0]).toBeLessThan(handoff.perform.mock.invocationCallOrder[0]!);
  });

  it("does not silence the AI or commit handoff when the bridge fails", async () => {
    const transport = {
      bridgeToHuman: vi.fn().mockResolvedValue({ confirmed: false as const, reason: "destination_unreachable" }),
      stopAiPlayback: vi.fn(),
    };
    const handoff = { perform: vi.fn() };
    const result = await createVoiceTransferAdapter(transport, handoff).transfer(request);
    expect(result).toEqual({ status: "failed", reason: "destination_unreachable" });
    expect(transport.stopAiPlayback).not.toHaveBeenCalled();
    expect(handoff.perform).not.toHaveBeenCalled();
  });

  it("rejects transfer without a known contact instead of inventing identity", async () => {
    const transport = { bridgeToHuman: vi.fn(), stopAiPlayback: vi.fn() };
    const handoff = { perform: vi.fn() };
    await expect(createVoiceTransferAdapter(transport, handoff).transfer({ ...request, contactId: null }))
      .rejects.toThrow(/known contact/i);
  });
});
