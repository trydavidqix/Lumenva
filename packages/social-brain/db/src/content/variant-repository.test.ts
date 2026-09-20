import { describe, expect, it, vi } from 'vitest'

import type { ContentVariantInsert } from '../types'

const variants = [
  variant('instagram', 'Instagram'),
  variant('facebook', 'Facebook'),
  variant('tiktok', 'TikTok'),
  variant('youtube', 'YouTube', { contentType: 'shorts' }),
]

describe('content variant repository', () => {
  it('derives workspace from the content item and upserts by content/platform', async () => {
    const mod = await import('./variant-repository').catch(() => null)
    expect(mod, 'variant repository module must exist').not.toBeNull()
    if (!mod) return

    const store = {
      getWorkspaceId: vi.fn(async () => 'workspace-1'),
      upsert: vi.fn(async (rows: ContentVariantInsert[]) =>
        rows.map((row, index) => ({
          id: `variant-${index}`,
          workspace_id: row.workspace_id,
          content_item_id: row.content_item_id,
          platform: row.platform,
          title: row.title ?? null,
          caption: row.caption ?? null,
          hashtags: row.hashtags ?? [],
          metadata: row.metadata ?? {},
          created_at: '2026-08-17T15:30:00.000Z',
          updated_at: '2026-08-17T15:30:00.000Z',
        })),
      ),
      list: vi.fn(async () => []),
    }

    const repository = mod.createVariantRepository(store)
    const result = await repository.saveVariants('content-1', variants)

    expect(store.getWorkspaceId).toHaveBeenCalledWith('content-1')
    expect(store.upsert).toHaveBeenCalledWith(
      variants.map((input) => ({
        workspace_id: 'workspace-1',
        content_item_id: 'content-1',
        platform: input.platform,
        title: input.title,
        caption: input.caption,
        hashtags: input.hashtags,
        metadata: input.metadata,
      })),
      'content_item_id,platform',
    )
    expect(result.map((item: { platform: string }) => item.platform)).toEqual([
      'instagram',
      'facebook',
      'tiktok',
      'youtube',
    ])
  })

  it('updates one platform through the same deterministic conflict key', async () => {
    const mod = await import('./variant-repository').catch(() => null)
    expect(mod, 'variant repository module must exist').not.toBeNull()
    if (!mod) return

    const store = {
      getWorkspaceId: vi.fn(async () => 'workspace-1'),
      upsert: vi.fn(async (rows: ContentVariantInsert[]) =>
        rows.map((row) => ({
          id: 'variant-instagram',
          workspace_id: row.workspace_id,
          content_item_id: row.content_item_id,
          platform: row.platform,
          title: row.title ?? null,
          caption: row.caption ?? null,
          hashtags: row.hashtags ?? [],
          metadata: row.metadata ?? {},
          created_at: '2026-08-17T15:30:00.000Z',
          updated_at: '2026-08-17T15:30:00.000Z',
        })),
      ),
      list: vi.fn(async () => []),
    }

    const repository = mod.createVariantRepository(store)
    const updated = await repository.updateVariant('content-1', {
      ...variants[0]!,
      caption: 'Only Instagram changed',
    })

    expect(store.upsert).toHaveBeenCalledTimes(1)
    expect(store.upsert.mock.calls[0]?.[0]).toHaveLength(1)
    expect(updated.caption).toBe('Only Instagram changed')
  })

  it('refuses to persist variants for an unknown content item', async () => {
    const mod = await import('./variant-repository').catch(() => null)
    expect(mod, 'variant repository module must exist').not.toBeNull()
    if (!mod) return

    const repository = mod.createVariantRepository({
      getWorkspaceId: vi.fn(async () => null),
      upsert: vi.fn(async () => []),
      list: vi.fn(async () => []),
    })

    await expect(repository.saveVariants('missing', variants)).rejects.toMatchObject({
      code: 'content_not_found',
    })
  })
})

function variant(
  platform: 'instagram' | 'facebook' | 'tiktok' | 'youtube',
  caption: string,
  metadata: Record<string, unknown> = {},
) {
  return {
    platform,
    title: null,
    caption,
    hashtags: ['social'],
    metadata,
  }
}
