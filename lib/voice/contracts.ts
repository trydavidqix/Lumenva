export const VOICE_CALL_STATES = [
  "queued",
  "ringing",
  "connecting",
  "active",
  "held",
  "transferring",
  "completed",
  "failed",
  "canceled",
] as const;

export type VoiceCallState = (typeof VOICE_CALL_STATES)[number];

export const VOICE_PARTICIPANT_ROLES = ["customer", "ai_agent", "human_agent"] as const;
export type VoiceParticipantRole = (typeof VOICE_PARTICIPANT_ROLES)[number];

/** PSTN/SIP providers supported by the voice transport layer. */
export const VOICE_PROVIDERS = ["telnyx"] as const;
export type VoiceProvider = (typeof VOICE_PROVIDERS)[number];

export type VoiceCallDirection = "inbound" | "outbound";

export interface VoiceCallContext {
  voiceCallId: string;
  organizationId: string;
  contactId: string | null;
  agentId: string | null;
  conversationId: string | null;
  state: VoiceCallState;
  direction: VoiceCallDirection;
  callerNumber: string;
  calledNumber: string;
}

export interface VoiceTurnInput {
  call: VoiceCallContext;
  transcript: string;
  transcriptConfidence: number | null;
  occurredAt: string;
}

export interface VoiceTurnOutput {
  text: string;
  shouldSpeak: boolean;
  shouldHandoff: boolean;
  handoffReason: string | null;
}

const VOICE_CALL_STATE_SET = new Set<string>(VOICE_CALL_STATES);
const VOICE_PROVIDER_SET = new Set<string>(VOICE_PROVIDERS);

export function isVoiceCallState(value: unknown): value is VoiceCallState {
  return typeof value === "string" && VOICE_CALL_STATE_SET.has(value);
}

export function isVoiceProvider(value: unknown): value is VoiceProvider {
  return typeof value === "string" && VOICE_PROVIDER_SET.has(value);
}

export type VoiceCallContextValidation =
  | { ok: true; value: VoiceCallContext }
  | {
      ok: false;
      reason:
        | "invalid_input"
        | "voice_call_id_required"
        | "organization_required"
        | "invalid_state"
        | "invalid_direction"
        | "caller_number_required"
        | "called_number_required";
    };

export function validateVoiceCallContext(input: unknown): VoiceCallContextValidation {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, reason: "invalid_input" };
  const candidate = input as Record<string, unknown>;
  if (typeof candidate.voiceCallId !== "string" || candidate.voiceCallId.trim() === "") {
    return { ok: false, reason: "voice_call_id_required" };
  }
  if (typeof candidate.organizationId !== "string" || candidate.organizationId.trim() === "") {
    return { ok: false, reason: "organization_required" };
  }
  if (!isVoiceCallState(candidate.state)) return { ok: false, reason: "invalid_state" };
  if (candidate.direction !== "inbound" && candidate.direction !== "outbound") {
    return { ok: false, reason: "invalid_direction" };
  }
  if (typeof candidate.callerNumber !== "string" || candidate.callerNumber.trim() === "") {
    return { ok: false, reason: "caller_number_required" };
  }
  if (typeof candidate.calledNumber !== "string" || candidate.calledNumber.trim() === "") {
    return { ok: false, reason: "called_number_required" };
  }

  const nullableId = (value: unknown): value is string | null => value === null || (typeof value === "string" && value.trim() !== "");
  if (!nullableId(candidate.contactId) || !nullableId(candidate.agentId) || !nullableId(candidate.conversationId)) {
    return { ok: false, reason: "invalid_input" };
  }

  return { ok: true, value: candidate as unknown as VoiceCallContext };
}
