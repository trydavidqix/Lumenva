import { describe, expect, it } from "vitest";

import { DEFAULT_VOICE_TENANT_CONFIG, mergeVoiceTenantConfig, parseVoiceTenantConfig } from "./config";

describe("voice tenant config", () => {
  it("has safe defaults with recording and transcription disabled", () => {
    expect(DEFAULT_VOICE_TENANT_CONFIG.mode).toBe("no_answer");
    expect(DEFAULT_VOICE_TENANT_CONFIG.recording.enabled).toBe(false);
    expect(DEFAULT_VOICE_TENANT_CONFIG.transcription.enabled).toBe(false);
  });

  it("accepts the four supported routing modes", () => {
    for (const mode of ["always_ai", "no_answer", "after_hours", "overflow"] as const) {
      const parsed = parseVoiceTenantConfig({ ...DEFAULT_VOICE_TENANT_CONFIG, mode });
      expect(parsed.mode).toBe(mode);
    }
  });

  it("keeps recording and transcription as independent explicit policies", () => {
    const parsed = parseVoiceTenantConfig({
      ...DEFAULT_VOICE_TENANT_CONFIG,
      recording: { enabled: true, requireConsentDisclosure: true },
      transcription: { enabled: false, retainDays: 0 },
    });
    expect(parsed.recording.enabled).toBe(true);
    expect(parsed.transcription.enabled).toBe(false);
  });

  it("rejects unsafe duration and silence values", () => {
    expect(() => parseVoiceTenantConfig({ ...DEFAULT_VOICE_TENANT_CONFIG, maxCallDurationSeconds: 0 })).toThrow();
    expect(() => parseVoiceTenantConfig({ ...DEFAULT_VOICE_TENANT_CONFIG, silenceTimeoutSeconds: 9999 })).toThrow();
  });

  it("merges a partial patch without deleting unrelated voice settings", () => {
    const next = mergeVoiceTenantConfig(DEFAULT_VOICE_TENANT_CONFIG, { mode: "after_hours" });
    expect(next.mode).toBe("after_hours");
    expect(next.locale).toBe(DEFAULT_VOICE_TENANT_CONFIG.locale);
    expect(next.recording).toEqual(DEFAULT_VOICE_TENANT_CONFIG.recording);
  });
});
