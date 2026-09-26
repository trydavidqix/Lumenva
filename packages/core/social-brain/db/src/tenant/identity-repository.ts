import type { TenantIdentityRepositories, VerifiedFirebaseSession } from '@lumenva/core'
import type { NeonQuery } from '../neon/contract'

interface QueryExecutor {
  query<Row = Record<string, unknown>>(query: NeonQuery): Promise<readonly Row[]>
}

type SessionVerifier = (token: string) => Promise<VerifiedFirebaseSession>

export function createTenantIdentityRepositories(
  executor: QueryExecutor,
  verifySession: SessionVerifier,
): TenantIdentityRepositories {
  return {
    verifySession,
    async findIdentityMapping(firebaseUid) {
      const rows = await executor.query<{ user_id: string | null }>({
        text: 'select public.resolve_firebase_identity($1) as user_id',
        values: [firebaseUid],
      })
      const userId = rows[0]?.user_id
      return userId === null || userId === undefined ? null : { userId, active: true }
    },
    async findActiveMembership(userId, organizationId) {
      const query: NeonQuery = organizationId === undefined
        ? {
            text: 'select organization_id, role, true as active from public.user_organizations where user_id = $1 and accepted_at is not null and revoked_at is null order by created_at asc limit 1',
            values: [userId],
          }
        : {
            text: 'select organization_id, role, true as active from public.user_organizations where user_id = $1 and organization_id = $2 and accepted_at is not null and revoked_at is null limit 1',
            values: [userId, organizationId],
          }
      const rows = await executor.query<{ organization_id: string; role: string; active: boolean }>(query)
      const row = rows[0]
      return row === undefined
        ? null
        : { organizationId: row.organization_id, role: row.role, active: row.active }
    },
    async isPlatformAdmin(userId) {
      const rows = await executor.query({
        text: 'select 1 from public.platform_admins where user_id = $1 and revoked_at is null limit 1',
        values: [userId],
      })
      return rows.length > 0
    },
  }
}
