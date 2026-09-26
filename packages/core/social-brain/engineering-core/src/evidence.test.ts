import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { appendEvidence, redactSecrets, summarizeOutput } from './evidence.ts'

describe('evidence safety', () => {
  it('redacts explicit secrets and bearer/key-shaped values', () => {
    const input = 'token=beta-secret authorization: Bearer abc123 api_key=sk-test-123'
    const output = redactSecrets(input, ['beta-secret'])
    expect(output).not.toContain('beta-secret')
    expect(output).not.toContain('abc123')
    expect(output).not.toContain('sk-test-123')
    expect(output).toContain('[REDACTED]')
  })

  it('bounds and redacts command output before evidence persistence', async () => {
    const root = await mkdtemp(join(tmpdir(), 'lumenva-evidence-'))
    const file = join(root, 'evidence.jsonl')
    await appendEvidence(file, {
      gate: 'unit', command: ['pnpm', 'test'], exit_code: 0,
      timestamp: '2026-08-23T10:00:00.000Z', branch: 'feat/test', commit_sha: 'abc',
      result: 'PASS', summary: summarizeOutput('access_token=super-secret\n' + 'x'.repeat(5000), ['super-secret']),
    }, ['fixture-explicit-secret'])
    const persisted = await readFile(file, 'utf8')
    expect(persisted).not.toContain('super-secret')
    expect(persisted.length).toBeLessThan(1200)
  })

  it('redacts credentials in every persisted string, including argv', async () => {
    const values = [
      'Bearer fixture-bearer', 'API_KEY=fixture-api-key', 'ACCESS_TOKEN=fixture-access-token',
      'REFRESH_TOKEN=fixture-refresh-token', 'PASSWORD=fixture-password', 'SECRET=fixture-secret',
      'ghp_fixtureGitHubToken1234567890', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature', 'fixture-explicit-secret',
    ]
    const input = values.join(' ')
    const redacted = redactSecrets(input, ['fixture-explicit-secret'])
    for (const value of values) expect(redacted).not.toContain(value)

    const root = await mkdtemp(join(tmpdir(), 'lumenva-evidence-redaction-'))
    const file = join(root, 'evidence.jsonl')
    await appendEvidence(file, {
      gate: 'unit', command: ['node', `--header=Bearer fixture-bearer`, 'API_KEY=fixture-api-key', 'fixture-explicit-secret'], exit_code: 0,
      timestamp: '2026-08-23T10:00:00.000Z', branch: 'feat/test', commit_sha: 'abc', result: 'PASS', summary: input,
    }, ['fixture-explicit-secret'])
    const persisted = await readFile(file, 'utf8')
    for (const value of values) expect(persisted).not.toContain(value)
  })
})
