import type { AnalyticsInsights, AnalyticsWindow } from '@lumenva/core'
import type { McpServer } from '@modelcontextprotocol/server'
import * as z from 'zod/v4'

import type { McpApplicationContext } from '../context'
import { runInstrumentedTool } from '../instrumentation/tool-run'
import { toolResult } from './result'

export const AnalyticsWindowSchema = z.enum(['24h', '7d', '15d', '30d', '60d', 'all'])
export type AnalyticsToolWindow = AnalyticsWindow | 'all'

export type AnalyticsWindowSelection = {
  workspaceId: string
  asOf: string
  timeZone: string
  window: AnalyticsInsights['context']['windows'][AnalyticsWindow]
  hourly24h: {
    all: AnalyticsInsights['hourly24h']
    byPlatform: AnalyticsInsights['hourly24hByPlatform']
  } | undefined
  timeSlots: AnalyticsInsights['timeSlots']
  heatmap: AnalyticsInsights['heatmap']
  explanations: AnalyticsInsights['explanations']
}

export function registerAnalyticsTools(server: McpServer, context: McpApplicationContext): void {
  server.registerTool(
    'social.analytics.analyze',
    {
      description: 'Return evidence-backed analytics, hourly detail and best-time recommendations for Claude to analyze.',
      inputSchema: z.object({ window: AnalyticsWindowSchema.default('all') }),
      annotations: { readOnlyHint: true },
    },
    async ({ window }) => toolResult(await runInstrumentedTool(context, 'social.analytics.analyze', { window }, async () => {
      const insights = await context.analyticsInsights.build(context.workspaceId, new Date().toISOString())
      return window === 'all'
        ? selectAnalyticsInsightsWindow(insights, 'all')
        : selectAnalyticsInsightsWindow(insights, window)
    })),
  )
}

export function selectAnalyticsInsightsWindow(insights: AnalyticsInsights, window: 'all'): AnalyticsInsights
export function selectAnalyticsInsightsWindow(insights: AnalyticsInsights, window: AnalyticsWindow): AnalyticsWindowSelection
export function selectAnalyticsInsightsWindow(insights: AnalyticsInsights, window: AnalyticsToolWindow): AnalyticsInsights | AnalyticsWindowSelection {
  if (window === 'all') return insights

  return {
    workspaceId: insights.workspaceId,
    asOf: insights.asOf,
    timeZone: insights.timeZone,
    window: insights.context.windows[window],
    hourly24h: window === '24h' ? {
      all: insights.hourly24h,
      byPlatform: insights.hourly24hByPlatform,
    } : undefined,
    timeSlots: insights.timeSlots,
    heatmap: insights.heatmap,
    explanations: insights.explanations,
  }
}
