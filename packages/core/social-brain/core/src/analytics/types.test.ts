import { describe, expect, it } from 'vitest'

import type { AnalyticsWindow } from './types'

describe('V1.1 analytics window contract', () => {
  it('supports exactly the approved 24h, 7d, 15d, 30d and 60d windows', () => {
    const windows: AnalyticsWindow[] = ['24h', '7d', '15d', '30d', '60d']
    expect(windows).toEqual(['24h', '7d', '15d', '30d', '60d'])
  })

  it('does not expose the legacy 90d window', () => {
    // @ts-expect-error V1.1 intentionally removes 90d from the public contract.
    const legacy: AnalyticsWindow = '90d'
    expect(legacy).toBe('90d')
  })
})
