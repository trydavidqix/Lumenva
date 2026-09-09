import { describe, expect, it } from "vitest";
import { resolveVoiceWithFallback } from "./fallback-chain";
import { buildVoiceCatalog, type VoiceCatalogEntry } from "./voice-catalog";
import type { VoiceProfile } from "../engine/contracts";

const CLONED: VoiceProfile = {
  mode: "cloned",
  locale: "pt-PT",
  gender: "female",
  voiceId: "cliente-x-voz",
  provider: "openvoice",
  cloneProfileId: "clone-1",
};

const CATALOG_ENTRIES: VoiceCatalogEntry[] = [
  { locale: "pt-PT", country: "PT", gender: "female", name: "Beatriz", provider: "kokoro", voiceId: "pt-pt-beatriz", quality: "high", license: "cc-by", latencyMs: 220 },
  { locale: "pt-PT", country: "PT", gender: "female", name: "Inês", provider: "piper", voiceId: "pt-pt-ines", quality: "standard", license: "cc0", latencyMs: 180 },
];

describe("voice fallback chain (Fase 4)", () => {
  it("uses the clone when it's available", () => {
    const outcome = resolveVoiceWithFallback({
      desired: CLONED,
      cloneAvailable: true,
      catalog: buildVoiceCatalog(CATALOG_ENTRIES),
      allowHumanTransfer: true,
    });
    expect(outcome).toEqual({ kind: "resolved", tier: "cloned", profile: CLONED });
  });

  it("falls back to Kokoro when the clone is unavailable", () => {
    const outcome = resolveVoiceWithFallback({
      desired: CLONED,
      cloneAvailable: false,
      catalog: buildVoiceCatalog(CATALOG_ENTRIES),
      allowHumanTransfer: true,
    });
    expect(outcome).toEqual({
      kind: "resolved",
      tier: "kokoro",
      profile: { mode: "preset", locale: "pt-PT", gender: "female", voiceId: "pt-pt-beatriz", provider: "kokoro" },
    });
  });

  it("falls back to Piper when Kokoro has no approved voice for the locale/gender", () => {
    const catalog = buildVoiceCatalog(CATALOG_ENTRIES.filter((e) => e.provider !== "kokoro"));
    const outcome = resolveVoiceWithFallback({
      desired: CLONED,
      cloneAvailable: false,
      catalog,
      allowHumanTransfer: true,
    });
    expect(outcome).toEqual({
      kind: "resolved",
      tier: "piper",
      profile: { mode: "preset", locale: "pt-PT", gender: "female", voiceId: "pt-pt-ines", provider: "piper" },
    });
  });

  it("transfers to a human instead of guessing a different locale or gender", () => {
    const desiredFrench: VoiceProfile = { ...CLONED, locale: "fr", cloneProfileId: "clone-1" };
    const outcome = resolveVoiceWithFallback({
      desired: desiredFrench,
      cloneAvailable: false,
      catalog: buildVoiceCatalog(CATALOG_ENTRIES), // only has pt-PT voices
      allowHumanTransfer: true,
    });
    expect(outcome).toEqual({ kind: "human_transfer", reason: expect.stringContaining("fr") });
  });

  it("fails safe when no human transfer is allowed either", () => {
    const desiredFrench: VoiceProfile = { ...CLONED, locale: "fr", cloneProfileId: "clone-1" };
    const outcome = resolveVoiceWithFallback({
      desired: desiredFrench,
      cloneAvailable: false,
      catalog: buildVoiceCatalog(CATALOG_ENTRIES),
      allowHumanTransfer: false,
    });
    expect(outcome).toEqual({ kind: "safe_failure", reason: expect.stringContaining("fr") });
  });

  it("resolves preset/customized desired profiles straight through Kokoro/Piper, same as an unavailable clone", () => {
    const desiredPreset: VoiceProfile = { mode: "preset", locale: "pt-PT", gender: "male", voiceId: "whatever", provider: "piper" };
    const catalogNoMale = buildVoiceCatalog(CATALOG_ENTRIES); // all entries are female
    const outcome = resolveVoiceWithFallback({
      desired: desiredPreset,
      cloneAvailable: false,
      catalog: catalogNoMale,
      allowHumanTransfer: true,
    });
    expect(outcome.kind).toBe("human_transfer");
  });
});
