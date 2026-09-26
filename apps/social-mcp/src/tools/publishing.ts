import type { McpServer } from '@modelcontextprotocol/server'
import * as z from 'zod/v4'

import type { McpApplicationContext } from '../context'
import { runInstrumentedTool } from '../instrumentation/tool-run'
import { toolResult } from './result'

const BYPASS_KEYS = new Set(['approve', 'approved', 'force', 'skipApproval', 'skip_approval'])

export function rejectApprovalBypassKeys(input: Record<string, unknown>): void {
  if (Object.keys(input).some((key) => BYPASS_KEYS.has(key))) {
    throw new Error('MCP approval bypass inputs are forbidden')
  }
}

export function registerPublishingTools(server: McpServer, context: McpApplicationContext): void {
  server.registerTool(
    'social.publish.schedule',
    {
      description: 'Create four scheduled publication jobs only when the exact current snapshot is already human-approved.',
      inputSchema: z.object({ contentId: z.string().uuid() }).strict(),
    },
    async (input) => toolResult(await runInstrumentedTool(context, 'social.publish.schedule', input, async () => {
      rejectApprovalBypassKeys(input)
      const jobs = await context.publication.createPublishJobs(input.contentId, { mode: 'schedule' })
      return jobs.map(({ id, platform, status, scheduledFor }) => ({ id, platform, status, scheduledFor }))
    })),
  )

  server.registerTool(
    'social.publish.now',
    {
      description: 'Create four immediate publication jobs only when the exact current snapshot is already human-approved.',
      inputSchema: z.object({ contentId: z.string().uuid() }).strict(),
    },
    async (input) => toolResult(await runInstrumentedTool(context, 'social.publish.now', input, async () => {
      rejectApprovalBypassKeys(input)
      const jobs = await context.publication.createPublishJobs(input.contentId, { mode: 'now' })
      return jobs.map(({ id, platform, status }) => ({ id, platform, status }))
    })),
  )

  server.registerTool(
    'social.jobs.retry',
    {
      description: 'Retry one failed network publication after rechecking the same current human approval.',
      inputSchema: z.object({ publishJobId: z.string().uuid() }).strict(),
    },
    async (input) => toolResult(await runInstrumentedTool(context, 'social.jobs.retry', input, async () => {
      rejectApprovalBypassKeys(input)
      const job = await context.publication.retryPublishJob(input.publishJobId)
      return { id: job.id, platform: job.platform, status: job.status }
    })),
  )
}
