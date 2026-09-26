import { describe, expect, it } from 'vitest'
import { decidePermission } from './permissions.ts'

describe('permissions', () => {
  it('keeps tier 1 automatic and tier 3 explicit', () => {
    expect(decidePermission('tests')).toMatchObject({ decision: 'AUTO', tier: 'TIER_1_AUTO' })
    expect(decidePermission('edit', { taskScoped: true })).toMatchObject({ decision: 'TASK_SCOPED', tier: 'TIER_2_TASK_SCOPED' })
    expect(decidePermission('production.deploy')).toMatchObject({ decision: 'EXPLICIT_REQUIRED', tier: 'TIER_3_EXPLICIT' })
  })
})
