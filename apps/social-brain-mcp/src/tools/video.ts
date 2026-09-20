import { ContentPlanSchema, type ContentItem } from '@lumenva/core'
import type { McpServer } from '@modelcontextprotocol/server'
import * as z from 'zod/v4'

import type { McpApplicationContext } from '../context'
import { runInstrumentedTool } from '../instrumentation/tool-run'
import { toolResult } from './result'

type VideoPlanSource = Pick<ContentItem, 'objective' | 'topic' | 'hook' | 'script' | 'videoBrief'>

export function assertVideoGenerationReady(content: VideoPlanSource): void {
  const parsed = ContentPlanSchema.safeParse({
    objective: content.objective,
    topic: content.topic,
    hook: content.hook,
    script: content.script,
    videoBrief: content.videoBrief,
  })
  if (!parsed.success) throw new Error('Content plan is incomplete for video generation')
}

export function registerVideoTools(server: McpServer, context: McpApplicationContext): void {
  server.registerTool(
    'social.video.generate',
    {
      description: 'Enqueue provider-neutral video generation for a complete validated content plan.',
      inputSchema: z.object({ contentId: z.string().uuid() }).strict(),
    },
    async ({ contentId }) => toolResult(await runInstrumentedTool(context, 'social.video.generate', { contentId }, async () => {
      const content = await context.content.getContentItem(contentId)
      if (!content || content.workspaceId !== context.workspaceId) throw new Error('Content item not found')
      assertVideoGenerationReady(content)
      const job = await context.backgroundJobs.enqueueJob({
        workspaceId: context.workspaceId,
        jobType: 'video.generate',
        payload: { contentItemId: contentId },
        maxAttempts: 3,
      })
      return { jobId: job.id, contentId, status: job.status }
    })),
  )
}
