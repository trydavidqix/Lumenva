import type { StreamingSttPort, StreamingSttOptions, VoiceAudioFrame, VoiceSttEvent } from "../runtime/stt-port";

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
}): StreamingSttPort {
  if (deps.supportedLocales.length === 0) {
    throw new Error("[voice] faster-whisper adapter needs at least one supported locale");
  }

  return {
    async *transcribe(
      frames: AsyncIterable<VoiceAudioFrame>,
      options: StreamingSttOptions,
    ): AsyncIterable<VoiceSttEvent> {
      if (!deps.supportedLocales.includes(options.locale)) {
        throw new Error(`[voice] faster-whisper does not support locale "${options.locale}"`);
      }

      for await (const chunk of deps.client.streamTranscribe({
        frames,
        locale: options.locale,
        signal: options.signal,
      })) {
        const text = chunk.text.trim();
        // Never invent a turn: an empty transcript (partial or final) is
        // silence/noise, not something the Agent OS should react to.
        if (!text) continue;
        yield { type: chunk.isFinal ? "final" : "partial", text, confidence: chunk.confidence };
      }
    },
  };
}
