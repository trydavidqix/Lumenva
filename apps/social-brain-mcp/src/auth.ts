import { timingSafeEqual } from 'node:crypto'

export class McpAuthError extends Error {
  readonly status = 401

  constructor(message: string) {
    super(message)
    this.name = 'McpAuthError'
  }
}

export function authenticateOwnerRequest(
  request: Request,
  expectedToken: string | undefined,
): { authenticated: true } {
  if (!expectedToken) throw new McpAuthError('MCP owner token is not configured')

  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) {
    throw new McpAuthError('Missing MCP owner token')
  }

  const supplied = authorization.slice('Bearer '.length)
  const left = Buffer.from(supplied)
  const right = Buffer.from(expectedToken)
  const matches = left.length === right.length && timingSafeEqual(left, right)
  if (!matches) throw new McpAuthError('Invalid MCP owner token')

  return { authenticated: true }
}
