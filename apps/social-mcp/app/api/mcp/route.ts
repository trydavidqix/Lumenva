import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/server'

import { authenticateOwnerRequest, McpAuthError } from '../../../src/auth'
import { createMcpApplicationContext } from '../../../src/context'
import { createSocialBrainMcpServer } from '../../../src/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function handle(request: Request): Promise<Response> {
  try {
    authenticateOwnerRequest(request, process.env.MCP_OWNER_TOKEN)
    const context = await createMcpApplicationContext()
    const server = createSocialBrainMcpServer(context)
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    })
    await server.connect(transport)
    return await transport.handleRequest(request)
  } catch (error) {
    if (error instanceof McpAuthError) {
      return Response.json({ error: 'unauthorized' }, { status: error.status })
    }
    console.error('MCP request failed', error instanceof Error ? error.message : 'unknown error')
    return Response.json({ error: 'mcp_request_failed' }, { status: 500 })
  }
}

export const POST = handle
export const GET = handle
export const DELETE = handle
