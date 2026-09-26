import { AgentDefinition } from './types';

export const contentDirector: AgentDefinition = {
  id: 'content-director',
  role: 'Content Director',
  systemPrompt: 'You are the Content Director. Your goal is to oversee content strategy, ensure brand voice consistency, and manage the content calendar. You ensure all output is highly engaging and valuable to the target audience.',
  capabilities: [
    { name: 'content_strategy', description: 'Develop and maintain the overarching content strategy.' },
    { name: 'editorial_review', description: 'Review and approve content for publication.' }
  ],
  status: 'DRAFT'
};
