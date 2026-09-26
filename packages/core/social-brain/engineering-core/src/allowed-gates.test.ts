import { describe, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { isAuthorizedGate, loadGateDefinitions, resolveCanonicalGateCommand } from './allowed-gates.ts'

describe('gate allowlist', () => {
  it('denies unknown gates and tier-three actions', () => {
    expect(isAuthorizedGate('unit', ['unit'])).toBe(true)
    expect(isAuthorizedGate('production.deploy', ['unit'])).toBe(false)
    expect(isAuthorizedGate('unknown', ['unit'])).toBe(false)
  })

  it('allows only the canonical argv for an authorized gate', () => {
    const definitions = { unit: ['pnpm', 'test'], build: ['pnpm', 'build'] }
    expect(resolveCanonicalGateCommand('unit', undefined, definitions)).toEqual({ allowed: true, command: ['pnpm', 'test'] })
    expect(resolveCanonicalGateCommand('unit', ['vercel', 'deploy'], definitions)).toMatchObject({ allowed: false })
    expect(resolveCanonicalGateCommand('unit', ['pnpm', 'test'], definitions)).toEqual({ allowed: true, command: ['pnpm', 'test'] })
    expect(resolveCanonicalGateCommand('production.deploy', undefined, definitions)).toMatchObject({ allowed: false })
  })

  it('does not expose a security alias for the environment preflight', async () => {
    const definitions = await loadGateDefinitions(resolve(process.cwd(), '../..'))
    const preflight = definitions.preflight

    expect(definitions.security).toBeUndefined()
    if (preflight === undefined) throw new Error('preflight must remain in the canonical catalog')
    expect(preflight).toEqual(['pnpm', 'engineering', '--', 'preflight'])
    expect(Object.entries(definitions).filter(([name, command]) => name !== 'preflight' && command.join('\u0000') === preflight.join('\u0000'))).toEqual([])
  })
})
