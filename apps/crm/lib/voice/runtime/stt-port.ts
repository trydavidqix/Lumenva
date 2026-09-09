export type VoiceAudioEncoding = "pcm_s16le" | "opus" | "mulaw";

export interface VoiceAudioFrame {
  data: Uint8Array;
  encoding: VoiceAudioEncoding;
  sampleRateHz: number;
  channels: number;
  timestampMs: number;
}

export type VoiceSttEvent =
  | { type: "partial"; text: string; confidence: number | null }
  | { type: "final"; text: string; confidence: number | null };

export interface StreamingSttOptions {
  locale: string;
  signal: AbortSignal;
}

/** Provider-neutral realtime STT boundary. Transport/provider adapters implement it. */
export interface StreamingSttPort {
  transcribe(
    frames: AsyncIterable<VoiceAudioFrame>,
    options: StreamingSttOptions,
  ): AsyncIterable<VoiceSttEvent>;
}
