import { describe, expect, it, vi } from 'vitest'

import type { ContentItemInsert } from '../types'
import type { StoredContentItemRow } from './repository'

const videoBrief = {
  format: '9:16' as const,
  durationTargetSeconds: 35,
  visualDirection: 'Fast vertical cuts',
  voiceDirection: 'Clear and energetic',
}

describe('content repository', () => {
  it('maps content plans including video brief between domain and database shapes', async () => {
    const mod = await import('./repository').catch(() => null)
    expect(mod, 'content repository module must exist').not.toBeNull()
    if (!mod) return

    const rows = new Map<string, StoredContentItemRow>()
    const store = {
      insert: vi.fn(async (input: ContentItemInsert): Promise<StoredContentItemRow> => {
        const row: StoredContentItemRow = {
          id: 'content-1',
          workspace_id: input.workspace_id,
          topic: input.topic,
          objective: input.objective ?? null,
          hook: input.hook ?? null,
          script: input.script ?? null,
          video_brief: input.video_brief ?? null,
          status: input.status ?? 'DRAFT',
          created_at: '2026-08-17T15:20:00.000Z',
        }
        rows.set('content-1', row)
        return row
      }),
      update: vi.fn(
        async (id: string, patch: Partial<ContentItemInsert>): Promise<StoredContentItemRow> => {
          const current = rows.get(id)
          if (!current) throw new Error('content_not_found')
          const row: StoredContentItemRow = {
            ...current,
            workspace_id: patch.workspace_id ?? current.workspace_id,
            topic: patch.topic ?? current.topic,
            objective: patch.objective === undefined ? current.objective : patch.objective,
            hook: patch.hook === undefined ? current.hook : patch.hook,
            script: patch.script === undefined ? current.script : patch.script,
            video_brief: patch.video_brief === undefined ? current.video_brief : patch.video_brief,
            status: patch.status ?? current.status,
          }
          rows.set(id, row)
          return row
        },
      ),
      get: vi.fn(async (id: string): Promise<StoredContentItemRow | null> => rows.get(id) ?? null),
    }

    const repository = mod.createContentRepository(store)
    const created = await repository.createContentItem({
      workspaceId: 'workspace-1',
      objective: 'Teach hooks',
      topic: 'Hooks',
      hook: 'Start faster.',
      script: 'A short script.',
      videoBrief,
      status: 'DRAFT',
    })

    expect(store.insert).toHaveBeenCalledWith({
      workspace_id: 'workspace-1',
      objective: 'Teach hooks',
      topic: 'Hooks',
      hook: 'Start faster.',
      script: 'A short script.',
      video_brief: videoBrief,
      status: 'DRAFT',
    })
    expect(created).toMatchObject({
      id: 'content-1',
      workspaceId: 'workspace-1',
      videoBrief,
      status: 'DRAFT',
    })

    const updated = await repository.updateContentItem('content-1', {
      objective: 'Teach better hooks',
      topic: 'Hooks',
      hook: 'Start even faster.',
      script: 'An updated script.',
      videoBrief: { ...videoBrief, durationTargetSeconds: 40 },
    })

    expect(updated.objective).toBe('Teach better hooks')
    expect(updated.videoBrief?.durationTargetSeconds).toBe(40)
    await expect(repository.getContentItem('content-1')).resolves.toMatchObject({ id: 'content-1' })
  })
})
