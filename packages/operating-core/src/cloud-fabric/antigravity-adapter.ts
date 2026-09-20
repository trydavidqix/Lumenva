import { ExecutionPort, TaskContract, ExecutionResult, QuotaSnapshot } from './execution-port';

export class AntigravityAdapter implements ExecutionPort {
  public name = 'antigravity';

  async execute(contract: TaskContract): Promise<ExecutionResult> {
    // Stub implementation
    return {
      task_id: contract.task_id,
      status: 'success',
      files_changed: [],
      tests: [],
      evidence: 'Antigravity completed the task.',
    };
  }

  async checkQuota(): Promise<QuotaSnapshot> {
    // Stub implementation
    return {
      provider: 'antigravity',
      tokens_used: 0,
      cost_usd: 0,
    };
  }
}
