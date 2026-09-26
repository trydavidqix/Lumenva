import { McpServer } from '@modelcontextprotocol/server'

import type { McpApplicationContext } from './context'
import { registerAccountTools } from './tools/accounts'
import { registerAnalyticsTools } from './tools/analytics'
import { registerContentTools } from './tools/content'
import { registerPublishingTools } from './tools/publishing'
import { registerStatusTools } from './tools/status'
import { registerVideoTools } from './tools/video'
import { registerMaestriTools } from './tools/maestri'
import { registerKnowledgeTools } from './tools/knowledge'
import { registerMemoryTools } from './tools/memory'
import { registerGraphTools } from './tools/graph'
export { RemoteMcpServer } from './remote-mcp'

export const MCP_TOOL_NAMES = [
  'social.accounts.list',
  'social.analytics.analyze',
  'social.publish.status',
  'social.content.create_plan',
  'social.content.create_variants',
  'social.video.generate',
  'social.approval.request',
  'social.approval.status',
  'social.schedule.propose',
  'social.publish.schedule',
  'social.publish.now',
  'social.jobs.retry',
  'maestri.status',
  'maestri.agents.list',
  'maestri.jobs.create',
  'maestri.context.get',
  'maestri.tasks.dispatch',
  'knowledge.search',
  'memory.search',
  'memory.write_candidate',
  'code.graph.path',
] as const

export function createSocialBrainMcpServer(context: McpApplicationContext): McpServer {
  const server = new McpServer(
    { name: 'lumenva-social-brain', version: '1.0.0' },
    {
      instructions: [
        'Operate only the authenticated owner workspace.',
        'Never claim that MCP can approve content: approval is human-only in the dashboard.',
        'Before publishing or retrying, application services re-check the exact approval snapshot.',
        'Provider credentials and native provider payloads are never tool outputs.',
      ].join(' '),
    },
  )

  registerAccountTools(server, context)
  registerAnalyticsTools(server, context)
  registerStatusTools(server, context)
  registerContentTools(server, context)
  registerVideoTools(server, context)
  registerPublishingTools(server, context)
  registerMaestriTools(server, context)
  registerKnowledgeTools(server, context)
  registerMemoryTools(server, context)
  registerGraphTools(server, context)

  return server
}
