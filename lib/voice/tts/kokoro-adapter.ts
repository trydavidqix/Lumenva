import type { VoiceAudioFrame } from "../runtime/stt-port";
import type { StreamingTtsPort, VoiceTtsOptions, VoiceTtsPlayback } from "../runtime/tts-port";

/** Seam around the Kokoro process/service. Nothing outside this file knows how it's reached. */
export interface KokoroClient {
  synthesizeStream(input: {
    text: string;
    voiceId: string;
    locale: string;
    style?: string;
    speed?: number;
    pitch?: number;
    signal: AbortSignal;
  }): AsyncIterable<VoiceAudioFrame>;
}

/**
 * Kokoro TTS adapter (Fase 3) — the plan's higher-naturalness option,
 * selected per language once a voice is approved for it (see
 * `docs/superpowers/plans/2026-08-27-voice-open-source-europe-plan.md` Fase
 * 5). `defaultVoiceId` is used when a call carries no resolved
 * `VoiceProfile`; a call that does carry one always wins.
 */
export function createKokoroTtsPort(deps: { client: KokoroClient; defaultVoiceId: string }): StreamingTtsPort {
  if (!deps.defaultVoiceId.trim()) throw new Error("[voice] Kokoro adapter requires a defaultVoiceId");

  return {
    async synthesize(text: string, options: VoiceTtsOptions): Promise<VoiceTtsPlayback> {
      const trimmed = text.trim();
      if (!trimmed) throw new Error("[voice] Kokoro cannot synthesize empty text");

      const internalController = new AbortController();
      if (options.signal.aborted) internalController.abort();
      else options.signal.addEventListener("abort", () => internalController.abort(), { once: true });

      const audio = deps.client.synthesizeStream({
        text: trimmed,
        voiceId: options.voice?.voiceId ?? deps.defaultVoiceId,
        locale: options.locale,
        style: options.voice?.style,
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
