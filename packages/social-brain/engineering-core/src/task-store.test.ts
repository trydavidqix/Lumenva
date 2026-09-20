import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createTask } from './task-state.ts'
import { loadTask, startTask } from './task-store.ts'

describe('task state persistence', () => {
  it('does not write task N+1 when task N is not passed', async () => {
    const root = await mkdtemp(join(tmpdir(), 'lumenva-task-store-'))
    const path = join(root, 'task-state.json')
    const previous = { ...createTask({ taskId: 'TASK-001', taskName: 'First', branch: 'feat/a', baseSha: 'sha-a', requiredGates: [] }), status: 'IN_PROGRESS' as const }
    await writeFile(path, JSON.stringify(previous, null, 2) + '\n')
    const before = await readFile(path, 'utf8')
    const next = createTask({ taskId: 'TASK-002', taskName: 'Second', branch: 'feat/a', baseSha: 'sha-a', requiredGates: [] })

    await expect(startTask(path, next, previous)).rejects.toThrow(/previous task TASK-001 is IN_PROGRESS/)
    expect(await readFile(path, 'utf8')).toBe(before)
  })

  it('returns undefined only for an absent task state and throws on corruption or I/O failure', async () => {
    const root = await mkdtemp(join(tmpdir(), 'lumenva-task-load-'))
    const missing = join(root, 'missing.json')
    expect(await loadTask(missing)).toBeUndefined()

    const corrupt = join(root, 'corrupt.json')
    await writeFile(corrupt, '{not-json')
    await expect(loadTask(corrupt)).rejects.toThrow()
    await mkdir(join(root, 'directory'))
    await expect(loadTask(join(root, 'directory'))).rejects.toThrow()
    await expect(loadTask(join(root, 'io-error.json'), async () => { throw Object.assign(new Error('permission denied'), { code: 'EACCES' }) })).rejects.toThrow('permission denied')
  })
})
