export type VoiceSessionPhase = "idle" | "listening" | "processing" | "speaking" | "held" | "ended";
export type VoiceSessionEndReason = "silence_timeout" | "completed" | "failed" | "canceled" | null;

export interface VoiceSessionState {
  phase: VoiceSessionPhase;
  endReason: VoiceSessionEndReason;
  lastTranscript: string | null;
  lastTranscriptConfidence: number | null;
}

export type VoiceSessionEvent =
  | { type: "customer_speech_started"; atMs: number }
  | { type: "final_transcript"; text: string; confidence: number | null; atMs: number }
  | { type: "tts_started"; atMs: number }
  | { type: "tts_finished"; atMs: number }
  | { type: "hold"; atMs: number }
  | { type: "resume"; atMs: number }
  | { type: "silence_timeout"; atMs: number }
  | { type: "end"; reason: Exclude<VoiceSessionEndReason, null | "silence_timeout">; atMs: number };

export function createVoiceSessionState(): VoiceSessionState {
  return { phase: "idle", endReason: null, lastTranscript: null, lastTranscriptConfidence: null };
}

export function reduceVoiceSession(state: VoiceSessionState, event: VoiceSessionEvent): VoiceSessionState {
  switch (event.type) {
    case "customer_speech_started":
      return { ...state, phase: "listening", endReason: null };
    case "final_transcript":
      return {
        ...state,
        phase: "processing",
        lastTranscript: event.text,
        lastTranscriptConfidence: event.confidence,
      };
    case "tts_started":
      return { ...state, phase: "speaking" };
    case "tts_finished":
      return { ...state, phase: "listening" };
    case "hold":
      return { ...state, phase: "held" };
    case "resume":
      return { ...state, phase: "listening" };
    case "silence_timeout":
      return { ...state, phase: "ended", endReason: "silence_timeout" };
    case "end":
      return { ...state, phase: "ended", endReason: event.reason };
  }
}

export type SpokenFieldKind = "phone" | "address" | "amount" | "date" | "general";

export function requiresCriticalFieldConfirmation(
  field: SpokenFieldKind,
  confidence: number | null,
  threshold = 0.9,
): boolean {
  if (field === "general") return false;
  return confidence === null || !Number.isFinite(confidence) || confidence < threshold;
}

export interface VoiceLatencyMetrics {
  sttFinalMs: number | null;
  modelFirstTokenMs: number | null;
  ttsFirstAudioMs: number | null;
  endToEndMs: number | null;
}

export class VoiceLatencyTracker {
  private sttFinalAt: number | null = null;
  private modelFirstTokenAt: number | null = null;
  private ttsFirstAudioAt: number | null = null;
  private turnCompleteAt: number | null = null;

  constructor(private readonly turnStartedAt: number) {}

  markSttFinal(atMs: number): void { this.sttFinalAt = atMs; }
  markModelFirstToken(atMs: number): void { this.modelFirstTokenAt = atMs; }
  markTtsFirstAudio(atMs: number): void { this.ttsFirstAudioAt = atMs; }
  markTurnComplete(atMs: number): void { this.turnCompleteAt = atMs; }

  snapshot(): VoiceLatencyMetrics {
    const delta = (at: number | null) => at === null ? null : Math.max(0, at - this.turnStartedAt);
    return {
      sttFinalMs: delta(this.sttFinalAt),
      modelFirstTokenMs: delta(this.modelFirstTokenAt),
      ttsFirstAudioMs: delta(this.ttsFirstAudioAt),
      endToEndMs: delta(this.turnCompleteAt),
    };
  }
}
