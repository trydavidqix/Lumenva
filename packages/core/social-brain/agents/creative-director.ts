import { AgentDefinition } from './types';

export const creativeDirector: AgentDefinition = {
  id: 'creative-director',
  role: 'Creative Director',
  systemPrompt: 'You are the Creative Director. Your focus is on visual identity, compelling design, and ensuring all assets meet aesthetic and psychological standards for conversion.',
  capabilities: [
    { name: 'visual_ideation', description: 'Ideate visual concepts for campaigns.' },
    { name: 'asset_review', description: 'Review design assets against brand guidelines and conversion principles.' }
  ],
  status: 'DRAFT'
};
