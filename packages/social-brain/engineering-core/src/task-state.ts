import type { TaskRecord, TaskStatus } from './model.ts'

export { type TaskRecord, type TaskStatus } from './model.ts'

const transitions: Record<TaskStatus, readonly TaskStatus[]> = {
  PENDING: ['IN_PROGRESS', 'BLOCKED'],
  IN_PROGRESS: ['PASSED', 'FAILED', 'BLOCKED'],
  FAILED: ['IN_PROGRESS', 'BLOCKED'],
  BLOCKED: ['IN_PROGRESS'],
  PASSED: [],
}

export interface CreateTaskInput {
  taskId: string
  taskName: string
  branch: string
  baseSha: string
  requiredGates: readonly string[]
  now?: string
}

export function createTask(input: CreateTaskInput): TaskRecord {
  const now = input.now ?? new Date().toISOString()
  if (!input.taskId.trim() || !input.taskName.trim() || !input.branch.trim() || !input.baseSha.trim()) {
    throw new Error('task id, name, branch and base SHA are required')
  }
  return {
    task_id: input.taskId,
    task_name: input.taskName,
    status: 'PENDING',
    branch: input.branch,
    base_sha: input.baseSha,
    current_sha: input.baseSha,
    started_at: null,
    completed_at: null,
    required_gates: [...new Set(input.requiredGates)],
    gate_results: [],
    evidence_refs: [],
  }
}

export function transitionTask(task: TaskRecord, next: TaskStatus, now = new Date().toISOString()): TaskRecord {
  if (!transitions[task.status].includes(next)) {
    throw new Error(`invalid task transition: ${task.status} -> ${next}`)
  }
  return {
    ...task,
    status: next,
    started_at: next === 'IN_PROGRESS' && task.started_at === null ? now : task.started_at,
    completed_at: next === 'PASSED' ? now : task.completed_at,
  }
}

export function canStartTask(task: TaskRecord, previous?: TaskRecord): { allowed: true } | { allowed: false; reason: string } {
  if (task.status !== 'PENDING' && task.status !== 'FAILED' && task.status !== 'BLOCKED') {
    return { allowed: false, reason: `task ${task.task_id} is already ${task.status}` }
  }
  if (previous !== undefined && previous.status !== 'PASSED') {
    return { allowed: false, reason: `previous task ${previous.task_id} is ${previous.status}` }
  }
  return { allowed: true }
}

export interface TaskIdentity { branch: string; sha: string }

export function canCompleteTask(task: TaskRecord, identity: TaskIdentity = { branch: task.branch, sha: task.current_sha }, workingTreePorcelain = ''): { allowed: true } | { allowed: false; reason: string } {
  if (workingTreePorcelain.length > 0) return { allowed: false, reason: 'working tree is dirty; task completion requires a clean tree' }
  if (identity.branch !== task.branch) return { allowed: false, reason: `task branch is ${task.branch}, current branch is ${identity.branch}` }
  if (identity.sha !== task.current_sha) return { allowed: false, reason: `task SHA is ${task.current_sha}, current SHA is ${identity.sha}` }
  const incomplete = task.required_gates.filter(gate => {
    const result = [...task.gate_results].reverse().find(item => item.gate === gate)
    return result?.result !== 'PASS' || result.branch !== task.branch || result.commit_sha !== task.current_sha
  })
  return incomplete.length === 0
    ? { allowed: true }
    : { allowed: false, reason: `required gates not passed: ${incomplete.join(', ')}` }
}

export function addEvidenceRef(task: TaskRecord, reference: string): TaskRecord { return reference.length === 0 || task.evidence_refs.includes(reference) ? task : { ...task, evidence_refs: [...task.evidence_refs, reference] } }
