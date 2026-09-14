import type { AgentConversationStyle } from "../contracts/agent-os";
import { getProductAgentDefinition } from "./definitions";

/** Safe fallback for definitions that do not explicitly carry a conversational persona. */
export const DEFAULT_AGENT_CONVERSATION_STYLE: AgentConversationStyle = Object.freeze({
  register: "professional",
  toneInstructions: "Be calm, concise, professional, and emotionally steady.",
});

/**
 * Compatibility helper for callers that only have an agent id.
 * The source of truth is the versioned AgentDefinition; there is no parallel style registry.
 */
export function getProductAgentConversationStyle(agentId: unknown): AgentConversationStyle {
  return getProductAgentDefinition(agentId)?.conversationStyle ?? DEFAULT_AGENT_CONVERSATION_STYLE;
}
