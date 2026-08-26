import type { VoiceParticipantRole } from "../contracts";

export interface LiveKitJoinTokenRequest {
  roomName: string;
  participantIdentity: string;
  participantRole: VoiceParticipantRole;
  ttlSeconds: number;
  canPublishAudio: boolean;
  canSubscribeAudio: boolean;
  canPublishVideo: boolean;
}

export function buildVoiceJoinTokenRequest(input: {
  roomName: string;
  participantIdentity: string;
  participantRole: VoiceParticipantRole;
}): LiveKitJoinTokenRequest {
  return {
    ...input,
    ttlSeconds: 300,
    canPublishAudio: true,
    canSubscribeAudio: true,
    canPublishVideo: false,
  };
}
