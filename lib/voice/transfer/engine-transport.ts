import type { VoiceEngineSession } from "../engine/contracts";
import type { VoiceTransferTransport } from "./adapter";

/**
 * Transport-only adapter. Business handoff state remains in the CRM adapter;
 * this layer merely asks the active voice engine to connect a human and stop
 * AI playback after confirmation.
 */
export function createVoiceEngineTransferTransport(
  session: VoiceEngineSession,
): VoiceTransferTransport {
  return {
    async bridgeToHuman(input) {
      const result = await session.transfer({ destination: input.destination });
      if (result.status === "failed") {
        return { confirmed: false, reason: result.reason };
      }
      return {
        confirmed: true,
        humanParticipantId: result.humanParticipantId ?? "human-connected",
      };
    },

    async stopAiPlayback() {
      await session.interrupt();
    },
  };
}
