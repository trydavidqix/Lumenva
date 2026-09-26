import { AgentConfig, ToolStub, Skill } from './types';

export class SalesAgent implements AgentConfig {
  id: string;
  role: string;
  skills: Skill[];
  tools: ToolStub[];

  constructor(config?: Partial<AgentConfig>) {
    this.id = config?.id || 'sales-agent-default';
    this.role = config?.role || 'Sales Representative';
    this.skills = config?.skills || ['Lead Generation', 'Negotiation', 'CRM Management'];
    this.tools = config?.tools || [
      {
        name: 'crm_lookup',
        description: 'Lookup customer details in CRM'
      }
    ];
  }
}
