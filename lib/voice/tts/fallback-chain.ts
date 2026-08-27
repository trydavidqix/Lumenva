import type { VoiceProfile } from "../engine/contracts";
import { selectVoice, type VoiceCatalogEntry } from "./voice-catalog";

export type VoiceFallbackTier = "cloned" | "kokoro" | "piper";

export type VoiceFallbackOutcome =
  | { kind: "resolved"; tier: VoiceFallbackTier; profile: VoiceProfile }
  | { kind: "human_transfer"; reason: string }
  | { kind: "safe_failure"; reason: string };

export interface VoiceFallbackInput {
  /** What the org configured — may be a cloned profile that's no longer available. */
  desired: VoiceProfile;
  /** Whether the desired clone profile is still usable (not revoked, not expired). */
  cloneAvailable: boolean;
  /** Approved voices only — see buildVoiceCatalog, which already drops unlicensed entries. */
  catalog: readonly VoiceCatalogEntry[];
  /** Whether a human is reachable to take the call if no voice resolves. */
  allowHumanTransfer: boolean;
}

/**
 * Fase 4's fallback chain: clonada -> Kokoro aprovada -> Piper aprovada ->
 * falha segura ou transferência humana. `desired.locale`/`desired.gender`
 * are the only things that stay fixed across every tier — this function
 * never substitutes another locale or another organization's voice; it
 * only ever changes provider/voiceId, or gives up honestly.
 */
export function resolveVoiceWithFallback(input: VoiceFallbackInput): VoiceFallbackOutcome {
  const { desired, cloneAvailable, catalog, allowHumanTransfer } = input;

  if (desired.mode === "cloned" && cloneAvailable) {
    return { kind: "resolved", tier: "cloned", profile: desired };
  }

  const kokoro = selectVoice(catalog, { locale: desired.locale, gender: desired.gender, provider: "kokoro" });
  if (kokoro) {
    return {
      kind: "resolved",
      tier: "kokoro",
      profile: { mode: "preset", locale: kokoro.locale, gender: kokoro.gender, voiceId: kokoro.voiceId, provider: "kokoro" },
    };
  }

  const piper = selectVoice(catalog, { locale: desired.locale, gender: desired.gender, provider: "piper" });
  if (piper) {
    return {
      kind: "resolved",
      tier: "piper",
      profile: { mode: "preset", locale: piper.locale, gender: piper.gender, voiceId: piper.voiceId, provider: "piper" },
    };
  }

  const reason = `no approved voice for locale "${desired.locale}" / gender "${desired.gender}"`;
  return allowHumanTransfer ? { kind: "human_transfer", reason } : { kind: "safe_failure", reason };
}
