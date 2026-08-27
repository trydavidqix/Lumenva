import type { AgentAutonomyLevel } from "../../agent-engine/contracts/agent-os";
import { getProductAgentDefinition } from "../../agent-engine/product-agents/definitions";
import type { VoiceDeliveryAuthorizer } from "./agent-os-adapter";

export function isVoiceDeliveryAutonomyAllowed(level: AgentAutonomyLevel): boolean {
  return level === "assisted" || level === "autopilot_low_risk" || level === "autopilot_expanded";
}

export function createProductAgentVoiceDeliveryAuthorizer(): VoiceDeliveryAuthorizer {
  return async ({ agentId }) => {
    const definition = getProductAgentDefinition(agentId);
    if (definition === null) return false;
    return isVoiceDeliveryAutonomyAllowed(definition.autonomyLevel);
  };
}
