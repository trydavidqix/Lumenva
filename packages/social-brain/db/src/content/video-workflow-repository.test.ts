import { describe, expect, it, vi } from 'vitest'

import type { ContentItem } from '@lumenva/core'

const content: ContentItem = {
  id: 'content-1',
  workspaceId: 'workspace-1',
  topic: 'Hooks',
  objective: 'Teach hooks',
  hook: 'Start faster.',
  script: 'A short script.',
  videoBrief: {
    format: '9:16',
    durationTargetSeconds: 35,
    visualDirection: 'Fast cuts',
  },
  status: 'DRAFT',
  createdAt: '2026-08-17T15:00:00.000Z',
}

describe('video content workflow repository', () => {
  it('loads content and updates only its status', async () => {
    const mod = await import('./video-workflow-repository').catch(() => null)
    expect(mod, 'video workflow repository module must exist').not.toBeNull()
    if (!mod) return

    const store = {
      getContentItem: vi.fn(async () => ({ ...content })),
      updateStatus: vi.fn(async () => undefined),
    }
    const repository = mod.createVideoContentWorkflowRepository(store)

    await expect(repository.getContentItem('content-1')).resolves.toMatchObject({
      id: 'content-1',
      status: 'DRAFT',
      videoBrief: content.videoBrief,
    })
    await repository.setStatus('content-1', 'GENERATING')

    expect(store.updateStatus).toHaveBeenCalledWith('content-1', 'GENERATING')
  })
})
