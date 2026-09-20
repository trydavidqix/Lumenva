import type { NeonIdentityContext } from './contract'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function assertNeonIdentity(identity: NeonIdentityContext): void {
  if (!identity.subject.trim()) throw new Error('Neon identity subject is required')
  if (!uuidPattern.test(identity.subject)) throw new Error('Neon identity subject must be a valid UUID')
  if (identity.workspaceId !== undefined) {
    if (!identity.workspaceId.trim()) throw new Error('Neon identity workspaceId cannot be empty')
    if (!uuidPattern.test(identity.workspaceId)) throw new Error('Neon identity workspaceId must be a valid UUID')
  }
}
