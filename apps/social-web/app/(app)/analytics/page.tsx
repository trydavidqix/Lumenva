import { redirect } from 'next/navigation'

import type { AnalyticsWindow } from '@lumenva/core'

import { OwnerAuthError } from '../../../lib/auth/require-owner'
import { requireSupabaseOwner } from '../../../lib/auth/supabase-runtime'
import {
  ANALYTICS_PERIODS,
  ANALYTICS_PLATFORMS,
  getAnalyticsDashboard,
  type AnalyticsPlatformFilter,
} from '../../../lib/analytics/get-analytics-dashboard'
import { AnalyticsView } from './analytics-view'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{ window?: string; platform?: string }>
}

export default async function AnalyticsPage({ searchParams }: PageProps) {
  let owner
  try {
    owner = await requireSupabaseOwner()
  } catch (error) {
    if (error instanceof OwnerAuthError) redirect('/login')
    throw error
  }

  const query = await searchParams
  const window = isAnalyticsWindow(query.window) ? query.window : '24h'
  const platform = isAnalyticsPlatform(query.platform) ? query.platform : 'all'
  const model = await getAnalyticsDashboard(owner.workspaceId, window, platform)

  return <AnalyticsView model={model} />
}

function isAnalyticsWindow(value: string | undefined): value is AnalyticsWindow {
  return ANALYTICS_PERIODS.includes(value as AnalyticsWindow)
}

function isAnalyticsPlatform(value: string | undefined): value is AnalyticsPlatformFilter {
  return ANALYTICS_PLATFORMS.includes(value as AnalyticsPlatformFilter)
}
