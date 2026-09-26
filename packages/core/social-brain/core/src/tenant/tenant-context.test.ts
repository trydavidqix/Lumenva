import { describe, expect, it } from 'vitest'
import { TenantContext } from './tenant-context'

const context = {
  userId: 'user-a',
  organizationId: 'org-a',
  role: 'manager' as const,
  isPlatformAdmin: false,
  requestId: 'request-1',
  authSource: 'firebase-session' as const,
}

describe('TenantContext', () => {
  it('requires all resolved identity fields and exposes them in request scope', () => {
    expect(TenantContext.run(context, () => TenantContext.current())).toEqual(context)
  })

  it('fails before repository work when no context exists', () => {
    expect(() => TenantContext.current()).toThrow('TenantContext: missing validated context')
  })
})
