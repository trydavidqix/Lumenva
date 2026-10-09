import { describe, expect, it } from 'vitest'
import { evaluateEditorialRecommendation, type AnalyticsMetricInput } from './pipeline'

describe('Editorial Analytics Pipeline', () => {
  const baseInput: AnalyticsMetricInput = {
    sampleSize: 10,
    isStale: false,
    hasProvenance: true,
    isProviderAvailable: true,
    tenantId: 'tenant-123',
    accountId: 'account-123',
    postId: 'post-123',
  }

  it('returns available for valid data', () => {
    expect(evaluateEditorialRecommendation(baseInput)).toBe('available')
  })

  it('returns inconclusive when sample is insufficient', () => {
    expect(evaluateEditorialRecommendation({ ...baseInput, sampleSize: 3 })).toBe('inconclusive')
  })

  it('returns unavailable when metric is stale', () => {
    expect(evaluateEditorialRecommendation({ ...baseInput, isStale: true })).toBe('unavailable')
  })

  it('returns unavailable when asset lacks provenance', () => {
    expect(evaluateEditorialRecommendation({ ...baseInput, hasProvenance: false })).toBe('unavailable')
  })

  it('returns unavailable when provider is unavailable', () => {
    expect(evaluateEditorialRecommendation({ ...baseInput, isProviderAvailable: false })).toBe('unavailable')
  })

  it('does not cross tenant or account context (validates missing IDs)', () => {
    expect(() => evaluateEditorialRecommendation({ ...baseInput, tenantId: '' })).toThrow('Invalid tenant/account/post context')
    expect(() => evaluateEditorialRecommendation({ ...baseInput, accountId: '' })).toThrow('Invalid tenant/account/post context')
    expect(() => evaluateEditorialRecommendation({ ...baseInput, postId: '' })).toThrow('Invalid tenant/account/post context')
  })

  it('returns unavailable for synthetic or missing provider case specifically', () => {
    expect(evaluateEditorialRecommendation({
      ...baseInput,
      hasProvenance: false,
      isProviderAvailable: false
    })).toBe('unavailable')
  })
})
