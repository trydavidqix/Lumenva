import { describe, expect, it, vi } from 'vitest'
import { runPlatformAdminContext } from './platform-admin-context'

describe('platform admin tenant context', () => {
  it('requires explicit audit before running cross-tenant callback', async () => {
    const audit = vi.fn(async () => undefined)
    const callback = vi.fn(async () => 'done')
    await expect(runPlatformAdminContext({
      userId: 'admin-1',
      organizationId: 'org-a',
      role: 'admin',
      isPlatformAdmin: true,
      requestId: 'request-1',
      authSource: 'platform-admin',
    }, audit, callback)).resolves.toBe('done')
    expect(audit).toHaveBeenCalledWith({ action: 'platform_admin.tenant_access', userId: 'admin-1', organizationId: 'org-a', requestId: 'request-1' })
    expect(callback).toHaveBeenCalledOnce()
  })
})
