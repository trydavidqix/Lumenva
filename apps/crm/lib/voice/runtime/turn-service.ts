import type { AgentKernel } from "../../agent-engine/kernel/contracts";
import type { VoiceDeliveryAuthorizer } from "./agent-os-adapter";
import { createVoiceAgentOsAdapter } from "./agent-os-adapter";
import { createSupervisorVoiceAgentResolver } from "./agent-resolver";

const CONVERSATIONAL_AGENT_IDS = ["atendimento", "sales", "retention"] as const;

export function createVoiceTurnService(deps: {
  kernel: AgentKernel;
  authorizeDelivery: VoiceDeliveryAuthorizer;
}) {
  const resolveAgent = createSupervisorVoiceAgentResolver(deps.kernel);
  const bridge = createVoiceAgentOsAdapter({
    kernel: deps.kernel,
    resolveAgent,
    authorizeDelivery: deps.authorizeDelivery,
  });

  return {
    async run(input: {
      organizationId: string;
      contactId: string | null;
      voiceCallId: string;
      transcript: string;
    }) {
      const deliveryChecks = await Promise.all(
          CONVERSATIONAL_AGENT_IDS.map((agentId) => deps.authorizeDelivery({ organizationId: input.organizationId, agentId, channel: "voice" })),
      );
      if (!deliveryChecks.some(Boolean)) {
        return { kind: "blocked", reason: "voice_delivery_not_authorized" } as const;
      }

      return bridge.runTurn({
        organizationId: input.organizationId,
        contactId: input.contactId ?? `anonymous:${input.voiceCallId}`,
        voiceCallId: input.voiceCallId,
        transcript: input.transcript,
      });
    },
  };
}
