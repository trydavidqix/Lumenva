export type RiskLevel = 'R0' | 'R1' | 'R2' | 'R3' | 'R4';
export type TaskComplexity = 'TINY' | 'LIGHT' | 'NORMAL' | 'HEAVY' | 'EXCLUSIVE';
export type ExecutionStatus = 'success' | 'failure' | 'partial' | 'blocked' | 'waiting_for_approval';
export type MeasurementType = 'exact' | 'estimated' | 'unavailable';

export interface MasterPlanTask {
  task_id: string;
  objective: string;
  depends_on?: string[];
  capabilities?: string[];
  risk: RiskLevel;
  complexity: TaskComplexity;
  acceptance_criteria: string[];
  evidence_requirements?: string[];
}

export interface MasterPlan {
  plan_id: string;
  objective: string;
  business_context?: string;
  assumptions: string[];
  requirements: string[];
  architecture: string[];
  decisions: string[];
  constraints: string[];
  risks: string[];
  dependencies: string[];
  tasks: MasterPlanTask[];
  validation_strategy: string[];
  escalation_policy: string[];
  created_at: string;
  source_agent?: string;
  source_model?: string;
}

export interface TaskContract {
  task_id: string;
  job_id?: string;
  plan_id?: string;
  goal: string;
  scope: string;
  allowed_paths: string[];
  constraints: string[];
  acceptance_criteria?: string[];
  evidence_requirements?: string[];
  capabilities?: string[];
  risk?: RiskLevel;
  complexity?: TaskComplexity;
  base_sha: string;
  context_packet_id?: string;
  max_attempts?: number;
  [key: string]: unknown;
}

export interface ContextReference {
  id: string;
  kind: 'instruction' | 'file' | 'symbol' | 'snippet' | 'memory' | 'evidence' | 'tool';
  source: string;
  reason: string;
  token_estimate?: number;
  hash?: string;
}

export interface ContextPacket {
  context_packet_id: string;
  task_id: string;
  objective: string;
  constraints: string[];
  acceptance_criteria: string[];
  references: ContextReference[];
  allowed_tools: string[];
  token_budget: number;
  expansion_level: 0 | 1 | 2 | 3 | 4;
  created_at: string;
  provenance: string[];
}

export interface ExecutionTestResult {
  name?: string;
  passed: boolean;
  report: string;
  source?: string;
}

export interface ExecutionUsage {
  input_tokens?: number;
  cached_input_tokens?: number;
  output_tokens?: number;
  reasoning_tokens?: number;
  duration_ms?: number;
  cost_usd?: number;
  measurement_type?: MeasurementType;
}

export interface ExecutionResult {
  task_id: string;
  execution_id?: string;
  provider?: string;
  model?: string;
  status: ExecutionStatus;
  summary?: string;
  files_changed: string[];
  commits?: string[];
  tests: ExecutionTestResult[];
  evidence: string;
  artifacts?: string[];
  logs?: string[];
  risks?: string[];
  known_issues?: string[];
  usage?: ExecutionUsage;
  started_at?: string;
  finished_at?: string;
  [key: string]: unknown;
}

export interface ResultDigest {
  task_id: string;
  execution_id?: string;
  status: ExecutionStatus;
  summary: string;
  files_changed: string[];
  tests_passed: boolean;
  risks: string[];
  evidence_refs: string[];
  usage?: ExecutionUsage;
}

export interface QuotaSnapshot {
  provider: string;
  model?: string;
  tokens_used: number;
  cost_usd: number;
  remaining_budget?: number;
  remaining_percent?: number;
  reset_at?: string;
  health?: 'healthy' | 'degraded' | 'unavailable';
  measurement_type?: MeasurementType;
  observed_at?: string;
}

export interface CapabilitySnapshot {
  provider: string;
  model?: string;
  capabilities: string[];
  supports_tools?: boolean;
  supports_vision?: boolean;
  supports_browser?: boolean;
  max_context_tokens?: number;
  health: 'healthy' | 'degraded' | 'unavailable';
  observed_at: string;
}

export interface HandoffRequest {
  handoff_id: string;
  task_id: string;
  from_agent: string;
  to_agent: string;
  objective: string;
  context_packet_id?: string;
  result_digest?: ResultDigest;
  depth: number;
  recursive: boolean;
  created_at: string;
}

export interface ExecutionPort {
  execute(contract: TaskContract): Promise<ExecutionResult>;
  checkQuota(): Promise<QuotaSnapshot>;
  getCapabilities?(): Promise<CapabilitySnapshot>;
  resume?(executionId: string, contract?: TaskContract): Promise<ExecutionResult>;
  cancel?(executionId: string): Promise<void>;
  health?(): Promise<'healthy' | 'degraded' | 'unavailable'>;
  name: string;
}
