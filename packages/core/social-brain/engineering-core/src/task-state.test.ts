import { describe, expect, it } from 'vitest'
import { addEvidenceRef, canCompleteTask, canStartTask, createTask, transitionTask, type TaskRecord } from './task-state.ts'

describe('task state', () => {
  it('creates a pending task with required gate names', () => {
    const task = createTask({
      taskId: 'TASK-001',
      taskName: 'First task',
      branch: 'feat/example',
      baseSha: 'abc123',
      requiredGates: ['typecheck', 'unit'],
      now: '2026-08-23T10:00:00.000Z',
    })

    expect(task).toMatchObject({
      task_id: 'TASK-001',
      status: 'PENDING',
      required_gates: ['typecheck', 'unit'],
      branch: 'feat/example',
      base_sha: 'abc123',
    })
    expect(task.current_sha).toBe('abc123')
  })

  it('allows only valid lifecycle transitions', () => {
    const task = createTask({ taskId: 'TASK-001', taskName: 'First', branch: 'main', baseSha: 'abc', requiredGates: [] })
    const started = transitionTask(task, 'IN_PROGRESS', '2026-08-23T10:01:00.000Z')
    const passed = transitionTask(started, 'PASSED', '2026-08-23T10:02:00.000Z')

    expect(passed.completed_at).toBe('2026-08-23T10:02:00.000Z')
    expect(() => transitionTask(passed, 'IN_PROGRESS')).toThrow(/invalid task transition/i)
  })

  it('blocks a task when the preceding task is not passed', () => {
    const previous = createTask({ taskId: 'TASK-001', taskName: 'First', branch: 'main', baseSha: 'abc', requiredGates: [] })
    const next = createTask({ taskId: 'TASK-002', taskName: 'Second', branch: 'main', baseSha: 'abc', requiredGates: [] })

    expect(canStartTask(next, previous)).toEqual({ allowed: false, reason: 'previous task TASK-001 is PENDING' })
    const passedPrevious: TaskRecord = { ...previous, status: 'PASSED' }
    expect(canStartTask(next, passedPrevious)).toEqual({ allowed: true })
  })

  it('invalidates a passing gate when the task SHA changes', () => {
    const task = createTask({ taskId: 'TASK-001', taskName: 'First', branch: 'feat/a', baseSha: 'sha-a', requiredGates: ['typecheck'] })
    const withGate: TaskRecord = {
      ...task,
      status: 'IN_PROGRESS',
      gate_results: [{ gate: 'typecheck', command: ['pnpm', 'typecheck'], exit_code: 0, timestamp: '2026-08-23T10:00:00.000Z', branch: 'feat/a', commit_sha: 'sha-a', result: 'PASS', summary: 'ok' }],
    }
    expect(canCompleteTask(withGate, { branch: 'feat/a', sha: 'sha-a' })).toEqual({ allowed: true })
    expect(canCompleteTask({ ...withGate, current_sha: 'sha-b' }, { branch: 'feat/a', sha: 'sha-b' })).toMatchObject({ allowed: false })
  })

  it('rejects a passing gate from another task branch', () => {
    const task = createTask({ taskId: 'TASK-001', taskName: 'First', branch: 'feat/a', baseSha: 'sha-a', requiredGates: ['typecheck'] })
    const withGate: TaskRecord = {
      ...task,
      status: 'IN_PROGRESS',
      gate_results: [{ gate: 'typecheck', command: ['pnpm', 'typecheck'], exit_code: 0, timestamp: '2026-08-23T10:00:00.000Z', branch: 'feat/a', commit_sha: 'sha-a', result: 'PASS', summary: 'ok' }],
    }
    expect(canCompleteTask(withGate, { branch: 'feat/b', sha: 'sha-a' })).toMatchObject({ allowed: false })
  })

  it('blocks completion while the working tree is dirty', () => {
    const task = createTask({ taskId: 'TASK-001', taskName: 'First', branch: 'feat/a', baseSha: 'sha-a', requiredGates: [] })
    expect(canCompleteTask({ ...task, status: 'IN_PROGRESS' }, { branch: 'feat/a', sha: 'sha-a' }, ' M src/file.ts')).toEqual({ allowed: false, reason: 'working tree is dirty; task completion requires a clean tree' })
    expect(canCompleteTask({ ...task, status: 'IN_PROGRESS' }, { branch: 'feat/a', sha: 'sha-a' }, '')).toEqual({ allowed: true })
  })

  it('accumulates task evidence references without duplicates', () => {
    const task = createTask({ taskId: 'TASK-001', taskName: 'First', branch: 'feat/a', baseSha: 'sha-a', requiredGates: [] })
    expect(addEvidenceRef(task, 'unit:one').evidence_refs).toEqual(['unit:one'])
    expect(addEvidenceRef(addEvidenceRef(task, 'unit:one'), 'build:two').evidence_refs).toEqual(['unit:one', 'build:two'])
    expect(addEvidenceRef(addEvidenceRef(task, 'unit:one'), 'unit:one').evidence_refs).toEqual(['unit:one'])
  })
})
