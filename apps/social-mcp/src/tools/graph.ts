import type { McpServer } from '@modelcontextprotocol/server'
import * as z from 'zod/v4'
import type { McpApplicationContext } from '../context'
import { runInstrumentedTool } from '../instrumentation/tool-run'
import { toolResult } from './result'

export function registerGraphTools(server: McpServer, context: McpApplicationContext): void {
  server.registerTool(
    'code.graph.path',
    {
      description: 'Query Graphify for code path and dependencies',
      inputSchema: z.object({
        symbol: z.string(),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ symbol }) => toolResult(await runInstrumentedTool(context, 'code.graph.path', { symbol }, async () => {
      // Stub implementation: Querying Graphify
      return { path: ['stub/path/to/symbol'] }
    })),
  )
}
