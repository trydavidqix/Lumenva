import type { SocialAccount, SocialPlatform, StoredSocialAccount } from '@lumenva/core'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database, SocialAccountInsert, SocialAccountRow } from '../types'

export const SOCIAL_ACCOUNT_CONFLICT = 'workspace_id,platform,brightbean_account_id'

export type SocialAccountStore = {
  list(workspaceId: string): Promise<SocialAccountRow[]>
  upsert(rows: SocialAccountInsert[], onConflict: string): Promise<void>
  disable(ids: string[], updatedAt: string): Promise<void>
}

export type SocialAccountRepository = {
  syncAccounts(workspaceId: string, accounts: SocialAccount[]): Promise<StoredSocialAccount[]>
  listAccounts(workspaceId: string): Promise<StoredSocialAccount[]>
}

export function createSupabaseSocialConnectionRepository(
  client: SupabaseClient<Database>,
) {
  return {
    async upsertConnection(input: {
      workspaceId: string
      provider: string
      platform: string
      providerAccountId: string
      externalAccountId: string
      status: string
      tokenExpiresAt: Date | null
      scopes: string[]
      accessToken: string
      refreshToken: string | null
    }) {
      const { error } = await client.from('social_connections').upsert({
        workspace_id: input.workspaceId,
        provider: input.provider,
        platform: input.platform,
        provider_account_id: input.providerAccountId,
        external_account_id: input.externalAccountId,
        status: input.status,
        token_expires_at: input.tokenExpiresAt?.toISOString() ?? null,
        scopes: input.scopes,
        access_token: input.accessToken,
        refresh_token: input.refreshToken,
      } as never)

      if (error) throw new Error('Failed to upsert social connection')
    },
  }
}

export function createSocialAccountRepository(
  store: SocialAccountStore,
  now: () => Date = () => new Date(),
): SocialAccountRepository {
  return {
    async syncAccounts(workspaceId, accounts) {
      const existing = await store.list(workspaceId)
      const updatedAt = now().toISOString()
      const rows = accounts.map((account): SocialAccountInsert => ({
        workspace_id: workspaceId,
        platform: account.platform,
        external_account_id: account.externalAccountId,
        brightbean_account_id: account.providerAccountId,
        display_name: account.displayName,
        status: account.status,
        metadata: { provider: account.provider },
        updated_at: updatedAt,
      }))

      if (rows.length > 0) {
        await store.upsert(rows, SOCIAL_ACCOUNT_CONFLICT)
      }

      const activeKeys = new Set(
        accounts.map((account) => accountKey(account.platform, account.providerAccountId)),
      )
      const staleIds = existing
        .filter(
          (account) =>
            account.status !== 'disabled' &&
            !activeKeys.has(accountKey(account.platform as SocialPlatform, account.brightbean_account_id)),
        )
        .map((account) => account.id)

      if (staleIds.length > 0) {
        await store.disable(staleIds, updatedAt)
      }

      return mapRows(await store.list(workspaceId))
    },

    async listAccounts(workspaceId) {
      return mapRows(await store.list(workspaceId))
    },
  }
}

export function createSupabaseSocialAccountStore(
  client: SupabaseClient<Database>,
): SocialAccountStore {
  return {
    async list(workspaceId) {
      const { data, error } = await client
        .from('social_accounts')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('platform', { ascending: true })

      if (error) throw new Error('Failed to list social account mappings')
      return data ?? []
    },

    async upsert(rows, onConflict) {
      const { error } = await client
        .from('social_accounts')
        .upsert(rows, { onConflict })

      if (error) throw new Error('Failed to upsert social account mappings')
    },

    async disable(ids, updatedAt) {
      if (ids.length === 0) return
      const { error } = await client
        .from('social_accounts')
        .update({ status: 'disabled', updated_at: updatedAt })
        .in('id', ids)

      if (error) throw new Error('Failed to disable stale social account mappings')
    },
  }
}

import { db } from '../client/drizzle'
import { socialAccounts } from '../schema/social-accounts'
import { eq, inArray, sql } from 'drizzle-orm'
import type { Json } from '../types'

export function createDrizzleSocialAccountStore(): SocialAccountStore {
  return {
    async list(workspaceId) {
      const data = await db
        .select()
        .from(socialAccounts)
        .where(eq(socialAccounts.workspaceId, workspaceId))
        .orderBy(socialAccounts.platform)

      return data.map(row => ({
        ...row,
        workspace_id: row.workspaceId,
        external_account_id: row.externalAccountId,
        brightbean_account_id: row.brightbeanAccountId,
        display_name: row.displayName,
        metadata: row.metadata as Json,
        created_at: row.createdAt.toISOString(),
        updated_at: row.updatedAt.toISOString(),
      }))
    },

    async upsert(rows, onConflict) {
      for (const row of rows) {
        await db
          .insert(socialAccounts)
          .values({
            workspaceId: row.workspace_id,
            platform: row.platform,
            externalAccountId: row.external_account_id,
            brightbeanAccountId: row.brightbean_account_id,
            displayName: row.display_name,
            status: row.status,
            metadata: row.metadata,
          })
          .onConflictDoUpdate({
            target: [socialAccounts.workspaceId, socialAccounts.platform, socialAccounts.brightbeanAccountId],
            set: {
              externalAccountId: row.external_account_id,
              displayName: row.display_name,
              status: row.status,
              metadata: row.metadata,
              updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
            }
          })
      }
    },

    async disable(ids, updatedAt) {
      if (ids.length === 0) return
      await db
        .update(socialAccounts)
        .set({ status: 'disabled', updatedAt: new Date(updatedAt) })
        .where(inArray(socialAccounts.id, ids))
    },
  }
}

function mapRows(rows: SocialAccountRow[]): StoredSocialAccount[] {
  return rows.map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    provider: providerFromMetadata(row.metadata),
    providerAccountId: row.brightbean_account_id,
    externalAccountId: row.external_account_id,
    platform: row.platform as SocialPlatform,
    displayName: row.display_name,
    status: row.status === 'active' ? 'active' : 'disabled',
  }))
}

function providerFromMetadata(metadata: SocialAccountRow['metadata']): string {
  if (metadata && !Array.isArray(metadata) && typeof metadata === 'object') {
    const provider = metadata.provider
    if (typeof provider === 'string' && provider.length > 0) return provider
  }
  return 'brightbean'
}

function accountKey(platform: SocialPlatform, providerAccountId: string): string {
  return `${platform}:${providerAccountId}`
}
