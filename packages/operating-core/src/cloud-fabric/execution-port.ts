export type ExecutionRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface BudgetLimits {
  input_tokens?: number;
  output_tokens?: number;
  context_percent?: number;
  definitions?: number;
  calls?: number;
  seconds?: number;
  cost_usd?: number;
}

export interface TaskContract {
  task_id: string;
  goal: string;
  scope: string;
  allowed_paths: string[];
  constraints: string[];
  capabilities: string[];
  risk: ExecutionRiskLevel;
  base_sha: string;
  context_budget: BudgetLimits;
  tool_budget: BudgetLimits;
  execution_budget: BudgetLimits;
  preferred_provider?: string;
  evidence_required: string[];
}

export type ExecutionStatus = 'success' | 'failure' | 'partial' | 'unavailable' | 'cancelled';

export interface TestResult {
  passed: boolean;
  report: string;
}

export interface ExecutionError {
  code: string;
  message: string;
  retryable?: boolean;
}

export interface ExecutionResult {
  task_id: string;
  status: ExecutionStatus;
  summary: string;
  files_changed: string[];
  commands: string[];
  tests: TestResult[];
  evidence: string[];
  usage?: UsageSnapshot;
  context_used?: BudgetLimits;
  error?: ExecutionError;
}

export interface QuotaSnapshot {
  provider: string;
  tokens_used: number;
  cost_usd: number;
  available?: boolean;
  remaining_budget?: number;
}

export interface UsageSnapshot {
  input_tokens: number;
  cached_tokens: number;
  output_tokens: number;
  duration_ms: number;
  cost_usd: number;
}

export interface HealthSnapshot {
  ok: boolean;
  status: 'healthy' | 'degraded' | 'unavailable';
  message?: string;
}

export interface ExecutionPort {
  execute(contract: TaskContract): Promise<ExecutionResult>;
  resume(taskId: string): Promise<ExecutionResult>;
  cancel(taskId: string): Promise<ExecutionResult>;
  health(): Promise<HealthSnapshot>;
  capabilities(): Promise<string[]>;
  usage(): Promise<UsageSnapshot>;
  quota(): Promise<QuotaSnapshot>;
  /** @deprecated use quota() */
  checkQuota(): Promise<QuotaSnapshot>;
  name: string;
}

export function unavailableResult(taskId: string, provider: string, message = `${provider} adapter is not configured`): ExecutionResult {
  return {
    task_id: taskId,
    status: 'unavailable',
    summary: message,
    files_changed: [],
    commands: [],
    tests: [],
    evidence: [],
    error: { code: 'provider_unavailable', message, retryable: false },
  };
}

export function cancelledResult(taskId: string, provider: string): ExecutionResult {
  return {
    task_id: taskId,
    status: 'cancelled',
    summary: `${provider} task cancelled before execution`,
    files_changed: [],
    commands: [],
    tests: [],
    evidence: [],
  };
}

export function unavailableQuota(provider: string): QuotaSnapshot {
  return { provider, tokens_used: 0, cost_usd: 0, available: false };
}
