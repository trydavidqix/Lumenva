import { describe, expect, it, vi } from 'vitest'

const { registeredTools } = vi.hoisted(() => ({ registeredTools: [] as string[] }))

vi.mock('@modelcontextprotocol/server', () => ({
  McpServer: class {
    registerTool(name: string): void {
      registeredTools.push(name)
    }
  },
}))

import { createSocialBrainMcpServer, MCP_TOOL_NAMES } from './server'

describe('MCP V1 surface', () => {
  it('exposes the planned V1 tools and no human approval tool', () => {
    expect(MCP_TOOL_NAMES).toHaveLength(12)
    expect(MCP_TOOL_NAMES).toContain('social.approval.request')
    expect(MCP_TOOL_NAMES).not.toContain('social.approval.approve' as never)
    expect(MCP_TOOL_NAMES).not.toContain('social.approval.reject' as never)
    expect(MCP_TOOL_NAMES).not.toContain('social.publish.force' as never)
  })

  it('registers exactly the declared business V1 tools', () => {
    registeredTools.length = 0

    createSocialBrainMcpServer({} as never)

    expect([...registeredTools].sort()).toEqual([...MCP_TOOL_NAMES].sort())
  })
})
