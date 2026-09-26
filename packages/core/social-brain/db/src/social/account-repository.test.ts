import { describe, expect, it } from 'vitest'

import type { SocialAccount } from '@lumenva/core'
import type { SocialAccountInsert, SocialAccountRow } from '../types'

const NOW = '2026-08-17T12:00:00.000Z'

function row(overrides: Partial<SocialAccountRow> & Pick<SocialAccountRow, 'id' | 'platform' | 'brightbean_account_id'>): SocialAccountRow {
  return {
    id: overrides.id,
    workspace_id: overrides.workspace_id ?? 'workspace-1',
    platform: overrides.platform,
    external_account_id: overrides.external_account_id ?? null,
    brightbean_account_id: overrides.brightbean_account_id,
    display_name: overrides.display_name ?? null,
    status: overrides.status ?? 'active',
    metadata: overrides.metadata ?? {},
    created_at: overrides.created_at ?? NOW,
    updated_at: overrides.updated_at ?? NOW,
  }
}

describe('social account repository', () => {
  it('upserts by workspace/platform/BrightBean id and disables stale accounts without deleting them', async () => {
    const mod = await import('./account-repository').catch(() => null)
    expect(mod, 'social account repository module must exist').not.toBeNull()
    if (!mod) return

    const state: SocialAccountRow[] = [
      row({
        id: 'local-ig',
        platform: 'instagram',
        brightbean_account_id: 'ig-1',
        display_name: 'Old IG name',
      }),
      row({
        id: 'local-fb',
        platform: 'facebook',
        brightbean_account_id: 'fb-stale',
        display_name: 'Old Facebook',
      }),
    ]
    let conflictTarget = ''
    let lastUpserts: SocialAccountInsert[] = []

    const store = {
      async list(workspaceId: string) {
        return state.filter((account) => account.workspace_id === workspaceId).map((account) => ({ ...account }))
      },
      async upsert(rows: SocialAccountInsert[], onConflict: string) {
        conflictTarget = onConflict
        lastUpserts = rows.map((item) => ({ ...item }))
        for (const input of rows) {
          const existing = state.find(
            (account) =>
              account.workspace_id === input.workspace_id &&
              account.platform === input.platform &&
              account.brightbean_account_id === input.brightbean_account_id,
          )
          if (existing) {
            existing.external_account_id = input.external_account_id ?? null
            existing.display_name = input.display_name ?? null
            existing.status = input.status ?? existing.status
            existing.metadata = input.metadata ?? existing.metadata
            existing.updated_at = input.updated_at ?? existing.updated_at
          } else {
            state.push(
              row({
                id: `local-${state.length + 1}`,
                workspace_id: input.workspace_id,
                platform: input.platform,
                brightbean_account_id: input.brightbean_account_id,
                external_account_id: input.external_account_id ?? null,
                display_name: input.display_name ?? null,
                status: input.status ?? 'active',
                metadata: input.metadata ?? {},
                updated_at: input.updated_at ?? NOW,
              }),
            )
          }
        }
      },
      async disable(ids: string[], updatedAt: string) {
        for (const account of state) {
          if (ids.includes(account.id)) {
            account.status = 'disabled'
            account.updated_at = updatedAt
          }
        }
      },
    }

    const repository = mod.createSocialAccountRepository(store, () => new Date(NOW))
    const incoming: Array<SocialAccount & { oauthToken?: string }> = [
      {
        provider: 'brightbean',
        providerAccountId: 'ig-1',
        externalAccountId: null,
        platform: 'instagram',
        displayName: 'New IG name',
        status: 'active',
        oauthToken: 'must-never-persist',
      },
      {
        provider: 'brightbean',
        providerAccountId: 'tt-1',
        externalAccountId: null,
        platform: 'tiktok',
        displayName: 'TikTok',
        status: 'active',
      },
    ]

    await repository.syncAccounts('workspace-1', incoming)
    await repository.syncAccounts('workspace-1', incoming)

    expect(conflictTarget).toBe('workspace_id,platform,brightbean_account_id')
    expect(state).toHaveLength(3)
    expect(state.find((account) => account.id === 'local-ig')).toMatchObject({
      display_name: 'New IG name',
      status: 'active',
    })
    expect(state.find((account) => account.id === 'local-fb')).toMatchObject({ status: 'disabled' })
    expect(state.find((account) => account.brightbean_account_id === 'tt-1')).toMatchObject({ status: 'active' })
    expect(JSON.stringify(lastUpserts)).not.toContain('must-never-persist')
  })
})
