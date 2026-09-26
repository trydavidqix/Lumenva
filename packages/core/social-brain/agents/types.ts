export type AgentStatus = 'DRAFT' | 'EVALUATING' | 'ACTIVE';

export interface AgentCapability {
  name: string;
  description: string;
}

export interface AgentDefinition {
  id: string;
  role: string;
  systemPrompt: string;
  capabilities: AgentCapability[];
  status: AgentStatus;
}
