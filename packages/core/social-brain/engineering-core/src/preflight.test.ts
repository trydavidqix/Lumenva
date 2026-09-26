import { describe, expect, it } from 'vitest'
import { checkEnvironmentVariables, checkRequiredCommands, resolvePreflightStatus } from './preflight.ts'
import { checkNodeContract } from './release-guard.ts'

describe('safe preflight', () => {
  it('reports presence and shape without exposing values', () => {
    const result = checkEnvironmentVariables({ API_KEY: 'secret-value', REDIRECT_URI: 'https://example.test/callback' }, { API_KEY: 'present', REDIRECT_URI: 'url' })
    expect(result).toEqual([{ name: 'API_KEY', status: 'PRESENT' }, { name: 'REDIRECT_URI', status: 'VALID_SHAPE' }])
    expect(JSON.stringify(result)).not.toContain('secret-value')
  })

  it('detects command availability', async () => {
    const result = await checkRequiredCommands([process.execPath, 'definitely-not-a-command'])
    expect(result[0]).toMatchObject({ command: process.execPath, available: true })
    expect(result[1]).toMatchObject({ command: 'definitely-not-a-command', available: false })
  })

  it('preserves tri-state preflight results', () => {
    expect(resolvePreflightStatus('PASS')).toBe('PASS')
    expect(resolvePreflightStatus('FAIL')).toBe('FAIL')
    expect(resolvePreflightStatus('NOT_PROVEN')).toBe('NOT_PROVEN')
    expect(checkNodeContract({ expected: '22.x', current: '22.23.2', vercel: null }).result).toBe('NOT_PROVEN')
  })
})
