import { describe, expect, it, vi } from "vitest";
import { createVoiceE2ESimulator } from "./simulator";

describe("voice safety evals", () => {
  it("does not call Agent OS when tenant resolution fails", async () => {
    const runTurn = vi.fn();
    const simulator = createVoiceE2ESimulator({
      resolveContext: vi.fn().mockRejectedValue(new Error("technical number is not assigned")),
      runTurn,
      recordEvent: vi.fn(),
    });

    await expect(simulator.run({
      providerCallId: "eval-tenant",
      callerE164: "+351912345678",
      calledE164: "+351299999999",
      transcripts: ["Olá"],
    })).rejects.toThrow(/technical number/i);
    expect(runTurn).not.toHaveBeenCalled();
  });

  it("does not speak when Agent OS delivery is shadow-blocked", async () => {
    const simulator = createVoiceE2ESimulator({
      resolveContext: vi.fn().mockResolvedValue({
        voiceCallId: "voice-shadow",
        organizationId: "org-1",
        contactId: "contact-1",
        callerKind: "known",
        locale: "pt-PT",
      }),
      runTurn: vi.fn().mockResolvedValue({ kind: "blocked", reason: "voice_delivery_not_authorized" }),
      recordEvent: vi.fn().mockResolvedValue(undefined),
    });

    await expect(simulator.run({
      providerCallId: "eval-shadow",
      callerE164: "+351912345678",
      calledE164: "+351211234567",
      transcripts: ["Quero comprar"],
    })).resolves.toEqual({ replies: [], blockedReason: "voice_delivery_not_authorized" });
  });

  it("ignores empty transcripts rather than spending a model turn", async () => {
    const runTurn = vi.fn();
    const simulator = createVoiceE2ESimulator({
      resolveContext: vi.fn().mockResolvedValue({
        voiceCallId: "voice-empty",
        organizationId: "org-1",
        contactId: null,
        callerKind: "unknown",
        locale: "pt-PT",
      }),
      runTurn,
      recordEvent: vi.fn().mockResolvedValue(undefined),
    });

    await expect(simulator.run({
      providerCallId: "eval-empty",
      callerE164: "+351900000000",
      calledE164: "+351211234567",
      transcripts: ["   ", "\n"],
    })).resolves.toEqual({ replies: [] });
    expect(runTurn).not.toHaveBeenCalled();
  });
});
