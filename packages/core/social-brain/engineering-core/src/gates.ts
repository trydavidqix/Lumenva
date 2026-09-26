import { spawn } from 'node:child_process'
import type { GateResult, GateResultStatus } from './model.ts'
import { redactSecrets, summarizeOutput } from './evidence.ts'

export function normalizeGateResult(input: { skipped: boolean; exitCode: number | null }): GateResultStatus {
  if (input.skipped) return 'NOT_EXECUTED'
  if (input.exitCode === null) return 'NOT_PROVEN'
  return input.exitCode === 0 ? 'PASS' : 'FAIL'
}

export function gateExitCode(result: GateResultStatus): number { return result === 'PASS' ? 0 : 1 }

function classifyExecutedResult(gate: string, output: { exitCode: number | null; text: string; stdoutTruncated?: boolean; stderrTruncated?: boolean }): GateResultStatus {
  const result = normalizeGateResult({ skipped: false, exitCode: output.exitCode })
  if (result !== 'PASS' || gate !== 'e2e') return result
  if (/\b[1-9]\d*\s+skipped\b/i.test(output.text)) return 'NOT_EXECUTED'
  if (output.stdoutTruncated === true || output.stderrTruncated === true) return 'NOT_PROVEN'
  return result
}

export interface RunGateInput {
  gate: string
  command: readonly string[]
  cwd: string
  branch: string
  commitSha: string
  timestamp?: string
  secrets?: readonly string[]
  skipped?: boolean
  timeoutMs?: number
  maxStdoutBytes?: number
  maxStderrBytes?: number
  terminationGraceMs?: number
}

export async function runGate(input: RunGateInput): Promise<GateResult> {
  const timestamp = input.timestamp ?? new Date().toISOString()
  if (input.skipped === true) {
    return { gate: input.gate, command: input.command.map(value => redactSecrets(value, input.secrets)), exit_code: null, timestamp, branch: input.branch, commit_sha: input.commitSha, result: 'NOT_EXECUTED', summary: 'gate was intentionally not executed' }
  }
  const [executable, ...args] = input.command
  if (executable === undefined) throw new Error(`gate ${input.gate} has no command`)
  const output = await new Promise<{ exitCode: number | null; text: string; timedOut?: boolean; spawnError?: string; stdoutTruncated?: boolean; stderrTruncated?: boolean }>((resolve) => {
    const child = spawn(executable, args, { cwd: input.cwd, shell: false, env: process.env })
    let stdout = ''; let stderr = ''; let settled = false; let exited = false; let timedOut = false; let spawnError: string | undefined; let stdoutTruncated = false; let stderrTruncated = false; let escalationTimer: ReturnType<typeof setTimeout> | undefined
    const maxStdoutBytes = input.maxStdoutBytes ?? 64 * 1024; const maxStderrBytes = input.maxStderrBytes ?? 64 * 1024
    const timer = setTimeout(() => { timedOut = true; if (exited) return; child.kill('SIGTERM'); escalationTimer = setTimeout(() => { if (!exited) child.kill('SIGKILL') }, input.terminationGraceMs ?? 100).unref() }, input.timeoutMs ?? 300_000)
    const finish = (exitCode: number | null) => { if (settled) return; exited = true; settled = true; clearTimeout(timer); if (escalationTimer !== undefined) clearTimeout(escalationTimer); resolve({ exitCode, text: `${stdout}\n${stderr}`, ...(timedOut ? { timedOut } : {}), ...(spawnError === undefined ? {} : { spawnError }), ...(stdoutTruncated ? { stdoutTruncated } : {}), ...(stderrTruncated ? { stderrTruncated } : {}) }) }
    const append = (target: 'stdout' | 'stderr', chunk: Buffer | string) => { const text = String(chunk); const max = target === 'stdout' ? maxStdoutBytes : maxStderrBytes; const current = target === 'stdout' ? stdout : stderr; const remaining = max - Buffer.byteLength(current); if (remaining <= 0) { if (target === 'stdout') stdoutTruncated = true; else stderrTruncated = true; return } const value = Buffer.byteLength(text) > remaining ? Buffer.from(text).subarray(0, remaining).toString() : text; if (target === 'stdout') { stdout += value; if (value.length < text.length) stdoutTruncated = true } else { stderr += value; if (value.length < text.length) stderrTruncated = true } }
    child.stdout.on('data', chunk => append('stdout', chunk)); child.stderr.on('data', chunk => append('stderr', chunk)); child.on('error', error => { spawnError = error.message; finish(null) }); child.on('close', exitCode => finish(exitCode))
  })
  return {
    gate: input.gate,
    command: input.command.map(value => redactSecrets(value, input.secrets)),
    exit_code: output.exitCode,
    timestamp,
    branch: input.branch,
    commit_sha: input.commitSha,
    result: output.spawnError !== undefined || output.timedOut ? 'FAIL' : classifyExecutedResult(input.gate, output),
    summary: summarizeOutput(redactSecrets(output.text, input.secrets)),
    ...(output.timedOut ? { timed_out: true } : {}), ...(output.spawnError === undefined ? {} : { spawn_error: redactSecrets(output.spawnError, input.secrets) }), ...(output.stdoutTruncated ? { stdout_truncated: true } : {}), ...(output.stderrTruncated ? { stderr_truncated: true } : {}),
  }
}
