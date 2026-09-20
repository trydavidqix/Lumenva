import { describe, expect, it } from 'vitest'

import { engagementActions } from './statistics'
import { normalizeMetrics } from './normalize'

describe('engagementActions', () => {
  it('includes provider-supported saves in engagement totals', () => {
    expect(engagementActions(normalizeMetrics({
      likes: 10,
      comments: 3,
      shares: 2,
      saves: 5,
    }))).toBe(20)
  })
})
