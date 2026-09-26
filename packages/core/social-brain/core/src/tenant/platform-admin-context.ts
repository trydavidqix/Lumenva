import { TenantContext, type TenantContextData } from './tenant-context'

export interface PlatformAdminAudit {
  readonly action: 'platform_admin.tenant_access'
  readonly userId: string
  readonly organizationId: string
  readonly requestId: string
}

export async function runPlatformAdminContext<Result>(
  context: TenantContextData,
  audit: (event: PlatformAdminAudit) => Promise<void>,
  callback: () => Promise<Result>,
): Promise<Result> {
  if (!context.isPlatformAdmin || context.authSource !== 'platform-admin') {
    throw new Error('TenantContext: explicit platform-admin context required')
  }
  await audit({
    action: 'platform_admin.tenant_access',
    userId: context.userId,
    organizationId: context.organizationId,
    requestId: context.requestId,
  })
  return TenantContext.run(context, callback)
}
