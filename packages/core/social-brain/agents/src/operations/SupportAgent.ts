import { AgentConfig, ToolStub, Skill } from './types';

export class SupportAgent implements AgentConfig {
  id: string;
  role: string;
  skills: Skill[];
  tools: ToolStub[];

  constructor(config?: Partial<AgentConfig>) {
    this.id = config?.id || 'support-agent-default';
    this.role = config?.role || 'Customer Support Specialist';
    this.skills = config?.skills || ['Troubleshooting', 'Ticket Management', 'Empathy'];
    this.tools = config?.tools || [
      {
        name: 'ticket_reply',
        description: 'Reply to a support ticket'
      }
    ];
  }
}
