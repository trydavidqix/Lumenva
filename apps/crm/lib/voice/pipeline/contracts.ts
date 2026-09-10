export const VOICE_PIPELINE_STAGES = [
  "idle",
  "listening",
  "processing",
  "speaking",
  "transferring",
  "ended",
  "failed",
] as const;

export type VoicePipelineStage = (typeof VOICE_PIPELINE_STAGES)[number];

export interface VoicePipelineContext {
  organizationId: string;
  callId: string;
  contactId: string | null;
  direction: "inbound" | "outbound";
  locale: string;
}

export type VoicePipelineEvent =
  | { type: "session_started"; at: string }
  | { type: "audio_received"; at: string; sequence: number }
  | { type: "transcript_ready"; at: string; text: string }
  | { type: "response_ready"; at: string; text: string }
  | { type: "transfer_requested"; at: string }
  | { type: "transfer_finished"; at: string; success: boolean }
  | { type: "session_ended"; at: string; reason: string }
  | { type: "pipeline_failed"; at: string; code: string; retryable: boolean };

export interface VoicePipelineSnapshot {
  stage: VoicePipelineStage;
  lastEventAt: string | null;
  lastErrorCode?: string;
}

export interface VoicePipeline {
  start(context: VoicePipelineContext): Promise<VoicePipelineSnapshot>;
  handle(event: VoicePipelineEvent): VoicePipelineSnapshot;
  snapshot(): VoicePipelineSnapshot;
}

export function transitionVoicePipeline(
  previous: VoicePipelineSnapshot,
  event: VoicePipelineEvent,
): VoicePipelineSnapshot {
  if (previous.stage === "ended" || previous.stage === "failed") return previous;
  let stage: VoicePipelineStage = previous.stage;
  let lastErrorCode = previous.lastErrorCode;
  switch (event.type) {
    case "session_started": stage = "listening"; break;
    case "audio_received": stage = "processing"; break;
    case "transcript_ready": stage = "processing"; break;
    case "response_ready": stage = "speaking"; break;
    case "transfer_requested": stage = "transferring"; break;
    case "transfer_finished": stage = event.success ? "speaking" : "failed"; break;
    case "session_ended": stage = "ended"; break;
    case "pipeline_failed": stage = "failed"; lastErrorCode = event.code; break;
  }
  return { stage, lastEventAt: event.at, ...(lastErrorCode ? { lastErrorCode } : {}) };
}
