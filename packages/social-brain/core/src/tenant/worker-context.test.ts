import { describe, expect, it } from 'vitest'
import { signWorkerTenantContext, verifyWorkerTenantContext } from './worker-context'

const context = {
  userId: 'worker-user',
  organizationId: 'org-a',
  role: 'agent' as const,
  isPlatformAdmin: false,
  requestId: 'job-1',
  authSource: 'firebase-worker' as const,
}

describe('signed worker tenant context', () => {
  it('round-trips only with the signing secret', () => {
    const signed = signWorkerTenantContext(context, 'secret-a')
    expect(verifyWorkerTenantContext(signed.payload, signed.signature, 'secret-a')).toEqual(context)
    expect(() => verifyWorkerTenantContext(signed.payload, signed.signature, 'secret-b')).toThrow(
      'TenantContext: invalid worker signature',
    )
  })
})
