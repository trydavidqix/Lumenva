import type { AgentKernel } from "../../agent-engine/kernel/contracts";
import { normalizeSupervisorHandoff } from "../../agent-engine/product-agents/supervisor";
import type { VoiceAgentResolver } from "./agent-os-adapter";

/**
 * Voice reuses the Product-Agent supervisor already owned by Agent OS.
 * This resolver contains no voice-specific intent classifier and no LLM call:
 * all reasoning/model selection stays inside the canonical Agent Kernel.
 */
export function createSupervisorVoiceAgentResolver(kernel: AgentKernel): VoiceAgentResolver {
  return async (input) => {
    const result = await kernel.run({
      organizationId: input.organizationId,
      agentId: "supervisor",
      goal: input.transcript,
      trigger: {
        kind: "voice_routing",
        sourceId: input.contactId,
        eventId: input.voiceCallId,
      },
      correlationId: input.voiceCallId,
    });

    if (result.status !== "completed") return null;

    const decision = normalizeSupervisorHandoff(result.output);
    return decision.requiresHumanEscalation ? "escalation" : decision.targetAgent;
  };
}
