import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { redactSecrets } from './evidence.ts'
export interface MemorySnapshot { version: 1; branch: string; current_sha: string; current_task_id: string | null; last_completed_task_id: string | null; findings: readonly string[]; blockers: readonly string[]; evidence_refs: readonly string[] }
export async function saveMemory(path: string, memory: MemorySnapshot, secrets: readonly string[] = []): Promise<void> {
  const safe: MemorySnapshot = { ...memory, branch: redactSecrets(memory.branch, secrets), current_sha: redactSecrets(memory.current_sha, secrets), current_task_id: memory.current_task_id === null ? null : redactSecrets(memory.current_task_id, secrets), last_completed_task_id: memory.last_completed_task_id === null ? null : redactSecrets(memory.last_completed_task_id, secrets), findings: memory.findings.map(value => redactSecrets(value, secrets)), blockers: memory.blockers.map(value => redactSecrets(value, secrets)), evidence_refs: memory.evidence_refs.map(value => redactSecrets(value, secrets)) }
  const payload = JSON.stringify(safe, null, 2) + '\n'
  await mkdir(dirname(path), { recursive: true }); const temporary = `${path}.tmp-${process.pid}`
  await writeFile(temporary, payload, { encoding: 'utf8', mode: 0o600 }); await rename(temporary, path)
}
export async function loadMemory(path: string): Promise<MemorySnapshot> { return JSON.parse(await readFile(path, 'utf8')) as MemorySnapshot }
