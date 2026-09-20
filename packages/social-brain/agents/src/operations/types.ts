export type Skill = string;

export interface ToolStub {
  name: string;
  description: string;
  schema?: Record<string, any>;
}

export interface AgentConfig {
  id: string;
  role: string;
  skills: Skill[];
  tools: ToolStub[];
}
