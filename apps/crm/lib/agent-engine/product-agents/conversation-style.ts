import type { AgentConversationStyle, AgentDefinition } from "../contracts/agent-os";

export type { AgentConversationRegister, AgentConversationStyle } from "../contracts/agent-os";

export const PROFESSIONAL_CONVERSATION_STYLE: AgentConversationStyle = {
  register: "professional",
  toneInstructions: "Be calm, concise, professional, and emotionally steady.",
};

/**
 * Resolve the style from the exact versioned AgentDefinition execution snapshot.
 * There is intentionally no parallel agent-id registry here.
 */
export function resolveAgentConversationStyle(
  definition: Pick<AgentDefinition, "conversationStyle"> | null | undefined,
): AgentConversationStyle {
  return definition?.conversationStyle ?? PROFESSIONAL_CONVERSATION_STYLE;
}
