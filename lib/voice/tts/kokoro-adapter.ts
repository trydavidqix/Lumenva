import type { VoiceAudioFrame } from "../runtime/stt-port";
import type { StreamingTtsPort, VoiceTtsOptions, VoiceTtsPlayback } from "../runtime/tts-port";
import { assertLocale, DEFAULT_TTS_FIRST_AUDIO_TIMEOUT_MS, nextOrAbort, timedController } from "../runtime/adapter-boundary";

/** Seam around the Kokoro process/service. Nothing outside this file knows how it's reached. */
export interface KokoroClient {
  synthesizeStream(input: {
    text: string;
    voiceId: string;
    locale: string;
    tone?: string;
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
export function createKokoroTtsPort(deps: { client: KokoroClient; defaultVoiceId: string; timeoutMs?: number }): StreamingTtsPort {
  if (!deps.defaultVoiceId.trim()) throw new Error("[voice] Kokoro adapter requires a defaultVoiceId");

  return {
    async synthesize(text: string, options: VoiceTtsOptions): Promise<VoiceTtsPlayback> {
      const trimmed = text.trim();
      if (!trimmed) throw new Error("[voice] Kokoro cannot synthesize empty text");
      const locale = assertLocale(options.locale, "Kokoro");

      const boundary = timedController(options.signal, deps.timeoutMs ?? DEFAULT_TTS_FIRST_AUDIO_TIMEOUT_MS, "Kokoro");

      const audio = deps.client.synthesizeStream({
        text: trimmed,
        voiceId: options.voice?.voiceId ?? deps.defaultVoiceId,
        locale,
        tone: options.voice?.tone,
        style: options.voice?.style,
        speed: options.voice?.speed,
        pitch: options.voice?.pitch,
        signal: boundary.signal,
      });
      const guardedAudio = (async function* () {
        const iterator = audio[Symbol.asyncIterator]();
        try {
          while (true) {
            let result: IteratorResult<VoiceAudioFrame>;
            try { result = await nextOrAbort(iterator, boundary.signal, "Kokoro"); }
            catch (error) {
              if (boundary.timedOut()) throw new Error("[voice] Kokoro timed out waiting for first audio");
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
