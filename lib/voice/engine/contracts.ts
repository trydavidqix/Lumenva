import type { VoiceCallDirection } from "../contracts";

export const VOICE_ENGINE_EVENT_TYPES = [
  "speech_started",
  "partial_transcript",
  "final_transcript",
  "playback_started",
  "playback_finished",
  "interrupted",
  "transfer_state",
  "ended",
  "provider_error",
] as const;

export type VoiceEngineEventType = (typeof VOICE_ENGINE_EVENT_TYPES)[number];

interface VoiceEngineEventBase {
  at: string;
}

export type VoiceEngineEvent =
  | (VoiceEngineEventBase & { type: "speech_started" })
  | (VoiceEngineEventBase & {
      type: "partial_transcript" | "final_transcript";
      text: string;
      confidence: number | null;
    })
  | (VoiceEngineEventBase & { type: "playback_started" | "playback_finished" | "interrupted" })
  | (VoiceEngineEventBase & {
      type: "transfer_state";
      state: "connecting" | "connected" | "failed";
      reason?: string;
    })
  | (VoiceEngineEventBase & { type: "ended"; reason: string })
  | (VoiceEngineEventBase & {
      type: "provider_error";
      code: string;
      retryable: boolean;
    });

export interface VoiceEngineStartInput {
  organizationId: string;
  voiceCallId: string;
  contactId: string | null;
  direction: VoiceCallDirection;
  locale: string;
}

export interface VoiceTransferTarget {
  destination: string;
}

export type VoiceEngineTransferResult =
  | { status: "transferred"; humanParticipantId?: string }
  | { status: "failed"; reason: string };

export interface VoiceEngineSession {
  events(): AsyncIterable<VoiceEngineEvent>;
  speak(text: string, options?: { interruptible?: boolean }): Promise<void>;
  interrupt(): Promise<void>;
  transfer(target: VoiceTransferTarget): Promise<VoiceEngineTransferResult>;
  end(reason: string): Promise<void>;
}

export interface VoiceEngine {
  startSession(input: VoiceEngineStartInput): Promise<VoiceEngineSession>;
}
