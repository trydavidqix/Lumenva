import type {
  CapabilitySnapshot,
  ExecutionPort,
  ExecutionResult,
  QuotaSnapshot,
  TaskContract,
} from './execution-port';

export interface GatewayClient {
  execute(input: {
    provider: string;
    model: string;
    contract: TaskContract;
  }): Promise<ExecutionResult>;
  quota?(): Promise<QuotaSnapshot>;
  health?(): Promise<'healthy' | 'degraded' | 'unavailable'>;
}

export class GatewayAdapter implements ExecutionPort {
  public readonly name = 'gateway';

  constructor(
    private readonly client?: GatewayClient,
    private readonly model = 'auto',
    private readonly provider = 'gateway',
  ) {}

  async execute(contract: TaskContract): Promise<ExecutionResult> {
    if (!this.client) {
      return {
        task_id: contract.task_id,
        provider: this.provider,
        model: this.model,
        status: 'blocked',
        summary: 'Gateway execution client is not configured.',
        files_changed: [],
        tests: [],
        evidence: 'gateway_client_unconfigured',
        risks: ['external_credentials_or_runtime_required'],
      };
    }
    return this.client.execute({ provider: this.provider, model: this.model, contract });
  }

  async checkQuota(): Promise<QuotaSnapshot> {
    if (!this.client?.quota) {
      return {
        provider: this.provider,
        model: this.model,
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
      provider: this.provider,
      model: this.model,
      capabilities: ['coding', 'research', 'classification', 'documents', 'frontend', 'tests'],
      supports_tools: true,
      supports_vision: true,
      health: await this.health(),
      observed_at: new Date().toISOString(),
    };
  }

  async health(): Promise<'healthy' | 'degraded' | 'unavailable'> {
    if (!this.client) return 'degraded';
    return this.client.health ? this.client.health() : 'healthy';
  }
}
