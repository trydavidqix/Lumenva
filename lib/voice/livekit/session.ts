import type { VoiceParticipantRole } from "../contracts";
import { buildVoiceJoinTokenRequest, type LiveKitJoinTokenRequest } from "./token";

export interface LiveKitEnsureRoomRequest {
  roomName: string;
  emptyTimeoutSeconds: number;
  maxParticipants: number;
}

export interface LiveKitServerPort {
  ensureRoom(input: LiveKitEnsureRoomRequest): Promise<void>;
  mintJoinToken(input: LiveKitJoinTokenRequest): Promise<string>;
}

export interface PrepareLiveKitSessionInput {
  voiceCallId: string;
  participantRole: VoiceParticipantRole;
  participantNonce: string;
}

export interface PreparedLiveKitSession {
  roomName: string;
  participantIdentity: string;
  token: string;
}

function requireOpaquePart(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized || !/^[A-Za-z0-9:_-]+$/.test(normalized)) {
    throw new Error(`[voice] ${field} must be a non-empty opaque identifier`);
  }
  return normalized;
}

/**
 * LiveKit documents that room names and participant identities are copied into
 * logs/traces and must not contain PII. A voice call id is our opaque transport
 * identifier, so no tenant name, contact name, phone or email is encoded here.
 */
export function createLiveKitRoomName(voiceCallId: string): string {
  return `voice_${requireOpaquePart(voiceCallId, "voiceCallId")}`;
}

export function createLiveKitParticipantIdentity(
  voiceCallId: string,
  role: VoiceParticipantRole,
  nonce: string,
): string {
  return `voice:${requireOpaquePart(voiceCallId, "voiceCallId")}:${role}:${requireOpaquePart(nonce, "participantNonce")}`;
}

export function createLiveKitSessionManager(port: LiveKitServerPort) {
  return {
    async prepare(input: PrepareLiveKitSessionInput): Promise<PreparedLiveKitSession> {
      const roomName = createLiveKitRoomName(input.voiceCallId);
      const participantIdentity = createLiveKitParticipantIdentity(
        input.voiceCallId,
        input.participantRole,
        input.participantNonce,
      );

      await port.ensureRoom({
        roomName,
        emptyTimeoutSeconds: 60,
        maxParticipants: 4,
      });

      const token = await port.mintJoinToken(
        buildVoiceJoinTokenRequest({
          roomName,
          participantIdentity,
          participantRole: input.participantRole,
        }),
      );

      return { roomName, participantIdentity, token };
    },
  };
}
