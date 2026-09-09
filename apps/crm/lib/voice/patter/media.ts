import type { VoiceTenantConfig } from "../config";

export interface PatterMediaProfile {
  locale: string;
  vad: {
    enabled: true;
  };
  bargeIn: {
    enabled: true;
    mode: "pause_resume";
  };
  recording: {
    enabled: boolean;
    requireConsentDisclosure: boolean;
  };
  transcription: {
    enabled: boolean;
    retainDays: number;
  };
  maxCallDurationMs: number;
  silenceTimeoutMs: number;
}

/**
 * Maps tenant-owned voice policy into media-only runtime knobs.
 *
 * Deliberately absent: LLM/model/system prompt/tools/customer memory. Those
 * remain exclusively behind the Lumenva Voice Agent Bridge and Agent OS.
 */
export function buildPatterMediaProfile(config: VoiceTenantConfig): PatterMediaProfile {
  return {
    locale: config.locale,
    vad: { enabled: true },
    // pause_resume avoids treating every cough/backchannel as a confirmed
    // interruption while preserving the ability to cut playback quickly.
    bargeIn: { enabled: true, mode: "pause_resume" },
    recording: {
      enabled: config.recording.enabled,
      requireConsentDisclosure: config.recording.requireConsentDisclosure,
    },
    transcription: {
      enabled: config.transcription.enabled,
      retainDays: config.transcription.retainDays,
    },
    maxCallDurationMs: config.maxCallDurationSeconds * 1_000,
    silenceTimeoutMs: config.silenceTimeoutSeconds * 1_000,
  };
}
