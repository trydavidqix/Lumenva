import type { VoiceAudioFrame } from "../runtime/stt-port";
import type { StreamingTtsPort, VoiceTtsOptions, VoiceTtsPlayback } from "../runtime/tts-port";
import { assertLocale, DEFAULT_TTS_FIRST_AUDIO_TIMEOUT_MS, nextOrAbort, timedController } from "../runtime/adapter-boundary";

/** Seam around the Piper process/service. Nothing outside this file knows how it's reached. */
export interface PiperClient {
  synthesizeStream(input: {
    text: string;
    voiceId: string;
    locale: string;
    tone?: string;
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
export function createPiperTtsPort(deps: { client: PiperClient; defaultVoiceId: string; timeoutMs?: number }): StreamingTtsPort {
  if (!deps.defaultVoiceId.trim()) throw new Error("[voice] Piper adapter requires a defaultVoiceId");

  return {
    async synthesize(text: string, options: VoiceTtsOptions): Promise<VoiceTtsPlayback> {
      const trimmed = text.trim();
      if (!trimmed) throw new Error("[voice] Piper cannot synthesize empty text");
      const locale = assertLocale(options.locale, "Piper");

      const boundary = timedController(options.signal, deps.timeoutMs ?? DEFAULT_TTS_FIRST_AUDIO_TIMEOUT_MS, "Piper");

      const audio = deps.client.synthesizeStream({
        text: trimmed,
        voiceId: options.voice?.voiceId ?? deps.defaultVoiceId,
        locale,
        tone: options.voice?.tone,
        speed: options.voice?.speed,
        pitch: options.voice?.pitch,
        signal: boundary.signal,
      });

      const guardedAudio = (async function* () {
        const iterator = audio[Symbol.asyncIterator]();
        try {
          while (true) {
            let result: IteratorResult<VoiceAudioFrame>;
            try { result = await nextOrAbort(iterator, boundary.signal, "Piper"); }
            catch (error) {
              if (boundary.timedOut()) throw new Error("[voice] Piper timed out waiting for first audio");
              throw error;
            }
            if (result.done) return;
            yield result.value;
            boundary.cleanup();
          }
        } finally { iterator.return?.(); boundary.cleanup(); }
      })();

      return {
        audio: guardedAudio,
        async cancel() {
          boundary.abort();
          boundary.cleanup();
        },
      };
    },
  };
}
