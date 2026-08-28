import type { VoiceAudioFrame } from "./stt-port";

/**
 * The resolved voice a synthesis call should use. Optional so a caller that
 * never set a `VoiceProfile` (see `lib/voice/engine/contracts.ts`) still
 * gets an adapter's own default voice — added in Fase 3 for
 * Piper/Kokoro/OpenVoice, which need to know WHICH voice, not just which
 * locale.
 */
export interface VoiceTtsSelection {
  voiceId: string;
  tone?: string;
  style?: string;
  speed?: number;
  pitch?: number;
}

export interface VoiceTtsOptions {
  locale: string;
  signal: AbortSignal;
  voice?: VoiceTtsSelection;
}

export interface VoiceTtsPlayback {
  audio: AsyncIterable<VoiceAudioFrame>;
  cancel(): Promise<void>;
}

/** Provider-neutral realtime TTS boundary. A caller may cancel playback for barge-in. */
export interface StreamingTtsPort {
  synthesize(text: string, options: VoiceTtsOptions): Promise<VoiceTtsPlayback>;
}
