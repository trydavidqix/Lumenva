import { describe, expect, it } from 'vitest'

import { rejectApprovalBypassKeys } from './publishing'

describe('MCP publishing guard', () => {
  it('rejects hidden approval bypass inputs', () => {
    expect(() => rejectApprovalBypassKeys({ contentId: 'c1', force: true })).toThrow('approval bypass')
    expect(() => rejectApprovalBypassKeys({ contentId: 'c1', skipApproval: true })).toThrow('approval bypass')
    expect(() => rejectApprovalBypassKeys({ contentId: 'c1', approve: true })).toThrow('approval bypass')
  })

  it('allows normal application identifiers only', () => {
    expect(() => rejectApprovalBypassKeys({ contentId: 'c1' })).not.toThrow()
  })
})
