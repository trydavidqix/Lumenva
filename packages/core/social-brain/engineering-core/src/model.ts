export const TASK_STATUSES = ['PENDING', 'IN_PROGRESS', 'BLOCKED', 'FAILED', 'PASSED'] as const
export type TaskStatus = typeof TASK_STATUSES[number]

export const GATE_RESULTS = ['PASS', 'FAIL', 'NOT_EXECUTED', 'NOT_PROVEN'] as const
export type GateResultStatus = typeof GATE_RESULTS[number]

export interface GateResult {
  gate: string
  command: readonly string[]
  exit_code: number | null
  timestamp: string
  branch: string
  commit_sha: string
  result: GateResultStatus
  summary: string
  timed_out?: boolean
  spawn_error?: string
  stdout_truncated?: boolean
  stderr_truncated?: boolean
}

export interface TaskRecord {
  task_id: string
  task_name: string
  status: TaskStatus
  branch: string
  base_sha: string
  current_sha: string
  started_at: string | null
  completed_at: string | null
  required_gates: readonly string[]
  gate_results: readonly GateResult[]
  blocker?: string
  evidence_refs: readonly string[]
}
