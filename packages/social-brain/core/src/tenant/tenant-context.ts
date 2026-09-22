import { AsyncLocalStorage } from 'node:async_hooks'

export const TENANT_ROLES = ['viewer', 'agent', 'ai_operator', 'manager', 'admin'] as const
export type TenantRole = (typeof TENANT_ROLES)[number]
export type TenantAuthSource = 'firebase-session' | 'firebase-worker' | 'platform-admin'

export interface TenantContextData {
  userId: string
  organizationId: string
  role: TenantRole
  isPlatformAdmin: boolean
  requestId: string
  authSource: TenantAuthSource
}

const tenantStorage = new AsyncLocalStorage<TenantContextData>()

export class TenantContext {
  static run<R>(data: TenantContextData, callback: () => R): R {
    assertTenantContext(data)
    return tenantStorage.run(data, callback)
  }

  static current(): TenantContextData {
    const data = tenantStorage.getStore()
    if (!data) throw new Error('TenantContext: missing validated context')
    return data
  }

  static currentOptional(): TenantContextData | undefined {
    return tenantStorage.getStore()
  }
}

export function assertTenantContext(data: TenantContextData): void {
  if (!data.userId.trim() || !data.organizationId.trim() || !data.requestId.trim()) {
    throw new Error('TenantContext: invalid validated context')
  }
  if (!TENANT_ROLES.includes(data.role)) throw new Error('TenantContext: invalid role')
}
