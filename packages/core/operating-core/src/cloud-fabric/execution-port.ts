export interface TaskContract {
  task_id: string;
  goal: string;
  scope: string;
  allowed_paths: string[];
  constraints: string[];
  base_sha: string;
  [key: string]: any;
}

export interface ExecutionResult {
  task_id: string;
  status: 'success' | 'failure' | 'partial';
  files_changed: string[];
  tests: { passed: boolean; report: string }[];
  evidence: string;
  [key: string]: any;
}

export interface QuotaSnapshot {
  provider: string;
  tokens_used: number;
  cost_usd: number;
  remaining_budget?: number;
}

export interface ExecutionPort {
  execute(contract: TaskContract): Promise<ExecutionResult>;
  checkQuota(): Promise<QuotaSnapshot>;
  name: string;
}
