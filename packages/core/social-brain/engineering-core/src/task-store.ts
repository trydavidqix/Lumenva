import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { TaskRecord } from './model.ts'
import { canStartTask, transitionTask } from './task-state.ts'

export async function loadTask(path: string, reader: (path: string, encoding: 'utf8') => Promise<string> = readFile as typeof reader): Promise<TaskRecord | undefined> {
  try { return JSON.parse(await reader(path, 'utf8')) as TaskRecord }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error }
}

export async function saveTask(path: string, task: TaskRecord): Promise<void> {
  await mkdir(dirname(path), { recursive: true }); const temporary = `${path}.tmp-${process.pid}`
  await writeFile(temporary, JSON.stringify(task, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 }); await rename(temporary, path)
}

export async function startTask(path: string, task: TaskRecord, previous?: TaskRecord): Promise<TaskRecord> {
  const decision = canStartTask(task, previous); if (decision.allowed === false) throw new Error(decision.reason)
  const started = transitionTask(task, 'IN_PROGRESS'); await saveTask(path, started); return started
}
