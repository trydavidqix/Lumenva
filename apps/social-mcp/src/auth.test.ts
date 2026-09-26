import { describe, expect, it } from 'vitest'

import { authenticateOwnerRequest, McpAuthError } from './auth'

describe('MCP owner authentication', () => {
  it('rejects a missing bearer token', () => {
    const request = new Request('https://example.test/api/mcp')
    expect(() => authenticateOwnerRequest(request, 'owner-secret')).toThrow(McpAuthError)
  })

  it('rejects a wrong bearer token', () => {
    const request = new Request('https://example.test/api/mcp', {
      headers: { authorization: 'Bearer wrong' },
    })
    expect(() => authenticateOwnerRequest(request, 'owner-secret')).toThrow('Invalid MCP owner token')
  })

  it('accepts the configured owner token', () => {
    const request = new Request('https://example.test/api/mcp', {
      headers: { authorization: 'Bearer owner-secret' },
    })
    expect(authenticateOwnerRequest(request, 'owner-secret')).toEqual({ authenticated: true })
  })
})
