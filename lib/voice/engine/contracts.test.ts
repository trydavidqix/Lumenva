import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  VOICE_ENGINE_EVENT_TYPES,
  type VoiceEngine,
  type VoiceEngineSession,
  type VoiceEngineStartInput,
  type VoiceEngineEvent,
} from "./contracts";

describe("Lumenva VoiceEngine contract", () => {
  it("keeps the public event vocabulary provider-neutral", () => {
    expect(VOICE_ENGINE_EVENT_TYPES).toEqual([
      "speech_started",
      "partial_transcript",
      "final_transcript",
      "playback_started",
      "playback_finished",
      "interrupted",
      "transfer_state",
      "ended",
      "provider_error",
    ]);
  });

  it("requires tenant and call identity while allowing an unresolved contact", () => {
    expectTypeOf<VoiceEngineStartInput>().toMatchTypeOf<{
      organizationId: string;
      voiceCallId: string;
      contactId: string | null;
      direction: "inbound" | "outbound";
      locale: string;
    }>();
  });

  it("exposes only Lumenva session operations", () => {
    expectTypeOf<VoiceEngineSession>().toMatchTypeOf<{
      events(): AsyncIterable<VoiceEngineEvent>;
      speak(text: string, options?: { interruptible?: boolean }): Promise<void>;
      interrupt(): Promise<void>;
      transfer(target: { destination: string }): Promise<unknown>;
      end(reason: string): Promise<void>;
    }>();
  });

  it("starts sessions through the stable engine interface", async () => {
    const session = {
      events: vi.fn(),
      speak: vi.fn(),
      interrupt: vi.fn(),
      transfer: vi.fn(),
      end: vi.fn(),
    } as unknown as VoiceEngineSession;
    const engine: VoiceEngine = { startSession: vi.fn().mockResolvedValue(session) };
    const input: VoiceEngineStartInput = {
      organizationId: "org-a",
      voiceCallId: "call-a",
      contactId: null,
      direction: "inbound",
      locale: "pt-PT",
    };
    await expect(engine.startSession(input)).resolves.toBe(session);
  });
});
