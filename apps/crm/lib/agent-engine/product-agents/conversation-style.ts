import { isProductAgentId, type ProductAgentId } from "./contracts";

export type AgentConversationRegister = "professional" | "warm" | "casual" | "custom";

export interface AgentConversationStyle {
  register: AgentConversationRegister;
  toneInstructions: string;
  examplePhrases?: readonly string[];
}

const PROFESSIONAL_DEFAULT: AgentConversationStyle = {
  register: "professional",
  toneInstructions: "Be calm, concise, professional, and emotionally steady.",
};

const CONVERSATION_STYLES: Readonly<Partial<Record<ProductAgentId, AgentConversationStyle>>> = {
  atendimento: {
    register: "warm",
    toneInstructions: "Be warm, patient, calm, clear, and helpful. Never sound like a scripted call center.",
    examplePhrases: ["Claro, vejo isso contigo.", "Entendi. Vou verificar com calma."],
  },
  sales: {
    register: "warm",
    toneInstructions: "Be warm, confident, concise, and energetic without pressure, hype, or false urgency.",
    examplePhrases: ["Posso te mostrar a opção que faz mais sentido.", "Se fizer sentido para ti, seguimos por aqui."],
  },
  retention: {
    register: "warm",
    toneInstructions: "Be empathetic, calm, non-defensive, and focused on understanding the customer's frustration before proposing a next step.",
    examplePhrases: ["Entendi o que te incomodou.", "Vamos resolver isso sem te fazer repetir tudo de novo."],
  },
};

export function getProductAgentConversationStyle(agentId: unknown): AgentConversationStyle {
  if (!isProductAgentId(agentId)) return PROFESSIONAL_DEFAULT;
  return CONVERSATION_STYLES[agentId] ?? PROFESSIONAL_DEFAULT;
}
