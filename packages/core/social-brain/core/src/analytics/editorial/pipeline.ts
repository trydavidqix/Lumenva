export type AnalyticsRecommendationStatus = 'available' | 'unavailable' | 'inconclusive'

export type AnalyticsMetricInput = {
  sampleSize: number
  isStale: boolean
  hasProvenance: boolean
  isProviderAvailable: boolean
  tenantId: string
  accountId: string
  postId: string
}

export function evaluateEditorialRecommendation(input: AnalyticsMetricInput): AnalyticsRecommendationStatus {
  if (!input.tenantId || !input.accountId || !input.postId) {
    throw new Error('Invalid tenant/account/post context')
  }

  if (!input.isProviderAvailable || !input.hasProvenance || input.isStale) {
    return 'unavailable'
  }

  if (input.sampleSize < 5) {
    return 'inconclusive'
  }

  return 'available'
}
