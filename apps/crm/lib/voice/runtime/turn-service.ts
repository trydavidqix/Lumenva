import { classifySentiment } from "../../agent-engine/agent/sentiment";
import type { AgentKernel } from "../../agent-engine/kernel/contracts";
import type { VoiceDeliveryAuthorizer } from "./agent-os-adapter";
import { createVoiceAgentOsAdapter } from "./agent-os-adapter";
import { createSupervisorVoiceAgentResolver } from "./agent-resolver";
import { resolveVoiceDeliveryStyle, type VoiceDeliveryStyle } from "./delivery-style";
import { prepareSpeakableVoiceText } from "./voice-humanizer";

const CONVERSATIONAL_AGENT_IDS = ["atendimento", "sales", "retention"] as const;

export type VoiceTurnServiceResult =
  | {
      kind: "reply";
      text: string;
      delivery: VoiceDeliveryStyle;
      agentId: string;
      runId: string;
      traceId: string;
    }
  | {
      kind: "blocked";
      reason: string;
      agentId?: string;
      runId?: string;
      traceId?: string;
      approvalId?: string;
    };

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
    }): Promise<VoiceTurnServiceResult> {
      const deliveryChecks = await Promise.all(
        CONVERSATIONAL_AGENT_IDS.map((agentId) => deps.authorizeDelivery({ organizationId: input.organizationId, agentId, channel: "voice" })),
      );
      if (!deliveryChecks.some(Boolean)) {
        return { kind: "blocked", reason: "voice_delivery_not_authorized" };
      }

      const result = await bridge.runTurn({
        organizationId: input.organizationId,
        contactId: input.contactId ?? `anonymous:${input.voiceCallId}`,
        voiceCallId: input.voiceCallId,
        transcript: input.transcript,
      });
      if (result.kind !== "reply") return result;

      const sentiment = classifySentiment(input.transcript);
      const delivery = resolveVoiceDeliveryStyle({ sentiment, conversationStyle: result.conversationStyle });
      const text = prepareSpeakableVoiceText(result.text);
      if (!text) {
        return {
          kind: "blocked",
          reason: "voice_agent_output_not_speakable",
          agentId: result.agentId,
          runId: result.runId,
          traceId: result.traceId,
        };
      }

      return {
        kind: "reply",
        text,
        delivery,
        agentId: result.agentId,
        runId: result.runId,
        traceId: result.traceId,
      };
    },
  };
}
