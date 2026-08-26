import { describe, expect, it } from "vitest";
import { DEFAULT_VOICE_TENANT_CONFIG } from "../config";
import { buildPatterMediaProfile } from "./media";

describe("Patter media profile", () => {
  it("maps tenant voice policy to media-only runtime configuration", () => {
    const profile = buildPatterMediaProfile(DEFAULT_VOICE_TENANT_CONFIG);

    expect(profile).toMatchObject({
      locale: "pt-PT",
      vad: { enabled: true },
      bargeIn: { enabled: true, mode: "pause_resume" },
      recording: { enabled: false },
      transcription: { enabled: false, retainDays: 0 },
      maxCallDurationMs: 1_800_000,
      silenceTimeoutMs: 20_000,
    });
  });

  it("never includes LLM, tools or business policy authority", () => {
    const profile = buildPatterMediaProfile(DEFAULT_VOICE_TENANT_CONFIG) as unknown as Record<string, unknown>;
    expect(profile).not.toHaveProperty("llm");
    expect(profile).not.toHaveProperty("model");
    expect(profile).not.toHaveProperty("tools");
    expect(profile).not.toHaveProperty("systemPrompt");
    expect(profile).not.toHaveProperty("customerMemory");
  });

  it("keeps recording and transcription independently controlled by the tenant", () => {
    const profile = buildPatterMediaProfile({
      ...DEFAULT_VOICE_TENANT_CONFIG,
      recording: { enabled: true, requireConsentDisclosure: true },
      transcription: { enabled: true, retainDays: 30 },
    });

    expect(profile.recording).toEqual({ enabled: true, requireConsentDisclosure: true });
    expect(profile.transcription).toEqual({ enabled: true, retainDays: 30 });
  });
});
