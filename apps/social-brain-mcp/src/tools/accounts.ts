import type { McpServer } from '@modelcontextprotocol/server'

import type { McpApplicationContext } from '../context'
import { runInstrumentedTool } from '../instrumentation/tool-run'
import { toolResult } from './result'

export function registerAccountTools(server: McpServer, context: McpApplicationContext): void {
  server.registerTool(
    'social.accounts.list',
    {
      description: 'List the owner workspace social account mappings. Read only.',
      annotations: { readOnlyHint: true },
    },
    async () => toolResult(await runInstrumentedTool(context, 'social.accounts.list', {}, async () => {
      const accounts = await context.accounts.listAccounts(context.workspaceId)
      return accounts.map(({ id, platform, displayName, status }) => ({ id, platform, displayName, status }))
    })),
  )
}
