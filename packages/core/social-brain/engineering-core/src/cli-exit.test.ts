import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const cli = resolve(process.cwd(), 'src/cli.ts')
const repositoryRoot = resolve(process.cwd(), '../..')
const temporaryRoots: string[] = []

function runCli(args: readonly string[], envOverrides: Record<string, string | undefined> = {}) {
  const env = { ...process.env }
  for (const [key, value] of Object.entries(envOverrides)) {
    if (value === undefined) delete env[key]
    else env[key] = value
  }
  return spawnSync(process.execPath, ['--experimental-strip-types', cli, ...args], {
    cwd: process.cwd(),
    env,
    encoding: 'utf8',
  })
}

function createIsolatedRepository(): string {
  const root = mkdtempSync(join(tmpdir(), 'lumenva-engineering-cli-'))
  temporaryRoots.push(root)
  mkdirSync(join(root, 'engineering'), { recursive: true })
  copyFileSync(join(repositoryRoot, 'engineering', 'policy.json'), join(root, 'engineering', 'policy.json'))
  writeFileSync(join(root, '.gitignore'), '.lumenva/\n')
  writeFileSync(join(root, 'README.md'), 'isolated core fixture\n')
  writeFileSync(join(root, 'package.json'), JSON.stringify({ private: true, scripts: { test: 'node -e ""' } }) + '\n')
  execFileSync('git', ['init', '--quiet'], { cwd: root })
  execFileSync('git', ['add', '.'], { cwd: root })
  execFileSync('git', ['-c', 'user.name=Lumenva Test', '-c', 'user.email=lumenva-test@example.invalid', 'commit', '--quiet', '-m', 'fixture'], { cwd: root })
  return root
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('engineering CLI semantic exit codes', { timeout: 60_000 }, () => {
  it('fails preflight when external Vercel Node metadata is not proven', () => {
    const result = runCli(['preflight'], { VERCEL_NODE: undefined })
    expect(result.status).not.toBe(0)
    expect(result.stdout).toContain('"status": "NOT_PROVEN"')
  })

  it('fails preflight when Vercel Node drifts from the repository contract', () => {
    const result = runCli(['preflight'], { VERCEL_NODE: '24.x' })
    expect(result.status).not.toBe(0)
    expect(result.stdout).toContain('"status": "FAIL"')
  })

  it('returns success when the repository and Vercel Node contracts are aligned', () => {
    const result = runCli(['preflight'], { VERCEL_NODE: '22.x' })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('"status": "PASS"')
  })

  it('returns success only for allowed permission decisions', () => {
    const allowed = runCli(['permission', 'read'])
    expect(allowed.status).toBe(0)
    expect(allowed.stdout).toContain('"decision": "AUTO"')

    const denied = runCli(['permission', 'architecture.audit'])
    expect(denied.status).not.toBe(0)
    expect(denied.stdout).toContain('"decision": "DENY"')

    const explicit = runCli(['permission', 'production.deploy'])
    expect(explicit.status).not.toBe(0)
    expect(explicit.stdout).toContain('"decision": "EXPLICIT_REQUIRED"')
  }, 15_000)

  it('denies the removed security gate without spawning a command', () => {
    const root = createIsolatedRepository()
    const result = runCli(['gate', 'run', '--name', 'security'], { LUMENVA_ENGINEERING_ROOT: root, VERCEL_NODE: '22.x' })
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('gate denied: security is not in the canonical allowlist')
    expect(existsSync(join(root, '.lumenva', 'engineering', 'evidence.jsonl'))).toBe(false)
  }, 15_000)

  it('does not let a task requesting security obtain a false pass', () => {
    const root = createIsolatedRepository()
    const env = { LUMENVA_ENGINEERING_ROOT: root, VERCEL_NODE: '22.x' }

    expect(runCli(['task', 'start', '--id', 'SECURITY-001', '--name', 'Reject false security gate', '--gates', 'security'], env).status).toBe(0)
    const gate = runCli(['gate', 'run', '--name', 'security'], env)
    expect(gate.status).not.toBe(0)

    const status = runCli(['task', 'status'], env)
    expect(status.stdout).toContain('"required_gates": [\n    "security"')
    expect(status.stdout).toContain('"gate_results": []')
    expect(runCli(['task', 'complete'], env).status).not.toBe(0)
  }, 15_000)

  it('clears current_task_id and records the completed task in memory', () => {
    const root = createIsolatedRepository()
    const env = { LUMENVA_ENGINEERING_ROOT: root, VERCEL_NODE: '22.x' }

    expect(runCli(['task', 'start', '--id', 'MEMORY-001', '--name', 'Complete memory task', '--gates', 'unit'], env).status).toBe(0)
    expect(runCli(['gate', 'run', '--name', 'unit'], env).status).toBe(0)
    expect(runCli(['task', 'complete'], env).status).toBe(0)

    const memory = JSON.parse(readFileSync(join(root, '.lumenva', 'engineering', 'memory.json'), 'utf8')) as { current_task_id: string | null; last_completed_task_id: string | null }
    expect(memory.current_task_id).toBeNull()
    expect(memory.last_completed_task_id).toBe('MEMORY-001')
  }, 30_000)
})
