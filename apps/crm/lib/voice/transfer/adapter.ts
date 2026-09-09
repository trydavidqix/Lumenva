export interface VoiceTransferRequest {
  organizationId: string;
  contactId: string | null;
  conversationId: string;
  voiceCallId: string;
  destination: string;
  reason: string;
  conversationSummary: string;
  quickMemorySummary: string;
}

export type VoiceTransferBridgeResult =
  | { confirmed: true; humanParticipantId: string }
  | { confirmed: false; reason: string };

export interface VoiceTransferTransport {
  bridgeToHuman(input: {
    voiceCallId: string;
    destination: string;
    context: {
      organizationId: string;
      contactId: string;
      conversationId: string;
      reason: string;
      conversationSummary: string;
      quickMemorySummary: string;
    };
  }): Promise<VoiceTransferBridgeResult>;
  stopAiPlayback(voiceCallId: string): Promise<void>;
}

export interface VoiceBusinessHandoff {
  perform(input: {
    organizationId: string;
    contactId: string;
    conversationId: string;
    voiceCallId: string;
    reason: string;
    conversationSummary: string;
    quickMemorySummary: string;
  }): Promise<void>;
}

export type VoiceTransferResult =
  | { status: "transferred"; humanParticipantId: string }
  | { status: "failed"; reason: string };

export function createVoiceTransferAdapter(
  transport: VoiceTransferTransport,
  handoff: VoiceBusinessHandoff,
) {
  return {
    async transfer(request: VoiceTransferRequest): Promise<VoiceTransferResult> {
      if (request.contactId === null || request.contactId.trim() === "") {
        throw new Error("voice transfer requires a known contact");
      }

      const bridge = await transport.bridgeToHuman({
        voiceCallId: request.voiceCallId,
        destination: request.destination,
        context: {
          organizationId: request.organizationId,
          contactId: request.contactId,
          conversationId: request.conversationId,
          reason: request.reason,
          conversationSummary: request.conversationSummary,
          quickMemorySummary: request.quickMemorySummary,
        },
      });

      if (!bridge.confirmed) {
        return { status: "failed", reason: bridge.reason };
      }

      // Two-phase takeover: only silence the AI after the human transport has
      // positively confirmed the bridge. This prevents a failed transfer from
      // leaving the caller in silence.
      await transport.stopAiPlayback(request.voiceCallId);
      await handoff.perform({
        organizationId: request.organizationId,
        contactId: request.contactId,
        conversationId: request.conversationId,
        voiceCallId: request.voiceCallId,
        reason: request.reason,
        conversationSummary: request.conversationSummary,
        quickMemorySummary: request.quickMemorySummary,
      });

      return { status: "transferred", humanParticipantId: bridge.humanParticipantId };
    },
  };
}
