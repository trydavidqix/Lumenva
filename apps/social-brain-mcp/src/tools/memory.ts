import type { McpServer } from '@modelcontextprotocol/server'
import * as z from 'zod/v4'
import type { McpApplicationContext } from '../context'
import { runInstrumentedTool } from '../instrumentation/tool-run'
import { toolResult } from './result'

export function registerMemoryTools(server: McpServer, context: McpApplicationContext): void {
  server.registerTool(
    'memory.search',
    {
      description: 'Search the agent memory',
      inputSchema: z.object({
        query: z.string(),
      }),
      annotations: { readOnlyHint: true },
    },
    async ({ query }) => toolResult(await runInstrumentedTool(context, 'memory.search', { query }, async () => {
      // Stub implementation
      return { results: [] }
    })),
  )

  server.registerTool(
    'memory.write_candidate',
    {
      description: 'Write a candidate to memory with provenance for approval queue',
      inputSchema: z.object({
        content: z.string(),
        provenance: z.string(),
      }),
    },
    async ({ content, provenance }) => toolResult(await runInstrumentedTool(context, 'memory.write_candidate', { content, provenance }, async () => {
      // Stub implementation: Queues for approval
      return { status: 'queued', content, provenance }
    })),
  )
}
