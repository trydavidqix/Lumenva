import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  VOICE_ENGINE_EVENT_TYPES,
  VOICE_PROFILE_MODES,
  VOICE_PROFILE_PROVIDERS,
  type VoiceEngine,
  type VoiceEngineSession,
  type VoiceEngineStartInput,
  type VoiceEngineEvent,
  type VoiceProfile,
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

  it("defines the open-source voice profile modes and providers", () => {
    expect(VOICE_PROFILE_MODES).toEqual(["preset", "customized", "cloned"]);
    expect(VOICE_PROFILE_PROVIDERS).toEqual(["piper", "kokoro", "openvoice"]);
  });

  it("only the cloned mode carries a cloneProfileId", () => {
    const preset: VoiceProfile = {
      mode: "preset",
      locale: "pt-PT",
      gender: "female",
      voiceId: "nina-pt-pt",
      provider: "piper",
    };
    const cloned: VoiceProfile = {
      mode: "cloned",
      locale: "pt-PT",
      gender: "female",
      voiceId: "cliente-x-voz",
      provider: "openvoice",
      cloneProfileId: "clone-123",
    };
    expect(preset).not.toHaveProperty("cloneProfileId");
    expect(cloned.cloneProfileId).toBe("clone-123");
  });

  it("leaves voiceProfile optional so Patter keeps its own default voice", () => {
    expectTypeOf<VoiceEngineStartInput>().toMatchTypeOf<{
      organizationId: string;
      voiceCallId: string;
      contactId: string | null;
      direction: "inbound" | "outbound";
      locale: string;
      voiceProfile?: VoiceProfile;
    }>();
    const input: VoiceEngineStartInput = {
      organizationId: "org-a",
      voiceCallId: "call-a",
      contactId: null,
      direction: "inbound",
      locale: "pt-PT",
    };
    expect(input.voiceProfile).toBeUndefined();
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
