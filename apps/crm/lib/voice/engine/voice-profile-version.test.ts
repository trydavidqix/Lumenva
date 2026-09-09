import { describe, expect, it } from "vitest";
import {
  EMPTY_VOICE_PROFILE_HISTORY,
  activateVoiceProfileVersion,
  getActiveVoiceProfile,
  parseVoiceProfileHistory,
  publishVoiceProfileVersion,
  type VoiceProfileHistory,
} from "./voice-profile-version";
import type { VoiceProfile } from "./contracts";

const PRESET_A: VoiceProfile = { mode: "preset", locale: "pt-PT", gender: "female", voiceId: "nina-a", provider: "piper" };
const PRESET_B: VoiceProfile = { mode: "preset", locale: "pt-PT", gender: "female", voiceId: "nina-b", provider: "kokoro" };

describe("voice profile versioning — immutable, append-only (Fase 4)", () => {
  it("publishes version 1 from empty history", () => {
    const history = publishVoiceProfileVersion(EMPTY_VOICE_PROFILE_HISTORY, PRESET_A, "user-1", "2026-08-27T00:00:00Z");
    expect(history.activeVersion).toBe(1);
    expect(history.versions).toEqual([{ version: 1, publishedAt: "2026-08-27T00:00:00Z", publishedByUserId: "user-1", profile: PRESET_A }]);
  });

  it("appends without ever touching an earlier entry", () => {
    let history = publishVoiceProfileVersion(EMPTY_VOICE_PROFILE_HISTORY, PRESET_A, "user-1", "2026-08-27T00:00:00Z");
    const firstEntry = history.versions[0];
    history = publishVoiceProfileVersion(history, PRESET_B, "user-2", "2026-08-27T01:00:00Z");

    expect(history.versions).toHaveLength(2);
    expect(history.versions[0]).toBe(firstEntry); // same reference: never rewritten
    expect(history.versions[1]).toMatchObject({ version: 2, profile: PRESET_B });
    expect(history.activeVersion).toBe(2);
  });

  it("getActiveVoiceProfile resolves the active entry's profile, null when nothing published", () => {
    expect(getActiveVoiceProfile(EMPTY_VOICE_PROFILE_HISTORY)).toBeNull();
    const history = publishVoiceProfileVersion(EMPTY_VOICE_PROFILE_HISTORY, PRESET_A, "user-1", "2026-08-27T00:00:00Z");
    expect(getActiveVoiceProfile(history)).toEqual(PRESET_A);
  });

  it("rollback re-points activeVersion without deleting the newer entry", () => {
    let history = publishVoiceProfileVersion(EMPTY_VOICE_PROFILE_HISTORY, PRESET_A, "user-1", "2026-08-27T00:00:00Z");
    history = publishVoiceProfileVersion(history, PRESET_B, "user-2", "2026-08-27T01:00:00Z");

    const rolledBack = activateVoiceProfileVersion(history, 1);
    expect(rolledBack.activeVersion).toBe(1);
    expect(rolledBack.versions).toHaveLength(2); // version 2 still exists, just not active
    expect(getActiveVoiceProfile(rolledBack)).toEqual(PRESET_A);
  });

  it("fails closed activating an unknown version", () => {
    const history = publishVoiceProfileVersion(EMPTY_VOICE_PROFILE_HISTORY, PRESET_A, "user-1", "2026-08-27T00:00:00Z");
    expect(() => activateVoiceProfileVersion(history, 99)).toThrow(/unknown voice profile version/);
  });

  it("fails closed publishing without an identified publisher", () => {
    expect(() => publishVoiceProfileVersion(EMPTY_VOICE_PROFILE_HISTORY, PRESET_A, "  ", "2026-08-27T00:00:00Z")).toThrow(
      /requires a publisher/,
    );
  });

  it("parses stored history and falls back to empty for absent/null input", () => {
    expect(parseVoiceProfileHistory(null)).toEqual(EMPTY_VOICE_PROFILE_HISTORY);
    expect(parseVoiceProfileHistory(undefined)).toEqual(EMPTY_VOICE_PROFILE_HISTORY);

    const stored: VoiceProfileHistory = publishVoiceProfileVersion(EMPTY_VOICE_PROFILE_HISTORY, PRESET_A, "user-1", "2026-08-27T00:00:00Z");
    expect(parseVoiceProfileHistory(stored)).toEqual(stored);
  });

  it("rejects malformed stored history instead of silently coercing it", () => {
    expect(() => parseVoiceProfileHistory({ activeVersion: "one", versions: [] })).toThrow();
  });
});
