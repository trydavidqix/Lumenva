import type { VoiceAudioFrame } from "../runtime/stt-port";
import type { StreamingTtsPort, VoiceTtsOptions, VoiceTtsPlayback } from "../runtime/tts-port";

/** Seam around the Piper process/service. Nothing outside this file knows how it's reached. */
export interface PiperClient {
  synthesizeStream(input: {
    text: string;
    voiceId: string;
    locale: string;
    speed?: number;
    pitch?: number;
    signal: AbortSignal;
  }): AsyncIterable<VoiceAudioFrame>;
}

/**
 * Piper TTS adapter (Fase 3) — the plan's default for broad European
 * language coverage at lower infrastructure cost. `defaultVoiceId` is used
 * when a call carries no resolved `VoiceProfile` (see
 * `lib/voice/engine/contracts.ts`); a call that does carry one always wins.
 */
export function createPiperTtsPort(deps: { client: PiperClient; defaultVoiceId: string }): StreamingTtsPort {
  if (!deps.defaultVoiceId.trim()) throw new Error("[voice] Piper adapter requires a defaultVoiceId");

  return {
    async synthesize(text: string, options: VoiceTtsOptions): Promise<VoiceTtsPlayback> {
      const trimmed = text.trim();
      if (!trimmed) throw new Error("[voice] Piper cannot synthesize empty text");

      const internalController = new AbortController();
      if (options.signal.aborted) internalController.abort();
      else options.signal.addEventListener("abort", () => internalController.abort(), { once: true });

      const audio = deps.client.synthesizeStream({
        text: trimmed,
        voiceId: options.voice?.voiceId ?? deps.defaultVoiceId,
        locale: options.locale,
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
