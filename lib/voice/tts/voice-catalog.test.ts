import { describe, expect, it } from "vitest";
import { buildVoiceCatalog, isLicenseAllowed, selectVoice, type VoiceCatalogEntry } from "./voice-catalog";

const ENTRIES: VoiceCatalogEntry[] = [
  { locale: "pt-PT", country: "PT", gender: "female", name: "Inês", provider: "piper", voiceId: "pt-pt-ines", quality: "standard", license: "cc0", latencyMs: 180 },
  { locale: "pt-PT", country: "PT", gender: "female", name: "Beatriz", provider: "kokoro", voiceId: "pt-pt-beatriz", quality: "high", license: "cc-by", latencyMs: 220 },
  { locale: "pt-PT", country: "PT", gender: "male", name: "Tiago", provider: "piper", voiceId: "pt-pt-tiago", quality: "standard", license: "mit", latencyMs: 160 },
  { locale: "en", country: "GB", gender: "female", name: "Alice", provider: "piper", voiceId: "en-gb-alice", quality: "high", license: "unknown-license", latencyMs: 150 },
];

describe("voice catalog (Fase 3)", () => {
  it("clears known open licenses and rejects anything else, including unknown or empty", () => {
    expect(isLicenseAllowed("cc0")).toBe(true);
    expect(isLicenseAllowed("MIT")).toBe(true);
    expect(isLicenseAllowed("proprietary-cleared")).toBe(true);
    expect(isLicenseAllowed("proprietary-uncleared")).toBe(false);
    expect(isLicenseAllowed("unknown-license")).toBe(false);
    expect(isLicenseAllowed("")).toBe(false);
  });

  it("drops entries with an incompatible license when building the catalog", () => {
    const catalog = buildVoiceCatalog(ENTRIES);
    expect(catalog.map((e) => e.name)).toEqual(["Inês", "Beatriz", "Tiago"]);
  });

  it("selects the highest-quality match, preferring Kokoro over Piper on a tie", () => {
    const catalog = buildVoiceCatalog(ENTRIES);
    expect(selectVoice(catalog, { locale: "pt-PT", gender: "female" })?.name).toBe("Beatriz");
  });

  it("pins to a specific provider when asked", () => {
    const catalog = buildVoiceCatalog(ENTRIES);
    expect(selectVoice(catalog, { locale: "pt-PT", gender: "female", provider: "piper" })?.name).toBe("Inês");
  });

  it("returns null instead of guessing across locale or gender", () => {
    const catalog = buildVoiceCatalog(ENTRIES);
    expect(selectVoice(catalog, { locale: "fr", gender: "female" })).toBeNull();
    expect(selectVoice(catalog, { locale: "pt-PT", gender: "neutral" })).toBeNull();
  });
});
