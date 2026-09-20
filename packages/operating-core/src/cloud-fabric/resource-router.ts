import { CloudProvider } from './cloud-job';
import { ExecutionPort } from './execution-port';
import { CodexAdapter } from './codex-adapter';
import { AntigravityAdapter } from './antigravity-adapter';
import { QuotaRouter } from './quota-router';

export interface ExecutionTarget {
  provider: CloudProvider | string;
  region?: string;
  capacity?: string;
  adapter?: ExecutionPort;
}

export interface TaskRequirements {
  capability: string[];
  requires_gpu?: boolean;
  priority: number;
  risk_level?: 'low' | 'medium' | 'high';
}

export class ResourceRouter {
  private codex = new CodexAdapter();
  private antigravity = new AntigravityAdapter();
  private quotaRouter = new QuotaRouter();

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

    let candidateAdapters: ExecutionPort[] = [];
    if (requirements.risk_level === 'high') {
      candidateAdapters = [this.antigravity];
    } else {
      candidateAdapters = [this.codex, this.antigravity];
    }

    try {
      const selectedAdapter = await this.quotaRouter.selectProviderBasedOnQuota(candidateAdapters);
      return { provider: selectedAdapter.name, adapter: selectedAdapter };
    } catch (error) {
      return { provider: CloudProvider.OPENAI_CLOUD };
    }
  }
}
