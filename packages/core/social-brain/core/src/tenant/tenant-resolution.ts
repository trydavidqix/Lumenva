import {
  type TenantContextData,
  type TenantRole,
  TENANT_ROLES,
} from './tenant-context'

export interface VerifiedFirebaseSession {
  readonly firebaseUid: string
  readonly userId?: string
}

export interface IdentityMapping {
  readonly userId: string
  readonly active: boolean
}

export interface ActiveMembership {
  readonly organizationId: string
  readonly role: string
  readonly active: boolean
}

export interface TenantIdentityRepositories {
  verifySession(token: string): Promise<VerifiedFirebaseSession>
  findIdentityMapping(firebaseUid: string): Promise<IdentityMapping | null>
  findActiveMembership(userId: string, organizationId?: string): Promise<ActiveMembership | null>
  isPlatformAdmin(userId: string): Promise<boolean>
}

export async function resolveTenantContext(
  token: string,
  requestId: string,
  repositories: TenantIdentityRepositories,
  organizationCandidate?: string,
): Promise<TenantContextData> {
  const session = await repositories.verifySession(token)
  const mapping = await repositories.findIdentityMapping(session.firebaseUid)
  if (!mapping?.active || session.userId !== undefined && session.userId !== mapping.userId) {
    throw new Error('TenantContext: identity mapping not found')
  }

  const membership = await repositories.findActiveMembership(mapping.userId, organizationCandidate)
  if (!membership?.active || !TENANT_ROLES.includes(membership.role as TenantRole)) {
    throw new Error('TenantContext: not found')
  }

  const isPlatformAdmin = await repositories.isPlatformAdmin(mapping.userId)
  return {
    userId: mapping.userId,
    organizationId: membership.organizationId,
    role: membership.role as TenantRole,
    isPlatformAdmin,
    requestId,
    authSource: 'firebase-session',
  }
}
