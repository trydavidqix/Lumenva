/**
 * Fase 5 do plano open-source: matriz de idiomas europeus. Não promete
 * idioma nenhum antes de testar — cada locale só é PASS depois de passar
 * pelos 8 checks abaixo. Sem fallback automático de idioma: um locale
 * NOT_SUPPORTED ou PARTIAL nunca vira "usa outro idioma parecido" — isso é
 * decisão do fallback-chain.ts (troca provider/voz, nunca locale).
 */

export const LANGUAGE_MATRIX_TIER_1 = ["en", "pt-PT", "es", "fr", "de", "it", "nl"] as const;
export type LanguageMatrixTier1Locale = (typeof LANGUAGE_MATRIX_TIER_1)[number];

export const LANGUAGE_MATRIX_TIER_2 = [
  "sv", "da", "no", "fi", "pl", "cs", "el", "ro", "hu", "sk", "sl", "lv", "lt", "hr", "bg", "uk",
] as const;
export type LanguageMatrixTier2Locale = (typeof LANGUAGE_MATRIX_TIER_2)[number];

export type LanguageMatrixLocale = LanguageMatrixTier1Locale | LanguageMatrixTier2Locale;

export type LanguageReadinessStatus = "PASS" | "PARTIAL" | "NOT_SUPPORTED";

/** Every check the plan requires per language before it can be offered. */
export interface LanguageChecklist {
  hasMaleVoice: boolean;
  hasFemaleVoice: boolean;
  pronunciationTestPassed: boolean;
  numbersDatesNamesTestPassed: boolean;
  latencyTestPassed: boolean;
  interruptionTestPassed: boolean;
  phoneCallTestPassed: boolean;
  licenseValidated: boolean;
}

const REQUIRED_CHECKS: ReadonlyArray<keyof LanguageChecklist> = [
  "hasMaleVoice",
  "hasFemaleVoice",
  "pronunciationTestPassed",
  "numbersDatesNamesTestPassed",
  "latencyTestPassed",
  "interruptionTestPassed",
  "phoneCallTestPassed",
  "licenseValidated",
];

/** PASS only when every check passed; NOT_SUPPORTED only when none did. Anything in between is PARTIAL. */
export function evaluateLanguageReadiness(checklist: LanguageChecklist): LanguageReadinessStatus {
  const values = REQUIRED_CHECKS.map((key) => checklist[key]);
  if (values.every(Boolean)) return "PASS";
  if (values.some(Boolean)) return "PARTIAL";
  return "NOT_SUPPORTED";
}

export function getLanguageMatrixTier(locale: string): 1 | 2 | null {
  if ((LANGUAGE_MATRIX_TIER_1 as readonly string[]).includes(locale)) return 1;
  if ((LANGUAGE_MATRIX_TIER_2 as readonly string[]).includes(locale)) return 2;
  return null;
}

export interface LanguageReadinessEntry {
  locale: string;
  tier: 1 | 2;
  checklist: LanguageChecklist;
  status: LanguageReadinessStatus;
}

export interface LanguageReadinessInput {
  locale: string;
  checklist: LanguageChecklist;
}

/**
 * Builds the readiness registry. Rejects a locale outside the two declared
 * tiers instead of silently accepting it — the plan's whole point is to
 * never promise an untested language, and an unlisted locale was never
 * tested by definition.
 */
export function buildLanguageReadinessRegistry(inputs: readonly LanguageReadinessInput[]): LanguageReadinessEntry[] {
  return inputs.map((input) => {
    const tier = getLanguageMatrixTier(input.locale);
    if (tier === null) {
      throw new Error(`[voice] "${input.locale}" is not in the Fase 5 language matrix (tier 1 or 2)`);
    }
    return { locale: input.locale, tier, checklist: input.checklist, status: evaluateLanguageReadiness(input.checklist) };
  });
}

/** The only question the runtime should ask before offering a locale to a customer. */
export function isLanguageOfferable(registry: readonly LanguageReadinessEntry[], locale: string): boolean {
  return registry.some((entry) => entry.locale === locale && entry.status === "PASS");
}

export function getLanguageReadiness(
  registry: readonly LanguageReadinessEntry[],
  locale: string,
): LanguageReadinessEntry | null {
  return registry.find((entry) => entry.locale === locale) ?? null;
}
