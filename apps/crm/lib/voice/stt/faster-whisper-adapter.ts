import type { StreamingSttPort, StreamingSttOptions, VoiceAudioFrame, VoiceSttEvent } from "../runtime/stt-port";
import { assertLocale, DEFAULT_STT_TIMEOUT_MS, nextOrAbort, timedController } from "../runtime/adapter-boundary";

export interface FasterWhisperChunk {
  text: string;
  confidence: number | null;
  isFinal: boolean;
}

/**
 * Seam around the faster-whisper process/service. Nothing outside this file
 * knows how that process is reached (local process, sidecar HTTP/WS, gRPC —
 * the plan leaves the transport open, this adapter only needs a stream of
 * chunks in, chunks out).
 */
export interface FasterWhisperClient {
  streamTranscribe(input: {
    frames: AsyncIterable<VoiceAudioFrame>;
    locale: string;
    signal: AbortSignal;
  }): AsyncIterable<FasterWhisperChunk>;
}

/**
 * Default STT provider (Fase 3 do plano open-source). `whisper.cpp` is the
 * plan's declared fallback for GPU-less machines — it gets its own adapter
 * behind the same `StreamingSttPort`, selected by deployment config, not by
 * this file.
 */
export function createFasterWhisperSttPort(deps: {
  client: FasterWhisperClient;
  supportedLocales: readonly string[];
  timeoutMs?: number;
}): StreamingSttPort {
  if (deps.supportedLocales.length === 0) {
    throw new Error("[voice] faster-whisper adapter needs at least one supported locale");
  }

  return {
    async *transcribe(
      frames: AsyncIterable<VoiceAudioFrame>,
      options: StreamingSttOptions,
    ): AsyncIterable<VoiceSttEvent> {
      const locale = assertLocale(options.locale, "faster-whisper");
      if (!deps.supportedLocales.includes(locale)) {
        throw new Error(`[voice] faster-whisper does not support locale "${options.locale}"`);
      }
      const boundary = timedController(options.signal, deps.timeoutMs ?? DEFAULT_STT_TIMEOUT_MS, "faster-whisper");
      const iterator = deps.client.streamTranscribe({
        frames,
        locale,
        signal: boundary.signal,
      })[Symbol.asyncIterator]();
      try {
        while (true) {
          let result: IteratorResult<FasterWhisperChunk>;
          try { result = await nextOrAbort(iterator, boundary.signal, "faster-whisper"); }
          catch (error) {
            if (boundary.timedOut()) throw new Error("[voice] faster-whisper timed out");
            throw error;
          }
          if (result.done) return;
          const text = result.value.text.trim();
          if (text) yield { type: result.value.isFinal ? "final" : "partial", text, confidence: result.value.confidence };
        }
      } finally {
        boundary.cleanup();
        // Do not await return(): a crashed child/process may never resolve its
        // pending read. The AbortSignal is the hard cancellation boundary.
        iterator.return?.();
      }
    },
  };
}
