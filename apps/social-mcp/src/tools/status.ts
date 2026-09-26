import type { McpServer } from '@modelcontextprotocol/server'
import * as z from 'zod/v4'

import type { McpApplicationContext } from '../context'
import { runInstrumentedTool } from '../instrumentation/tool-run'
import { toolResult } from './result'

export function registerStatusTools(server: McpServer, context: McpApplicationContext): void {
  server.registerTool(
    'social.publish.status',
    {
      description: 'Return safe local per-network publication status. Raw provider errors and secrets are never returned.',
      inputSchema: z.object({ contentId: z.string().uuid().optional() }),
      annotations: { readOnlyHint: true },
    },
    async ({ contentId }) => toolResult(await runInstrumentedTool(context, 'social.publish.status', { contentId }, async () => {
      let query = context.supabase
        .from('publish_jobs')
        .select('id,content_item_id,platform,status,external_url,published_at,last_error_code')
        .eq('workspace_id', context.workspaceId)
        .order('created_at', { ascending: false })
        .limit(100)
      if (contentId) query = query.eq('content_item_id', contentId)
      const { data, error } = await query
      if (error) throw new Error('Failed to load publication status')
      return data ?? []
    })),
  )
}
