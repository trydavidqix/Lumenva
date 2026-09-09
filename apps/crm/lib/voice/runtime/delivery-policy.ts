import type { AgentAutonomyLevel } from "../../agent-engine/contracts/agent-os";
import { getProductAgentDefinition } from "../../agent-engine/product-agents/definitions";
import type { VoiceDeliveryAuthorizer } from "./agent-os-adapter";

const VOICE_DELIVERY_AGENT_IDS = new Set(["atendimento", "sales", "retention"]);

export function isVoiceDeliveryAutonomyAllowed(level: AgentAutonomyLevel): boolean {
  return level === "assisted" || level === "autopilot_low_risk" || level === "autopilot_expanded";
}

export function createProductAgentVoiceDeliveryAuthorizer(): VoiceDeliveryAuthorizer {
  return async ({ agentId, channel = "default" }) => {
    const definition = getProductAgentDefinition(agentId);
    if (definition === null) return false;
    if (channel === "voice") return VOICE_DELIVERY_AGENT_IDS.has(agentId);
    return isVoiceDeliveryAutonomyAllowed(definition.autonomyLevel);
  };
}
