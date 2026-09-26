import { describe, expect, it, vi } from 'vitest'

import type { CreateContentItemInput, UpdateContentItemInput } from './content-service'
import type { ContentItem } from './types'

const validPlan = {
  objective: 'Explain why consistent hooks improve retention',
  topic: 'Social video hooks',
  hook: 'Your first two seconds decide whether people stay.',
  script: 'Open with the result, prove it quickly, then close with one action.',
  videoBrief: {
    format: '9:16' as const,
    durationTargetSeconds: 35,
    visualDirection: 'Fast vertical cuts with large captions',
    voiceDirection: 'Clear and energetic',
  },
}

describe('content plan and service', () => {
  it('requires objective, topic, hook, script and a valid 9:16 video brief', async () => {
    const mod = await import('./plan-schema').catch(() => null)
    expect(mod, 'content plan schema module must exist').not.toBeNull()
    if (!mod) return

    expect(mod.ContentPlanSchema.parse(validPlan)).toEqual(validPlan)
    expect(() => mod.ContentPlanSchema.parse({ topic: 'Only a topic' })).toThrow()
    expect(() =>
      mod.ContentPlanSchema.parse({
        ...validPlan,
        videoBrief: { ...validPlan.videoBrief, format: '16:9' },
      }),
    ).toThrow()
    expect(() =>
      mod.ContentPlanSchema.parse({
        ...validPlan,
        videoBrief: { ...validPlan.videoBrief, durationTargetSeconds: 0 },
      }),
    ).toThrow()
  })

  it('persists a validated plan as DRAFT and round-trips the video brief', async () => {
    const mod = await import('./content-service').catch(() => null)
    expect(mod, 'content service module must exist').not.toBeNull()
    if (!mod) return

    const stored = new Map<string, ContentItem>()
    const repository = {
      createContentItem: vi.fn(async (input: CreateContentItemInput): Promise<ContentItem> => {
        const row: ContentItem = {
          id: 'content-1',
          workspaceId: input.workspaceId,
          objective: input.objective,
          topic: input.topic,
          hook: input.hook,
          script: input.script,
          videoBrief: input.videoBrief,
          status: input.status,
          createdAt: '2026-08-17T15:20:00.000Z',
        }
        stored.set('content-1', row)
        return row
      }),
      updateContentItem: vi.fn(
        async (id: string, input: UpdateContentItemInput): Promise<ContentItem> => {
          const current = stored.get(id)
          if (!current) throw new Error('content_not_found')
          const row: ContentItem = { ...current, ...input }
          stored.set(id, row)
          return row
        },
      ),
      getContentItem: vi.fn(async (id: string): Promise<ContentItem | null> => stored.get(id) ?? null),
    }

    const service = mod.createContentService(repository)
    const created = await service.createContentPlan('workspace-1', validPlan)

    expect(repository.createContentItem).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      ...validPlan,
      status: 'DRAFT',
    })
    expect(created).toMatchObject({
      id: 'content-1',
      workspaceId: 'workspace-1',
      status: 'DRAFT',
      videoBrief: validPlan.videoBrief,
    })
    await expect(service.getContentItem('content-1')).resolves.toMatchObject({
      videoBrief: validPlan.videoBrief,
    })
  })

  it('updates only DRAFT content and re-validates the full plan', async () => {
    const mod = await import('./content-service').catch(() => null)
    expect(mod, 'content service module must exist').not.toBeNull()
    if (!mod) return

    let current: ContentItem = {
      id: 'content-1',
      workspaceId: 'workspace-1',
      ...validPlan,
      status: 'DRAFT',
      createdAt: '2026-08-17T15:20:00.000Z',
    }
    const repository = {
      createContentItem: vi.fn(async (_input: CreateContentItemInput): Promise<ContentItem> => current),
      updateContentItem: vi.fn(
        async (_id: string, input: UpdateContentItemInput): Promise<ContentItem> => {
          current = { ...current, ...input }
          return current
        },
      ),
      getContentItem: vi.fn(async (): Promise<ContentItem | null> => current),
    }
    const service = mod.createContentService(repository)

    const updated = await service.updateDraftContent('content-1', {
      ...validPlan,
      hook: 'A stronger hook.',
    })
    expect(updated.hook).toBe('A stronger hook.')

    current = { ...current, status: 'READY_FOR_REVIEW' }
    await expect(service.updateDraftContent('content-1', validPlan)).rejects.toMatchObject({
      code: 'content_not_editable',
    })

    current = { ...current, status: 'DRAFT' }
    await expect(
      service.updateDraftContent('content-1', {
        ...validPlan,
        script: '',
      }),
    ).rejects.toBeDefined()
  })
})
