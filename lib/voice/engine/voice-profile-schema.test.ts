import { describe, expect, it } from "vitest";
import { parseVoiceProfile } from "./voice-profile-schema";

describe("VoiceProfile runtime schema (Fase 4)", () => {
  it("accepts a preset profile without cloneProfileId", () => {
    const profile = parseVoiceProfile({
      mode: "preset",
      locale: "pt-PT",
      gender: "female",
      voiceId: "nina-pt-pt",
      provider: "piper",
    });
    expect(profile).toMatchObject({ mode: "preset", voiceId: "nina-pt-pt" });
  });

  it("requires cloneProfileId when mode is cloned", () => {
    expect(() =>
      parseVoiceProfile({
        mode: "cloned",
        locale: "pt-PT",
        gender: "female",
        voiceId: "cliente-x-voz",
        provider: "openvoice",
      }),
    ).toThrow();
  });

  it("accepts a cloned profile with cloneProfileId", () => {
    const profile = parseVoiceProfile({
      mode: "cloned",
      locale: "pt-PT",
      gender: "female",
      voiceId: "cliente-x-voz",
      provider: "openvoice",
      cloneProfileId: "clone-123",
    });
    expect(profile).toMatchObject({ mode: "cloned", cloneProfileId: "clone-123" });
  });

  it("rejects a provider outside piper/kokoro/openvoice", () => {
    expect(() =>
      parseVoiceProfile({
        mode: "preset",
        locale: "pt-PT",
        gender: "female",
        voiceId: "x",
        provider: "elevenlabs",
      }),
    ).toThrow();
  });

  it("keeps style/speed/pitch optional but bounds them when present", () => {
    expect(() =>
      parseVoiceProfile({
        mode: "customized",
        locale: "pt-PT",
        gender: "male",
        voiceId: "tiago",
        provider: "kokoro",
        speed: 5,
      }),
    ).toThrow();
    const ok = parseVoiceProfile({
      mode: "customized",
      locale: "pt-PT",
      gender: "male",
      voiceId: "tiago",
      provider: "kokoro",
      speed: 1.1,
      pitch: -2,
      style: "warm",
    });
    expect(ok).toMatchObject({ speed: 1.1, pitch: -2, style: "warm" });
  });
});
