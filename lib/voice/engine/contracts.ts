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

export const VOICE_PROFILE_MODES = ["preset", "customized", "cloned"] as const;
export type VoiceProfileMode = (typeof VOICE_PROFILE_MODES)[number];

/** Internal open-source TTS providers the VoiceEngine may select a profile from. */
export const VOICE_PROFILE_PROVIDERS = ["piper", "kokoro", "openvoice"] as const;
export type VoiceProfileProvider = (typeof VOICE_PROFILE_PROVIDERS)[number];

interface VoiceProfileBase {
  locale: string;
  gender: "male" | "female" | "neutral";
  voiceId: string;
  provider: VoiceProfileProvider;
  /** Optional delivery tone hint (for example, warm or professional). */
  tone?: string;
  style?: string;
  speed?: number;
  pitch?: number;
}

/**
 * Voice a session speaks with. `cloned` is the only mode that carries a
 * `cloneProfileId` — presence of the field is what proves consent/authorship
 * was resolved upstream before the profile reached the engine.
 */
export type VoiceProfile =
  | (VoiceProfileBase & { mode: "preset" })
  | (VoiceProfileBase & { mode: "customized" })
  | (VoiceProfileBase & { mode: "cloned"; cloneProfileId: string });

export interface VoiceEngineStartInput {
  organizationId: string;
  voiceCallId: string;
  contactId: string | null;
  direction: VoiceCallDirection;
  locale: string;
  /**
   * Optional: absent means the implementation picks its own default voice
   * (e.g. Patter's built-in voice today). Adapters that don't support voice
   * profiles yet (Patter) are free to ignore it.
   */
  voiceProfile?: VoiceProfile;
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
