import { describe, expect, it } from "vitest";
import {
  LANGUAGE_MATRIX_TIER_1,
  LANGUAGE_MATRIX_TIER_2,
  buildLanguageReadinessRegistry,
  evaluateLanguageReadiness,
  getLanguageMatrixTier,
  getLanguageReadiness,
  isLanguageOfferable,
  type LanguageChecklist,
} from "./language-matrix";

const FULL_PASS: LanguageChecklist = {
  hasMaleVoice: true,
  hasFemaleVoice: true,
  pronunciationTestPassed: true,
  numbersDatesNamesTestPassed: true,
  latencyTestPassed: true,
  interruptionTestPassed: true,
  phoneCallTestPassed: true,
  licenseValidated: true,
};

describe("language matrix — tiers (Fase 5)", () => {
  it("declares exactly the 7 tier-1 locales from the plan", () => {
    expect(LANGUAGE_MATRIX_TIER_1).toEqual(["en", "pt-PT", "es", "fr", "de", "it", "nl"]);
  });

  it("declares the 16 tier-2 locales (bálticas expands to lv + lt)", () => {
    expect(LANGUAGE_MATRIX_TIER_2).toHaveLength(16);
    expect(LANGUAGE_MATRIX_TIER_2).toContain("lv");
    expect(LANGUAGE_MATRIX_TIER_2).toContain("lt");
  });

  it("classifies a locale by tier, null when outside the matrix", () => {
    expect(getLanguageMatrixTier("pt-PT")).toBe(1);
    expect(getLanguageMatrixTier("uk")).toBe(2);
    expect(getLanguageMatrixTier("ja")).toBeNull();
  });
});

describe("language readiness evaluation (Fase 5)", () => {
  it("is PASS only when every check passed", () => {
    expect(evaluateLanguageReadiness(FULL_PASS)).toBe("PASS");
  });

  it("is PARTIAL when some but not all checks passed", () => {
    expect(evaluateLanguageReadiness({ ...FULL_PASS, phoneCallTestPassed: false })).toBe("PARTIAL");
  });

  it("is NOT_SUPPORTED when nothing passed", () => {
    const nothing: LanguageChecklist = {
      hasMaleVoice: false,
      hasFemaleVoice: false,
      pronunciationTestPassed: false,
      numbersDatesNamesTestPassed: false,
      latencyTestPassed: false,
      interruptionTestPassed: false,
      phoneCallTestPassed: false,
      licenseValidated: false,
    };
    expect(evaluateLanguageReadiness(nothing)).toBe("NOT_SUPPORTED");
  });
});

describe("language readiness registry (Fase 5)", () => {
  it("builds a PASS entry for a fully-tested tier-1 locale", () => {
    const registry = buildLanguageReadinessRegistry([{ locale: "pt-PT", checklist: FULL_PASS }]);
    expect(registry).toEqual([{ locale: "pt-PT", tier: 1, checklist: FULL_PASS, status: "PASS" }]);
  });

  it("rejects a locale outside the declared tiers instead of silently accepting it", () => {
    expect(() => buildLanguageReadinessRegistry([{ locale: "ja", checklist: FULL_PASS }])).toThrow(
      /not in the Fase 5 language matrix/,
    );
  });

  it("isLanguageOfferable is true only for a PASS entry, never PARTIAL or missing", () => {
    const registry = buildLanguageReadinessRegistry([
      { locale: "pt-PT", checklist: FULL_PASS },
      { locale: "fr", checklist: { ...FULL_PASS, latencyTestPassed: false } },
    ]);
    expect(isLanguageOfferable(registry, "pt-PT")).toBe(true);
    expect(isLanguageOfferable(registry, "fr")).toBe(false);
    expect(isLanguageOfferable(registry, "de")).toBe(false); // never tested at all
  });

  it("getLanguageReadiness returns null instead of guessing for an untested locale", () => {
    const registry = buildLanguageReadinessRegistry([{ locale: "pt-PT", checklist: FULL_PASS }]);
    expect(getLanguageReadiness(registry, "de")).toBeNull();
    expect(getLanguageReadiness(registry, "pt-PT")?.status).toBe("PASS");
  });
});
