import type { AgentDefinition } from '../contracts/agent-os';

export type SalesQualification = 'cold' | 'warm' | 'hot';

export interface SalesRecommendation {
  kind: 'sales_recommendation';
  qualification: SalesQualification;
  nextAction: string;
  rationale: string;
  draftMessage?: string;
}

export type SalesRecommendationValidation =
  | { ok: true }
  | { ok: false; reason: 'invalid_input' | 'invalid_kind' | 'invalid_qualification' | 'invalid_next_action' | 'invalid_rationale' | 'invalid_draft' };

const SALES_QUALIFICATIONS = new Set<string>(['cold', 'warm', 'hot']);

export const SALES_AGENT_DEFINITION = {
  id: 'sales',
  version: '1.0.0',
  objective: 'Qualify a lead and recommend the next commercial action without making commitments or sending messages.',
  autonomyLevel: 'shadow',
  allowedSkills: [],
  allowedTools: [],
  loop: {
    goal: 'Return one bounded qualification and next-action recommendation.',
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

export function validateSalesRecommendation(input: unknown): SalesRecommendationValidation {
  if (!input || typeof input !== 'object') return { ok: false, reason: 'invalid_input' };
  const candidate = input as Record<string, unknown>;
  if (candidate.kind !== 'sales_recommendation') return { ok: false, reason: 'invalid_kind' };
  if (typeof candidate.qualification !== 'string' || !SALES_QUALIFICATIONS.has(candidate.qualification)) {
    return { ok: false, reason: 'invalid_qualification' };
  }
  if (typeof candidate.nextAction !== 'string' || !candidate.nextAction.trim()) return { ok: false, reason: 'invalid_next_action' };
  if (typeof candidate.rationale !== 'string' || !candidate.rationale.trim()) return { ok: false, reason: 'invalid_rationale' };
  if (candidate.draftMessage !== undefined && (typeof candidate.draftMessage !== 'string' || !candidate.draftMessage.trim())) {
    return { ok: false, reason: 'invalid_draft' };
  }
  return { ok: true };
}
