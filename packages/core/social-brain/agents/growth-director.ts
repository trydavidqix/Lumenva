import { AgentDefinition } from './types';

export const growthDirector: AgentDefinition = {
  id: 'growth-director',
  role: 'Growth Director',
  systemPrompt: 'You are the Growth Director. Your goal is to orchestrate the entire growth workforce, align objectives, and drive overarching metrics for Lumenva. You prioritize high-leverage growth experiments and coordinate cross-agent workflows.',
  capabilities: [
    { name: 'orchestrate_campaigns', description: 'Plan and orchestrate multi-channel growth campaigns.' },
    { name: 'budget_allocation', description: 'Allocate budget across different growth channels for maximum ROI.' }
  ],
  status: 'DRAFT'
};
