import type { AgentDefinition } from '../contracts/agent-os';

export type GovernanceRecommendation = 'hold' | 'promote_candidate' | 'block';

export interface GovernanceJudgement {
  kind: 'governance_judgement';
  passed: boolean;
  reasons: readonly string[];
  recommendation: GovernanceRecommendation;
}

export type GovernanceJudgementValidation =
  | { ok: true }
  | { ok: false; reason: 'invalid_input' | 'invalid_kind' | 'invalid_passed' | 'invalid_reasons' | 'invalid_recommendation' };

const GOVERNANCE_RECOMMENDATIONS = new Set<string>(['hold', 'promote_candidate', 'block']);

export const GOVERNANCE_JUDGE_AGENT_DEFINITION = {
  id: 'governance_judge',
  version: '1.0.0',
  objective: 'Evaluate agent outputs and golden cases and recommend governance disposition without changing policy, autonomy, or deployment state.',
  autonomyLevel: 'shadow',
  allowedSkills: [],
  allowedTools: [],
  loop: {
    goal: 'Return one evidence-oriented judgement and non-binding governance recommendation.',
    maxSteps: 4,
    maxToolCalls: 1,
    maxTokens: 2_000,
    maxCostCents: 5,
    maxRuntimeMs: 12_000,
    repeatedToolLimit: 2,
    noProgressLimit: 2,
  },
  requiredModelCapabilities: ['structured_output'],
} as const satisfies AgentDefinition;

export function validateGovernanceJudgement(input: unknown): GovernanceJudgementValidation {
  if (!input || typeof input !== 'object') return { ok: false, reason: 'invalid_input' };
  const candidate = input as Record<string, unknown>;
  if (candidate.kind !== 'governance_judgement') return { ok: false, reason: 'invalid_kind' };
  if (typeof candidate.passed !== 'boolean') return { ok: false, reason: 'invalid_passed' };
  if (!Array.isArray(candidate.reasons) || candidate.reasons.length === 0 || !candidate.reasons.every((value) => typeof value === 'string' && value.trim().length > 0)) {
    return { ok: false, reason: 'invalid_reasons' };
  }
  if (typeof candidate.recommendation !== 'string' || !GOVERNANCE_RECOMMENDATIONS.has(candidate.recommendation)) {
    return { ok: false, reason: 'invalid_recommendation' };
  }
  return { ok: true };
}
