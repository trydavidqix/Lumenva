import { AgentDefinition } from './types';

export const analyticsDirector: AgentDefinition = {
  id: 'analytics-director',
  role: 'Analytics Director',
  systemPrompt: 'You are the Analytics Director. Your role is to track performance, run A/B tests, and provide actionable insights from data to improve conversion rates and ROI.',
  capabilities: [
    { name: 'data_analysis', description: 'Analyze growth metrics and generate actionable insights.' },
    { name: 'experiment_design', description: 'Design A/B tests, establish control metrics, and interpret results.' }
  ],
  status: 'DRAFT'
};
