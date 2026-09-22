import type { ModelProfile, ModelTier } from './model-registry';
import type { QuotaState } from './quota-router';
import type { RiskLevel, TaskComplexity } from './execution-port';

export interface RoutingInput {
  capabilities: string[];
  risk: RiskLevel;
  complexity: TaskComplexity;
  phase?: 'plan' | 'execute' | 'verify';
  providerQuota?: Record<string, QuotaState>;
  historicalSuccess?: Record<string, number>;
}

export interface RoutingDecision {
  model_id: string;
  provider: string;
  model: string;
  tier: ModelTier;
  score: number;
  reasons: string[];
}

const frontierPhases = new Set(['plan', 'verify']);

export function scoreModel(profile: ModelProfile, input: RoutingInput): RoutingDecision {
  const reasons: string[] = [];
  const quota = input.providerQuota?.[profile.provider] ?? 'UNKNOWN';
  const success = input.historicalSuccess?.[profile.id] ?? profile.reliability;
  let score = success * 100;

  if (frontierPhases.has(input.phase ?? '') && profile.tier === 3) {
    score += 35;
    reasons.push('frontier-preferred-for-plan-or-verify');
  }

  if (input.phase === 'execute') {
    score -= profile.relative_cost * 3;
    reasons.push('execution-cost-penalty');
  } else {
    score -= profile.relative_cost;
  }

  score -= profile.relative_latency;

  if (quota === 'GREEN') score += 15;
  if (quota === 'YELLOW') score += 5;
  if (quota === 'RED') score -= 15;
  if (quota === 'RESERVE') score -= input.phase === 'plan' || input.phase === 'verify' ? 10 : 60;

  const preferred = profile.preferred_for.some((tag) =>
    input.capabilities.some((capability) => tag.includes(capability) || capability.includes(tag)),
  );
  if (preferred) {
    score += 8;
    reasons.push('preferred-capability');
  }

  return {
    model_id: profile.id,
    provider: profile.provider,
    model: profile.model,
    tier: profile.tier,
    score,
    reasons,
  };
}
