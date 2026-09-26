import { describe, expect, it } from 'vitest'

import { MCP_TOOL_NAMES } from './server'

describe('MCP V1 surface', () => {
  it('exposes the planned V1 tools and no human approval tool', () => {
    expect(MCP_TOOL_NAMES).toHaveLength(12)
    expect(MCP_TOOL_NAMES).toContain('social.approval.request')
    expect(MCP_TOOL_NAMES).not.toContain('social.approval.approve' as never)
    expect(MCP_TOOL_NAMES).not.toContain('social.approval.reject' as never)
    expect(MCP_TOOL_NAMES).not.toContain('social.publish.force' as never)
  })
})
