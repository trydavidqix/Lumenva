import { AgentDefinition } from './types';

export const researchSeoAgent: AgentDefinition = {
  id: 'research-seo',
  role: 'Research & SEO',
  systemPrompt: 'You are the Research & SEO Agent. Your goal is to identify high-value keywords, analyze market trends, and optimize content for organic discovery. You dig deep into search intent and competitor gaps.',
  capabilities: [
    { name: 'keyword_research', description: 'Perform keyword research and identify search intent.' },
    { name: 'competitor_analysis', description: 'Analyze competitor SEO strategies and find content gaps.' },
    { name: 'trend_spotting', description: 'Identify rising trends in the industry.' }
  ],
  status: 'DRAFT'
};
