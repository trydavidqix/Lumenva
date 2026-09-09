import { describe, expect, it, vi } from "vitest";
import type { VoiceEngine, VoiceEngineSession } from "../engine/contracts";
import type { NormalizedTelnyxCallEvent } from "./webhook";
import { createTelnyxVoiceOrchestrator } from "./orchestrator";

function event(overrides: Partial<NormalizedTelnyxCallEvent> = {}): NormalizedTelnyxCallEvent {
  return {
    organizationId: "org-a",
    providerEventId: "evt-a",
    eventType: "call.initiated",
    occurredAt: "2026-08-27T00:00:00Z",
    direction: "inbound",
    callerE164: "+351911111111",
    calledE164: "+351210000000",
    attributes: { callControlId: "cc-a", callSessionId: "cs-a" },
    ...overrides,
  };
}

const session = {} as VoiceEngineSession;

describe("Telnyx -> Lumenva VoiceEngine orchestration", () => {
  it("resolves caller inside the already-resolved tenant before starting the engine", async () => {
    const resolve = vi.fn().mockResolvedValue({ kind: "known", contactId: "contact-a", quickMemory: null });
    const engine: VoiceEngine = { startSession: vi.fn().mockResolvedValue(session) };
    const orchestrator = createTelnyxVoiceOrchestrator({ callerResolver: { resolve }, engine });

    await expect(orchestrator.start(event(), "voice-call-a", "pt-PT")).resolves.toEqual({
      session,
      contactId: "contact-a",
      callerKind: "known",
    });

    expect(resolve).toHaveBeenCalledWith("org-a", "+351911111111");
    expect(engine.startSession).toHaveBeenCalledWith({
      organizationId: "org-a",
      voiceCallId: "voice-call-a",
      contactId: "contact-a",
      direction: "inbound",
      locale: "pt-PT",
    });
  });

  it("allows an unknown caller without inventing a contact", async () => {
    const engine: VoiceEngine = { startSession: vi.fn().mockResolvedValue(session) };
    const orchestrator = createTelnyxVoiceOrchestrator({
      callerResolver: { resolve: vi.fn().mockResolvedValue({ kind: "unknown", contactId: null, quickMemory: null }) },
      engine,
    });

    await expect(orchestrator.start(event(), "voice-call-a", "pt-PT")).resolves.toEqual({
      session,
      contactId: null,
      callerKind: "unknown",
    });
    expect(engine.startSession).toHaveBeenCalledWith(expect.objectContaining({ contactId: null }));
  });

  it("uses the called party as customer identity for outbound calls", async () => {
    const resolve = vi.fn().mockResolvedValue({ kind: "known", contactId: "contact-b", quickMemory: null });
    const engine: VoiceEngine = { startSession: vi.fn().mockResolvedValue(session) };
    const orchestrator = createTelnyxVoiceOrchestrator({ callerResolver: { resolve }, engine });

    await orchestrator.start(event({
      direction: "outbound",
      callerE164: "+351210000000",
      calledE164: "+351922222222",
    }), "voice-call-b", "pt-PT");

    expect(resolve).toHaveBeenCalledWith("org-a", "+351922222222");
  });
});
