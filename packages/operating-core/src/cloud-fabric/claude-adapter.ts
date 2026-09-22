import type {
  CapabilitySnapshot,
  ExecutionPort,
  ExecutionResult,
  QuotaSnapshot,
  TaskContract,
} from './execution-port';

export interface ClaudeExecutionClient {
  execute(contract: TaskContract): Promise<ExecutionResult>;
  quota?(): Promise<QuotaSnapshot>;
  health?(): Promise<'healthy' | 'degraded' | 'unavailable'>;
}

export class ClaudeAdapter implements ExecutionPort {
  public readonly name = 'claude';

  constructor(private readonly client?: ClaudeExecutionClient) {}

  async execute(contract: TaskContract): Promise<ExecutionResult> {
    if (!this.client) {
      return {
        task_id: contract.task_id,
        provider: this.name,
        status: 'blocked',
        summary: 'Claude subscription runtime is not connected.',
        files_changed: [],
        tests: [],
        evidence: 'claude_runtime_unconfigured',
        risks: ['external_runtime_required'],
      };
    }
    return this.client.execute(contract);
  }

  async checkQuota(): Promise<QuotaSnapshot> {
    if (!this.client?.quota) {
      return {
        provider: this.name,
        tokens_used: 0,
        cost_usd: 0,
        health: 'degraded',
        measurement_type: 'unavailable',
        observed_at: new Date().toISOString(),
      };
    }
    return this.client.quota();
  }

  async getCapabilities(): Promise<CapabilitySnapshot> {
    return {
      provider: this.name,
      capabilities: ['planning', 'architecture', 'review', 'strategy'],
      supports_tools: true,
      health: await this.health(),
      observed_at: new Date().toISOString(),
    };
  }

  async health(): Promise<'healthy' | 'degraded' | 'unavailable'> {
    if (!this.client) return 'degraded';
    return this.client.health ? this.client.health() : 'healthy';
  }
}
