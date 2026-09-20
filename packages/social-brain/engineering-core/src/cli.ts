import { execFileSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { appendEvidence } from './evidence.ts'
import { loadGateDefinitions, resolveCanonicalGateCommand } from './allowed-gates.ts'
import { parseTaskStartArgs } from './cli-args.ts'
import { gateExitCode, runGate } from './gates.ts'
import { loadMemory, saveMemory, type MemorySnapshot } from './memory.ts'
import { decidePermission } from './permissions.ts'
import { checkNodeContract, checkProductionReleaseCandidate } from './release-guard.ts'
import { canCompleteTask, createTask, transitionTask, type TaskRecord } from './task-state.ts'
import { loadTask, saveTask, startTask } from './task-store.ts'

const root = resolve(process.env.LUMENVA_ENGINEERING_ROOT ?? process.cwd())
const stateDir = join(root, '.lumenva', 'engineering')
const taskPath = join(stateDir, 'task-state.json')
const evidencePath = join(stateDir, 'evidence.jsonl')
const memoryPath = join(stateDir, 'memory.json')
const sha = () => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
const branch = () => execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim()
const secrets = () => Object.values(process.env).filter((value): value is string => Boolean(value && value.length >= 16))

async function loadOptionalMemory(): Promise<MemorySnapshot | undefined> {
  try { return await loadMemory(memoryPath) }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error }
}

async function updateMemory(input: Partial<MemorySnapshot> & Pick<MemorySnapshot, 'branch' | 'current_sha'>): Promise<void> {
  const previous = await loadOptionalMemory()
  await saveMemory(memoryPath, { version: 1, branch: input.branch, current_sha: input.current_sha, current_task_id: input.current_task_id === undefined ? previous?.current_task_id ?? null : input.current_task_id, last_completed_task_id: input.last_completed_task_id === undefined ? previous?.last_completed_task_id ?? null : input.last_completed_task_id, findings: input.findings ?? previous?.findings ?? [], blockers: input.blockers ?? previous?.blockers ?? [], evidence_refs: input.evidence_refs ?? previous?.evidence_refs ?? [] }, secrets())
}

function usage(): void { console.log('engineering commands: preflight | release check | permission <action> [--task-scoped] | task start --id ID --name NAME --gates a,b | task status | task complete | gate run --name NAME') }

async function main(): Promise<void> {
  const args = process.argv.slice(2); if (args[0] === '--') args.shift(); const command = args.shift()
  if (command === undefined || command === 'help' || command === '--help') return usage()
  if (command === 'permission') {
    const decision = decidePermission(args.shift() ?? '', { taskScoped: args.includes('--task-scoped') })
    console.log(JSON.stringify(decision, null, 2))
    if (decision.decision !== 'AUTO' && decision.decision !== 'TASK_SCOPED') process.exitCode = 1
    return
  }
  if (command === 'preflight') {
    const nodeContract = checkNodeContract({ expected: '22.x', current: process.version.slice(1), vercel: process.env.VERCEL_NODE ?? null })
    console.log(JSON.stringify({ repository_node: nodeContract.repository_node, current_node: nodeContract.current_node, vercel_node: nodeContract.vercel_node, node_result: nodeContract.result, node_reason: nodeContract.reason, pnpm: process.env.npm_config_user_agent?.split(' ')[0] ?? 'unknown', root, branch: branch(), commit_sha: sha(), status: nodeContract.result }, null, 2))
    if (nodeContract.result !== 'PASS') process.exitCode = 1
    return
  }
  if (command === 'release' && args[0] === 'check') { const result = checkProductionReleaseCandidate({ porcelain: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }) }); console.log(JSON.stringify(result, null, 2)); if (result.result === 'FAIL') process.exitCode = 1; return }
  if (command === 'task' && args[0] === 'status') return console.log(JSON.stringify(await loadTask(taskPath) ?? { status: 'PENDING', message: 'no task state exists' }, null, 2))
  if (command === 'task' && args[0] === 'complete') {
    const task = await loadTask(taskPath); if (!task) throw new Error('no active task'); const currentBranch = branch(); const currentSha = sha(); const currentTask = { ...task, current_sha: currentSha }; const decision = canCompleteTask(currentTask, { branch: currentBranch, sha: currentSha }, execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }))
    if (decision.allowed === false) { await saveTask(taskPath, { ...currentTask, status: 'BLOCKED', blocker: decision.reason }); await updateMemory({ branch: currentBranch, current_sha: currentSha, current_task_id: task.task_id, blockers: [decision.reason] }); throw new Error(decision.reason) }
    const resumable = currentTask.status === 'BLOCKED' || currentTask.status === 'FAILED' ? transitionTask(currentTask, 'IN_PROGRESS') : currentTask; const passed = transitionTask(resumable, 'PASSED'); await saveTask(taskPath, passed); await updateMemory({ branch: currentBranch, current_sha: currentSha, current_task_id: null, last_completed_task_id: passed.task_id, blockers: [] }); console.log(JSON.stringify(passed, null, 2)); return
  }
  if (command === 'task' && args[0] === 'start') { const parsed = parseTaskStartArgs(args.slice(1)); const previous = await loadTask(taskPath); const task = createTask({ taskId: parsed.id, taskName: parsed.name, branch: branch(), baseSha: sha(), requiredGates: parsed.gates }); await startTask(taskPath, task, previous); await updateMemory({ branch: task.branch, current_sha: task.current_sha, current_task_id: task.task_id, blockers: [] }); console.log(JSON.stringify(await loadTask(taskPath), null, 2)); return }
  if (command === 'gate' && args[0] === 'run') {
    const nameIndex = args.indexOf('--name'); const separator = args.indexOf('--'); const name = nameIndex >= 0 ? args[nameIndex + 1] : undefined; const requested = separator >= 0 ? args.slice(separator + 1) : undefined; if (!name) throw new Error('--name is required')
    const definitions = await loadGateDefinitions(root); const resolved = resolveCanonicalGateCommand(name, requested, definitions); if (resolved.allowed === false) throw new Error(resolved.reason)
    const currentBranch = branch(); const currentSha = sha(); const result = await runGate({ gate: name, command: resolved.command, cwd: root, branch: currentBranch, commitSha: currentSha, secrets: secrets() }); await appendEvidence(evidencePath, result, secrets()); const task = await loadTask(taskPath)
    if (task) { const reference = `${result.gate}:${result.timestamp}`; const updated: TaskRecord = { ...task, current_sha: currentSha, gate_results: [...task.gate_results, result], evidence_refs: task.evidence_refs.includes(reference) ? [...task.evidence_refs] : [...task.evidence_refs, reference], status: result.result === 'FAIL' ? 'FAILED' : task.status }; await saveTask(taskPath, updated); await updateMemory({ branch: currentBranch, current_sha: currentSha, current_task_id: updated.task_id, evidence_refs: [...updated.evidence_refs], blockers: result.result === 'FAIL' ? [result.summary] : [] }) }
    console.log(JSON.stringify(result, null, 2)); process.exitCode = gateExitCode(result.result); return
  }
  usage(); process.exitCode = 1
}

main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1 })
