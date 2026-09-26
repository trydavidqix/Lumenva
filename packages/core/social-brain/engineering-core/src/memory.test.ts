import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadMemory, saveMemory, type MemorySnapshot } from './memory.ts'

describe('project memory', () => {
  it('persists and reloads a sanitized snapshot atomically', async () => {
    const root = await mkdtemp(join(tmpdir(), 'lumenva-memory-'))
    const path = join(root, 'memory.json')
    const memory: MemorySnapshot = { version: 1, branch: 'feat/test', current_sha: 'abc', current_task_id: 'TASK-1', last_completed_task_id: null, findings: ['safe finding'], blockers: [], evidence_refs: [] }
    await saveMemory(path, memory, ['fixture-explicit-secret'])
    expect(await loadMemory(path)).toEqual(memory)
    expect(await readFile(path, 'utf8')).not.toContain('token')
  })

  it('redacts secrets without rejecting safe OAuth findings', async () => {
    const root = await mkdtemp(join(tmpdir(), 'lumenva-memory-redaction-'))
    const path = join(root, 'memory.json')
    const memory: MemorySnapshot = { version: 1, branch: 'feat/test', current_sha: 'abc', current_task_id: 'TASK-1', last_completed_task_id: null, findings: ['OAuth finding', 'ACCESS_TOKEN=fixture-access-token'], blockers: [], evidence_refs: ['fixture-explicit-secret'] }
    await saveMemory(path, memory, ['fixture-explicit-secret'])
    const persisted = await readFile(path, 'utf8')
    expect(persisted).toContain('OAuth finding')
    expect(persisted).not.toContain('fixture-access-token')
    expect(persisted).not.toContain('fixture-explicit-secret')
  })
})
