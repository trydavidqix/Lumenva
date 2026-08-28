import type { VoiceAudioFrame } from "../runtime/stt-port";
import type { StreamingTtsPort, VoiceTtsOptions, VoiceTtsPlayback } from "../runtime/tts-port";

/** Seam around the OpenVoice process/service. Nothing outside this file knows how it's reached. */
export interface OpenVoiceClient {
  createCloneProfile(input: {
    organizationId: string;
    sampleAudioRef: string;
    locale: string;
  }): Promise<{ cloneProfileId: string; quality: "accepted" | "rejected"; reason?: string }>;
  revokeCloneProfile(cloneProfileId: string): Promise<void>;
  synthesizeStream(input: {
    text: string;
    cloneProfileId: string;
    locale: string;
    tone?: string;
    speed?: number;
    pitch?: number;
    signal: AbortSignal;
  }): AsyncIterable<VoiceAudioFrame>;
}

export interface OpenVoiceCloneRequest {
  organizationId: string;
  /** Proof consent was already verified upstream — this function never verifies it itself. */
  consentVerified: boolean;
  /** Pointer into private storage; the raw sample audio never travels through this call. */
  sampleAudioRef: string;
  locale: string;
}

export interface OpenVoiceCloneResult {
  cloneProfileId: string;
}

/**
 * Clone lifecycle (Fase 3 do plano open-source). Deliberately separate from
 * `createOpenVoiceTtsPort` below: requesting/revoking a clone is a distinct
 * action from speaking with one, and the plan is explicit that clone
 * profiles must be revocable and deletable independent of any call.
 */
export function createOpenVoiceCloneRequester(deps: { client: OpenVoiceClient }) {
  return {
    async requestClone(input: OpenVoiceCloneRequest): Promise<OpenVoiceCloneResult> {
      if (!input.consentVerified) {
        throw new Error("[voice] OpenVoice clone requires verified consent — never proceeds without it");
      }
      if (!input.sampleAudioRef.trim()) {
        throw new Error("[voice] OpenVoice clone requires a sample audio reference");
      }
      const result = await deps.client.createCloneProfile({
        organizationId: input.organizationId,
        sampleAudioRef: input.sampleAudioRef,
        locale: input.locale,
      });
      if (result.quality === "rejected") {
        throw new Error(`[voice] OpenVoice clone rejected: ${result.reason ?? "quality check failed"}`);
      }
      return { cloneProfileId: result.cloneProfileId };
    },

    async revoke(cloneProfileId: string): Promise<void> {
      if (!cloneProfileId.trim()) throw new Error("[voice] cloneProfileId is required to revoke a clone");
      await deps.client.revokeCloneProfile(cloneProfileId);
    },
  };
}

/**
 * Clone-backed TTS adapter. Bound to exactly one `cloneProfileId` at
 * construction — never accepts a voice override per call, and never falls
 * back to a shared Piper/Kokoro voice. The runtime only ever holds this
 * identifier; the original recording and any derived artifacts stay in
 * private storage, never touched here.
 */
export function createOpenVoiceTtsPort(deps: { client: OpenVoiceClient; cloneProfileId: string }): StreamingTtsPort {
  if (!deps.cloneProfileId.trim()) {
    throw new Error("[voice] OpenVoice adapter requires a cloneProfileId — it never falls back to a shared voice");
  }

  return {
    async synthesize(text: string, options: VoiceTtsOptions): Promise<VoiceTtsPlayback> {
      const trimmed = text.trim();
      if (!trimmed) throw new Error("[voice] OpenVoice cannot synthesize empty text");

      const internalController = new AbortController();
      if (options.signal.aborted) internalController.abort();
      else options.signal.addEventListener("abort", () => internalController.abort(), { once: true });

      const audio = deps.client.synthesizeStream({
        text: trimmed,
        cloneProfileId: deps.cloneProfileId,
        locale: options.locale,
        tone: options.voice?.tone,
        speed: options.voice?.speed,
        pitch: options.voice?.pitch,
        signal: internalController.signal,
      });

      return {
        audio,
        async cancel() {
          internalController.abort();
        },
      };
    },
  };
}
