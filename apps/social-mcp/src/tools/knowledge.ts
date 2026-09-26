import type { McpServer } from '@modelcontextprotocol/server'
import * as z from 'zod/v4'
import type { McpApplicationContext } from '../context'
import { runInstrumentedTool } from '../instrumentation/tool-run'
import { toolResult } from './result'

export function registerKnowledgeTools(server: McpServer, context: McpApplicationContext): void {
  server.registerTool(
    'knowledge.search',
    {
      description: 'Search the Official Library for knowledge and doctrine',
      inputSchema: z.object({
        query: z.string(),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ query }) => toolResult(await runInstrumentedTool(context, 'knowledge.search', { query }, async () => {
      // Stub implementation: Querying Official Library
      return { results: [{ title: 'Stub Result', snippet: 'Stub for ' + query }] }
    })),
  )
}
