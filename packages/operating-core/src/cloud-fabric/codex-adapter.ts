import { Codex } from '@openai/codex-sdk';
import { cancelledResult, ExecutionPort, HealthSnapshot, TaskContract, ExecutionResult, QuotaSnapshot, unavailableQuota, unavailableResult, UsageSnapshot } from './execution-port.js';

export interface CodexRunnerResult {
  finalResponse: string;
  usage?: UsageSnapshot;
}

export interface CodexRunner {
  run(contract: TaskContract): Promise<CodexRunnerResult>;
}

const executionSchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['success', 'failure', 'partial', 'unavailable', 'cancelled'] },
    summary: { type: 'string' },
    files_changed: { type: 'array', items: { type: 'string' } },
    commands: { type: 'array', items: { type: 'string' } },
    tests: { type: 'array', items: { type: 'object' } },
    evidence: { type: 'array', items: { type: 'string' } },
  },
  required: ['status', 'summary', 'files_changed', 'commands', 'tests', 'evidence'],
  additionalProperties: false,
} as const;

export function createCodexSdkRunner(): CodexRunner {
  return {
    async run(contract) {
      const codex = new Codex();
      const thread = codex.startThread({
        workingDirectory: process.cwd(),
        sandboxMode: 'read-only',
        approvalPolicy: 'never',
        networkAccessEnabled: false,
        webSearchMode: 'disabled',
      });
      const turn = await thread.run(JSON.stringify({ contract, instruction: 'Execute only within the contract and return the required structured result.' }), { outputSchema: executionSchema });
      return { finalResponse: turn.finalResponse, usage: undefined };
    },
  };
}

function parseResult(taskId: string, response: string, usage?: UsageSnapshot): ExecutionResult {
  try {
    const parsed = JSON.parse(response) as Partial<ExecutionResult>;
    if (!parsed.status || !parsed.summary || !Array.isArray(parsed.files_changed) || !Array.isArray(parsed.commands) || !Array.isArray(parsed.tests) || !Array.isArray(parsed.evidence)) {
      throw new Error('provider_result_schema_invalid');
    }
    return { ...parsed, task_id: taskId, usage } as ExecutionResult;
  } catch {
    return {
      task_id: taskId,
      status: 'failure',
      summary: 'Codex returned an unstructured result',
      files_changed: [],
      commands: [],
      tests: [],
      evidence: [],
      error: { code: 'invalid_provider_result', message: 'Codex response did not match ExecutionResult schema', retryable: true },
    };
  }
}

export class CodexAdapter implements ExecutionPort {
  public name = 'codex';

  constructor(private readonly runner?: CodexRunner) {}

  async execute(contract: TaskContract): Promise<ExecutionResult> {
    if (!this.runner) return unavailableResult(contract.task_id, this.name, 'Codex execution adapter is not configured for this runtime');
    try {
      const result = await this.runner.run(contract);
      return parseResult(contract.task_id, result.finalResponse, result.usage);
    } catch (error) {
      return unavailableResult(contract.task_id, this.name, error instanceof Error ? error.message : 'Codex execution failed');
    }
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
