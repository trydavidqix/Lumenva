import type { AgentDefinition } from '../contracts/agent-os';

export type RetentionRisk = 'low' | 'medium' | 'high';

export interface RetentionRecommendation {
  kind: 'retention_recommendation';
  risk: RetentionRisk;
  action: string;
  rationale: string;
}

export type RetentionRecommendationValidation =
  | { ok: true }
  | { ok: false; reason: 'invalid_input' | 'invalid_kind' | 'invalid_risk' | 'invalid_action' | 'invalid_rationale' };

const RETENTION_RISKS = new Set<string>(['low', 'medium', 'high']);

export const RETENTION_AGENT_DEFINITION = {
  id: 'retention',
  version: '1.0.0',
  objective: 'Diagnose retention risk and recommend a human-reviewed retention action without external communication or commitment.',
  autonomyLevel: 'shadow',
  conversationStyle: {
    register: 'warm',
    toneInstructions: "Be empathetic, calm, non-defensive, and focused on understanding the customer's frustration before proposing a next step.",
    examplePhrases: ['Entendi o que te incomodou.', 'Vamos resolver isso sem te fazer repetir tudo de novo.'],
  },
  allowedSkills: [],
  allowedTools: [],
  loop: {
    goal: 'Return one bounded retention-risk diagnosis and recommendation.',
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

export function validateRetentionRecommendation(input: unknown): RetentionRecommendationValidation {
  if (!input || typeof input !== 'object') return { ok: false, reason: 'invalid_input' };
  const candidate = input as Record<string, unknown>;
  if (candidate.kind !== 'retention_recommendation') return { ok: false, reason: 'invalid_kind' };
  if (typeof candidate.risk !== 'string' || !RETENTION_RISKS.has(candidate.risk)) return { ok: false, reason: 'invalid_risk' };
  if (typeof candidate.action !== 'string' || !candidate.action.trim()) return { ok: false, reason: 'invalid_action' };
  if (typeof candidate.rationale !== 'string' || !candidate.rationale.trim()) return { ok: false, reason: 'invalid_rationale' };
  return { ok: true };
}
