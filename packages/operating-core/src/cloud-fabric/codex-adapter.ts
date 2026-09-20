import { ExecutionPort, TaskContract, ExecutionResult, QuotaSnapshot } from './execution-port';

export class CodexAdapter implements ExecutionPort {
  public name = 'codex';

  async execute(contract: TaskContract): Promise<ExecutionResult> {
    // Stub implementation
    return {
      task_id: contract.task_id,
      status: 'success',
      files_changed: [],
      tests: [],
      evidence: 'Codex completed the task.',
    };
  }

  async checkQuota(): Promise<QuotaSnapshot> {
    // Stub implementation
    return {
      provider: 'codex',
      tokens_used: 0,
      cost_usd: 0,
    };
  }
}
