import { describe, expect, it, vi } from 'vitest'

import type { MediaAssetInsert } from '../types'
import type { StoredMediaAssetRow } from './repository'

describe('media repository', () => {
  it('creates and resumes a generating provider asset, then marks it ready', async () => {
    const mod = await import('./repository').catch(() => null)
    expect(mod, 'media repository module must exist').not.toBeNull()
    if (!mod) return

    const rows = new Map<string, StoredMediaAssetRow>()
    const store = {
      findLatest: vi.fn(async (): Promise<StoredMediaAssetRow | null> => null),
      insert: vi.fn(async (input: MediaAssetInsert): Promise<StoredMediaAssetRow> => {
        const row: StoredMediaAssetRow = {
          id: input.id ?? 'asset-1',
          workspace_id: input.workspace_id,
          content_item_id: input.content_item_id ?? null,
          provider: input.provider,
          provider_asset_id: input.provider_asset_id ?? null,
          storage_bucket: input.storage_bucket ?? 'media',
          storage_path: input.storage_path ?? null,
          mime_type: input.mime_type ?? null,
          status: input.status ?? 'pending',
          metadata: input.metadata ?? {},
          created_at: '2026-08-17T15:00:00.000Z',
          updated_at: '2026-08-17T15:00:00.000Z',
        }
        rows.set(row.id, row)
        return row
      }),
      update: vi.fn(
        async (id: string, patch: Partial<MediaAssetInsert>): Promise<StoredMediaAssetRow> => {
          const current = rows.get(id)
          if (!current) throw new Error('media_not_found')
          const row: StoredMediaAssetRow = {
            ...current,
            workspace_id: patch.workspace_id ?? current.workspace_id,
            content_item_id:
              patch.content_item_id === undefined ? current.content_item_id : patch.content_item_id,
            provider: patch.provider ?? current.provider,
            provider_asset_id:
              patch.provider_asset_id === undefined ? current.provider_asset_id : patch.provider_asset_id,
            storage_bucket: patch.storage_bucket ?? current.storage_bucket,
            storage_path:
              patch.storage_path === undefined ? current.storage_path : patch.storage_path,
            mime_type: patch.mime_type === undefined ? current.mime_type : patch.mime_type,
            status: patch.status ?? current.status,
            metadata: patch.metadata === undefined ? current.metadata : patch.metadata,
          }
          rows.set(id, row)
          return row
        },
      ),
    }
    const repository = mod.createMediaRepository(store)

    const generating = await repository.createGenerating({
      id: 'asset-1',
      workspaceId: 'workspace-1',
      contentItemId: 'content-1',
      provider: 'moneyprinter',
      providerAssetId: 'mp-task-1',
    })

    expect(store.insert).toHaveBeenCalledWith({
      id: 'asset-1',
      workspace_id: 'workspace-1',
      content_item_id: 'content-1',
      provider: 'moneyprinter',
      provider_asset_id: 'mp-task-1',
      storage_bucket: 'media',
      storage_path: null,
      mime_type: null,
      status: 'generating',
      metadata: {},
    })
    expect(generating).toMatchObject({ providerAssetId: 'mp-task-1', status: 'generating' })

    await repository.markReady('asset-1', {
      storageBucket: 'media',
      storagePath: 'workspace/workspace-1/content/content-1/asset-1',
      mimeType: 'video/mp4',
      metadata: { sizeBytes: 1024 },
    })
    expect(store.update).toHaveBeenLastCalledWith('asset-1', {
      storage_bucket: 'media',
      storage_path: 'workspace/workspace-1/content/content-1/asset-1',
      mime_type: 'video/mp4',
      status: 'ready',
      metadata: { sizeBytes: 1024 },
    })
  })

  it('persists safe failure metadata and can map an existing asset', async () => {
    const mod = await import('./repository').catch(() => null)
    expect(mod, 'media repository module must exist').not.toBeNull()
    if (!mod) return

    const existing: StoredMediaAssetRow = {
      id: 'asset-1',
      workspace_id: 'workspace-1',
      content_item_id: 'content-1',
      provider: 'moneyprinter',
      provider_asset_id: 'mp-task-1',
      storage_bucket: 'media',
      storage_path: null,
      mime_type: null,
      status: 'generating',
      metadata: {},
      created_at: '2026-08-17T15:00:00.000Z',
      updated_at: '2026-08-17T15:00:00.000Z',
    }
    const store = {
      findLatest: vi.fn(async (): Promise<StoredMediaAssetRow | null> => existing),
      insert: vi.fn(async (): Promise<StoredMediaAssetRow> => existing),
      update: vi.fn(
        async (_id: string, patch: Partial<MediaAssetInsert>): Promise<StoredMediaAssetRow> => ({
          ...existing,
          status: patch.status ?? existing.status,
          metadata: patch.metadata === undefined ? existing.metadata : patch.metadata,
        }),
      ),
    }
    const repository = mod.createMediaRepository(store)

    await expect(repository.findForContent('content-1', 'moneyprinter')).resolves.toMatchObject({
      id: 'asset-1',
      providerAssetId: 'mp-task-1',
    })

    await repository.markFailed('asset-1', {
      code: 'moneyprinter_task_failed',
      message: 'generation failed',
    })
    expect(store.update).toHaveBeenLastCalledWith('asset-1', {
      status: 'failed',
      metadata: {
        error: { code: 'moneyprinter_task_failed', message: 'generation failed' },
      },
    })
  })
})
