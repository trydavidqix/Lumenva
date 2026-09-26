import { AgentConfig, ToolStub, Skill } from './types';

export class FinanceAgent implements AgentConfig {
  id: string;
  role: string;
  skills: Skill[];
  tools: ToolStub[];

  constructor(config?: Partial<AgentConfig>) {
    this.id = config?.id || 'finance-agent-default';
    this.role = config?.role || 'Financial Analyst';
    this.skills = config?.skills || ['Invoicing', 'Expense Tracking', 'Reporting'];
    this.tools = config?.tools || [
      {
        name: 'generate_invoice',
        description: 'Generate an invoice for a client'
      }
    ];
  }
}
