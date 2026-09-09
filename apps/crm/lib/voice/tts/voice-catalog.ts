export type VoiceCatalogGender = "male" | "female" | "neutral";
export type VoiceCatalogProvider = "piper" | "kokoro";
export type VoiceCatalogQuality = "standard" | "high";

export interface VoiceCatalogEntry {
  locale: string;
  country: string;
  gender: VoiceCatalogGender;
  name: string;
  provider: VoiceCatalogProvider;
  voiceId: string;
  quality: VoiceCatalogQuality;
  /** SPDX-ish identifier or explicit "proprietary-cleared" — see isLicenseAllowed. */
  license: string;
  latencyMs: number;
}

/**
 * Licenses cleared for the product. Everything else — including an
 * unrecognized/empty string — is incompatible by default: the plan says
 * "não disponibilizar vozes cujo modelo tenha licença incompatível", so the
 * gate fails closed rather than allowing anything not explicitly known.
 */
const ALLOWED_LICENSES = new Set(["cc0", "cc-by", "cc-by-sa", "mit", "apache-2.0", "proprietary-cleared"]);

export function isLicenseAllowed(license: string): boolean {
  return ALLOWED_LICENSES.has(license.trim().toLowerCase());
}

/** Filters out any entry whose license isn't cleared — the catalog itself never carries one. */
export function buildVoiceCatalog(entries: readonly VoiceCatalogEntry[]): VoiceCatalogEntry[] {
  return entries.filter((entry) => isLicenseAllowed(entry.license));
}

export interface VoiceSelectionCriteria {
  locale: string;
  gender: VoiceCatalogGender;
  provider?: VoiceCatalogProvider;
}

/**
 * Picks one voice for a locale+gender (Kokoro preferred over Piper when both
 * are "high" quality and neither is pinned, since the plan calls Kokoro out
 * for "melhor naturalidade" — ties beyond quality break on lowest latency).
 * Returns null rather than guessing across locale or gender: Fase 4's
 * fallback chain (clone -> Kokoro -> Piper -> safe failure) is the caller's
 * job, not this function's.
 */
export function selectVoice(
  catalog: readonly VoiceCatalogEntry[],
  criteria: VoiceSelectionCriteria,
): VoiceCatalogEntry | null {
  const matches = catalog.filter(
    (entry) =>
      entry.locale === criteria.locale &&
      entry.gender === criteria.gender &&
      (!criteria.provider || entry.provider === criteria.provider),
  );
  if (matches.length === 0) return null;

  return [...matches].sort((a, b) => {
    if (a.quality !== b.quality) return a.quality === "high" ? -1 : 1;
    if (a.provider !== b.provider) return a.provider === "kokoro" ? -1 : 1;
    return a.latencyMs - b.latencyMs;
  })[0]!;
}
