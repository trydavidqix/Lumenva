import type { RiskLevel, TaskComplexity } from './execution-port';

export type ModelTier = 0 | 1 | 2 | 3;

export interface ModelProfile {
  id: string;
  provider: string;
  model: string;
  tier: ModelTier;
  capabilities: string[];
  preferred_for: string[];
  max_risk: RiskLevel;
  max_complexity: TaskComplexity;
  subscription_backed: boolean;
  gateway_backed: boolean;
  enabled: boolean;
  relative_cost: number;
  relative_latency: number;
  reliability: number;
}

const riskRank: Record<RiskLevel, number> = { R0: 0, R1: 1, R2: 2, R3: 3, R4: 4 };
const complexityRank: Record<TaskComplexity, number> = {
  TINY: 0,
  LIGHT: 1,
  NORMAL: 2,
  HEAVY: 3,
  EXCLUSIVE: 4,
};

export class ModelRegistry {
  private readonly models = new Map<string, ModelProfile>();

  constructor(seed: ModelProfile[] = defaultModels()) {
    for (const model of seed) this.models.set(model.id, model);
  }

  list(): ModelProfile[] {
    return [...this.models.values()];
  }

  upsert(profile: ModelProfile): void {
    this.models.set(profile.id, profile);
  }

  get(id: string): ModelProfile | undefined {
    return this.models.get(id);
  }

  candidates(input: {
    capabilities: string[];
    risk: RiskLevel;
    complexity: TaskComplexity;
    minTier?: ModelTier;
    maxTier?: ModelTier;
  }): ModelProfile[] {
    const minTier = input.minTier ?? 0;
    const maxTier = input.maxTier ?? 3;
    return this.list().filter((model) => {
      if (!model.enabled || model.tier < minTier || model.tier > maxTier) return false;
      if (riskRank[model.max_risk] < riskRank[input.risk]) return false;
      if (complexityRank[model.max_complexity] < complexityRank[input.complexity]) return false;
      return input.capabilities.every((capability) => model.capabilities.includes(capability));
    });
  }
}

export function defaultModels(): ModelProfile[] {
  return [
    {
      id: 'codex-sol',
      provider: 'codex',
      model: 'sol',
      tier: 3,
      capabilities: ['coding', 'review', 'architecture', 'debugging'],
      preferred_for: ['critical-coding', 'technical-planning', 'review'],
      max_risk: 'R4',
      max_complexity: 'EXCLUSIVE',
      subscription_backed: true,
      gateway_backed: false,
      enabled: true,
      relative_cost: 9,
      relative_latency: 6,
      reliability: 0.98,
    },
    {
      id: 'claude-frontier',
      provider: 'claude',
      model: 'frontier',
      tier: 3,
      capabilities: ['planning', 'architecture', 'review', 'strategy'],
      preferred_for: ['master-plan', 'strategy', 'critical-acceptance'],
      max_risk: 'R4',
      max_complexity: 'EXCLUSIVE',
      subscription_backed: true,
      gateway_backed: false,
      enabled: true,
      relative_cost: 10,
      relative_latency: 6,
      reliability: 0.98,
    },
    {
      id: 'gemini-pro',
      provider: 'antigravity',
      model: 'gemini-pro',
      tier: 3,
      capabilities: ['planning', 'research', 'browser', 'vision', 'review'],
      preferred_for: ['research', 'browser-qa', 'multimodal'],
      max_risk: 'R4',
      max_complexity: 'EXCLUSIVE',
      subscription_backed: true,
      gateway_backed: false,
      enabled: true,
      relative_cost: 8,
      relative_latency: 5,
      reliability: 0.96,
    },
    {
      id: 'codex-terra',
      provider: 'codex',
      model: 'terra',
      tier: 2,
      capabilities: ['coding', 'review', 'debugging'],
      preferred_for: ['normal-coding', 'refactor'],
      max_risk: 'R3',
      max_complexity: 'HEAVY',
      subscription_backed: true,
      gateway_backed: false,
      enabled: true,
      relative_cost: 5,
      relative_latency: 4,
      reliability: 0.96,
    },
    {
      id: 'kimi-worker',
      provider: 'gateway',
      model: 'kimi',
      tier: 2,
      capabilities: ['coding', 'vision', 'frontend'],
      preferred_for: ['frontend', 'visual-debugging'],
      max_risk: 'R2',
      max_complexity: 'HEAVY',
      subscription_backed: false,
      gateway_backed: true,
      enabled: true,
      relative_cost: 3,
      relative_latency: 4,
      reliability: 0.9,
    },
    {
      id: 'minimax-worker',
      provider: 'gateway',
      model: 'minimax',
      tier: 1,
      capabilities: ['coding', 'documents', 'backoffice', 'classification'],
      preferred_for: ['backoffice', 'repetitive-coding'],
      max_risk: 'R2',
      max_complexity: 'NORMAL',
      subscription_backed: false,
      gateway_backed: true,
      enabled: true,
      relative_cost: 2,
      relative_latency: 3,
      reliability: 0.88,
    },
    {
      id: 'deepseek-worker',
      provider: 'gateway',
      model: 'deepseek',
      tier: 1,
      capabilities: ['coding', 'research', 'classification', 'tests'],
      preferred_for: ['bulk-research', 'tests', 'low-risk-coding'],
      max_risk: 'R2',
      max_complexity: 'NORMAL',
      subscription_backed: false,
      gateway_backed: true,
      enabled: true,
      relative_cost: 1,
      relative_latency: 3,
      reliability: 0.87,
    },
    {
      id: 'qwen-worker',
      provider: 'gateway',
      model: 'qwen',
      tier: 1,
      capabilities: ['coding', 'classification', 'research'],
      preferred_for: ['fallback', 'general-worker'],
      max_risk: 'R2',
      max_complexity: 'NORMAL',
      subscription_backed: false,
      gateway_backed: true,
      enabled: true,
      relative_cost: 2,
      relative_latency: 3,
      reliability: 0.86,
    },
    {
      id: 'codex-luna',
      provider: 'codex',
      model: 'luna',
      tier: 1,
      capabilities: ['coding', 'tests', 'documentation'],
      preferred_for: ['small-coding', 'docs', 'tests'],
      max_risk: 'R2',
      max_complexity: 'NORMAL',
      subscription_backed: true,
      gateway_backed: false,
      enabled: true,
      relative_cost: 2,
      relative_latency: 2,
      reliability: 0.9,
    },
  ];
}
