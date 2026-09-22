import { cancelledResult, ExecutionPort, HealthSnapshot, TaskContract, ExecutionResult, QuotaSnapshot, unavailableQuota, unavailableResult, UsageSnapshot } from './execution-port.js';

export class CodexAdapter implements ExecutionPort {
  public name = 'codex';

  async execute(contract: TaskContract): Promise<ExecutionResult> {
    return unavailableResult(contract.task_id, this.name, 'Codex execution adapter is not configured for this runtime');
  }

  async resume(taskId: string): Promise<ExecutionResult> {
    return unavailableResult(taskId, this.name, 'Codex resume is unavailable because no execution handle is configured');
  }

  async cancel(taskId: string): Promise<ExecutionResult> {
    return cancelledResult(taskId, this.name);
  }

  async health(): Promise<HealthSnapshot> {
    return { ok: false, status: 'unavailable', message: 'Codex execution adapter is not configured' };
  }

  async capabilities(): Promise<string[]> {
    return [];
  }

  async usage(): Promise<UsageSnapshot> {
    return { input_tokens: 0, cached_tokens: 0, output_tokens: 0, duration_ms: 0, cost_usd: 0 };
  }

  async quota(): Promise<QuotaSnapshot> {
    return unavailableQuota(this.name);
  }

  async checkQuota(): Promise<QuotaSnapshot> {
    return this.quota();
  }
}
