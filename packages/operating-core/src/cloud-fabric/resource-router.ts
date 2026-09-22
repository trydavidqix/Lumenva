import { CloudProvider } from './cloud-job';
import type { ExecutionPort, RiskLevel, TaskComplexity } from './execution-port';
import { CodexAdapter } from './codex-adapter';
import { AntigravityAdapter } from './antigravity-adapter';
import { QuotaRouter, type QuotaState } from './quota-router';
import { ModelRegistry, type ModelProfile, type ModelTier } from './model-registry';
import { scoreModel, type RoutingDecision } from './routing-policy';

export interface ExecutionTarget {
  provider: CloudProvider | string;
  region?: string;
  capacity?: string;
  adapter?: ExecutionPort;
  model?: ModelProfile;
  decision?: RoutingDecision;
}

export interface TaskRequirements {
  capability: string[];
  requires_gpu?: boolean;
  priority: number;
  risk_level?: 'low' | 'medium' | 'high';
  risk?: RiskLevel;
  complexity?: TaskComplexity;
  phase?: 'plan' | 'execute' | 'verify';
  historical_success?: Record<string, number>;
}

function normalizeRisk(requirements: TaskRequirements): RiskLevel {
  if (requirements.risk) return requirements.risk;
  if (requirements.risk_level === 'high') return 'R4';
  if (requirements.risk_level === 'medium') return 'R2';
  return 'R1';
}

export class ResourceRouter {
  private codex = new CodexAdapter();
  private antigravity = new AntigravityAdapter();
  private quotaRouter = new QuotaRouter();
  private models: ModelRegistry;

  constructor(models: ModelRegistry = new ModelRegistry()) {
    this.models = models;
  }

  async route(requirements: TaskRequirements): Promise<ExecutionTarget> {
    if (requirements.requires_gpu) {
      return { provider: CloudProvider.GOOGLE_CLOUD, capacity: 'high' };
    }
    if (requirements.capability.includes('windows')) {
      return { provider: CloudProvider.LOCAL_WINDOWS };
    }
    if (requirements.capability.includes('linux')) {
      return { provider: CloudProvider.LOCAL_LINUX };
    }

    const risk = normalizeRisk(requirements);
    const complexity = requirements.complexity ?? 'NORMAL';
    const phase = requirements.phase ?? 'execute';
    const tierRange = this.tierRange(phase, risk, complexity);
    const candidates = this.models.candidates({
      capabilities: requirements.capability,
      risk,
      complexity,
      minTier: tierRange.min,
      maxTier: tierRange.max,
    });

    const providerQuota = await this.providerQuotaStates();
    const decisions = candidates
      .map((model) => ({ model, decision: scoreModel(model, {
        capabilities: requirements.capability,
        risk,
        complexity,
        phase,
        providerQuota,
        historicalSuccess: requirements.historical_success,
      }) }))
      .sort((a, b) => b.decision.score - a.decision.score);

    const best = decisions[0];
    if (best) {
      return {
        provider: best.model.provider,
        model: best.model,
        decision: best.decision,
        adapter: this.adapterForProvider(best.model.provider),
      };
    }

    try {
      const selectedAdapter = await this.quotaRouter.selectProviderBasedOnQuota(
        [this.codex, this.antigravity],
        { allowReserve: phase !== 'execute' },
      );
      return { provider: selectedAdapter.name, adapter: selectedAdapter };
    } catch {
      return { provider: CloudProvider.OPENAI_CLOUD };
    }
  }

  private tierRange(
    phase: 'plan' | 'execute' | 'verify',
    risk: RiskLevel,
    complexity: TaskComplexity,
  ): { min: ModelTier; max: ModelTier } {
    if (phase === 'plan' || phase === 'verify') return { min: 2, max: 3 };
    if (risk === 'R4' || complexity === 'EXCLUSIVE') return { min: 3, max: 3 };
    if (risk === 'R3' || complexity === 'HEAVY') return { min: 2, max: 3 };
    return { min: 1, max: 3 };
  }

  private adapterForProvider(provider: string): ExecutionPort | undefined {
    if (provider === 'codex') return this.codex;
    if (provider === 'antigravity') return this.antigravity;
    return undefined;
  }

  private async providerQuotaStates(): Promise<Record<string, QuotaState>> {
    const inspected = await this.quotaRouter.inspect([this.codex, this.antigravity]);
    return Object.fromEntries(inspected.map((item) => [item.port.name, item.state]));
  }
}
