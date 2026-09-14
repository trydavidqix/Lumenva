import type { AgentDefinition } from '../contracts/agent-os';

export interface AtendimentoRecommendation {
  kind: 'draft_response';
  draft: string;
  rationale: string;
  needsHumanReview: boolean;
}

export type AtendimentoRecommendationValidation =
  | { ok: true }
  | { ok: false; reason: 'invalid_input' | 'invalid_kind' | 'invalid_draft' | 'invalid_rationale' | 'invalid_review_flag' };

export const ATENDIMENTO_AGENT_DEFINITION = {
  id: 'atendimento',
  version: '1.0.0',
  objective: 'Produce a customer-support response draft from authoritative CRM and inbox context for human review.',
  autonomyLevel: 'shadow',
  conversationStyle: {
    register: 'warm',
    toneInstructions: 'Be warm, patient, calm, clear, and helpful. Never sound like a scripted call center.',
    examplePhrases: ['Claro, vejo isso contigo.', 'Entendi. Vou verificar com calma.'],
  },
  allowedSkills: [],
  allowedTools: [],
  loop: {
    goal: 'Return one safe support draft or identify that human review is required.',
    maxSteps: 4,
    maxToolCalls: 1,
    maxTokens: 2_500,
    maxCostCents: 6,
    maxRuntimeMs: 15_000,
    repeatedToolLimit: 2,
    noProgressLimit: 2,
  },
  requiredModelCapabilities: ['structured_output'],
} as const satisfies AgentDefinition;

export function validateAtendimentoRecommendation(input: unknown): AtendimentoRecommendationValidation {
  if (!input || typeof input !== 'object') return { ok: false, reason: 'invalid_input' };
  const candidate = input as Record<string, unknown>;
  if (candidate.kind !== 'draft_response') return { ok: false, reason: 'invalid_kind' };
  if (typeof candidate.draft !== 'string' || !candidate.draft.trim()) return { ok: false, reason: 'invalid_draft' };
  if (typeof candidate.rationale !== 'string' || !candidate.rationale.trim()) return { ok: false, reason: 'invalid_rationale' };
  if (typeof candidate.needsHumanReview !== 'boolean') return { ok: false, reason: 'invalid_review_flag' };
  return { ok: true };
}
