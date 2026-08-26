import type { VoiceAudioFrame } from "./stt-port";

export interface VoiceTtsOptions {
  locale: string;
  signal: AbortSignal;
}

export interface VoiceTtsPlayback {
  audio: AsyncIterable<VoiceAudioFrame>;
  cancel(): Promise<void>;
}

/** Provider-neutral realtime TTS boundary. A caller may cancel playback for barge-in. */
export interface StreamingTtsPort {
  synthesize(text: string, options: VoiceTtsOptions): Promise<VoiceTtsPlayback>;
}
