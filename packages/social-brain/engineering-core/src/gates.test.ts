import { describe, expect, it } from 'vitest'
import { gateExitCode, normalizeGateResult, runGate } from './gates.ts'

describe('gate runner', () => {
  it('normalizes skipped work as not executed', () => {
    expect(normalizeGateResult({ skipped: true, exitCode: null })).toBe('NOT_EXECUTED')
    expect(normalizeGateResult({ skipped: false, exitCode: 0 })).toBe('PASS')
    expect(normalizeGateResult({ skipped: false, exitCode: 1 })).toBe('FAIL')
    expect(gateExitCode('PASS')).toBe(0)
    expect(gateExitCode('FAIL')).toBe(1)
    expect(gateExitCode('NOT_EXECUTED')).toBe(1)
    expect(gateExitCode('NOT_PROVEN')).toBe(1)
  })

  it('does not treat credential-skipped Playwright E2E as a pass', async () => {
    const result = await runGate({
      gate: 'e2e', command: [process.execPath, '-e', 'process.stdout.write("9 skipped\\n2 passed")'],
      cwd: process.cwd(), branch: 'feat/test', commitSha: 'abc', timestamp: '2026-08-23T10:01:00.000Z',
    })
    expect(result.result).toBe('NOT_EXECUTED')
    expect(gateExitCode(result.result)).toBe(1)
  })

  it('runs an argv command without a shell and returns structured evidence', async () => {
    const result = await runGate({
      gate: 'smoke', command: [process.execPath, '-e', 'process.stdout.write("safe output")'],
      cwd: process.cwd(), branch: 'feat/test', commitSha: 'abc', timestamp: '2026-08-23T10:00:00.000Z',
    })
    expect(result.result).toBe('PASS')
    expect(result.exit_code).toBe(0)
    expect(result.summary).toContain('safe output')
  })

  it('returns a structured timeout and terminates the child', async () => {
    const result = await runGate({ gate: 'unit', command: [process.execPath, '-e', 'setTimeout(() => {}, 10000)'], cwd: process.cwd(), branch: 'feat/test', commitSha: 'abc', timeoutMs: 25 })
    expect(result.result).toBe('FAIL')
    expect(result.timed_out).toBe(true)
  })

  it('escalates to SIGKILL when the child ignores SIGTERM', async () => {
    const result = await runGate({ gate: 'unit', command: [process.execPath, '-e', 'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000)'], cwd: process.cwd(), branch: 'feat/test', commitSha: 'abc', timeoutMs: 25, terminationGraceMs: 50 })
    expect(result.result).toBe('FAIL')
    expect(result.timed_out).toBe(true)
    expect(result.exit_code).toBe(null)
  }, 2000)

  it('returns a structured spawn failure', async () => {
    const result = await runGate({ gate: 'unit', command: ['definitely-not-a-real-executable'], cwd: process.cwd(), branch: 'feat/test', commitSha: 'abc' })
    expect(result.result).toBe('FAIL')
    expect(result.spawn_error).toBeTruthy()
  })

  it('bounds stdout and stderr independently', async () => {
    const result = await runGate({ gate: 'unit', command: [process.execPath, '-e', 'process.stdout.write("x".repeat(100000)); process.stderr.write("y".repeat(100000))'], cwd: process.cwd(), branch: 'feat/test', commitSha: 'abc', maxStdoutBytes: 32, maxStderrBytes: 32 })
    expect(result.stdout_truncated).toBe(true)
    expect(result.stderr_truncated).toBe(true)
  })
})
