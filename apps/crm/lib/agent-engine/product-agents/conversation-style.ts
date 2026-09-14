import type { AgentConversationStyle, AgentDefinition } from "../contracts/agent-os";
import { getProductAgentDefinition } from "./definitions";

/** Safe fallback for definitions that do not explicitly carry a conversational persona. */
export const DEFAULT_AGENT_CONVERSATION_STYLE: AgentConversationStyle = Object.freeze({
  register: "professional",
  toneInstructions: "Be calm, concise, professional, and emotionally steady.",
});

/** Resolve style from the exact versioned definition being executed. */
export function resolveAgentConversationStyle(definition: AgentDefinition): AgentConversationStyle {
  return definition.conversationStyle ?? DEFAULT_AGENT_CONVERSATION_STYLE;
}

/**
 * Compatibility helper for callers that only have an agent id.
 * The source of truth is the versioned AgentDefinition; there is no parallel style registry.
 */
export function getProductAgentConversationStyle(agentId: unknown): AgentConversationStyle {
  const definition = getProductAgentDefinition(agentId);
  return definition ? resolveAgentConversationStyle(definition) : DEFAULT_AGENT_CONVERSATION_STYLE;
}
