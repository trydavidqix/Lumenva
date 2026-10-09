import { describe, expect, it, vi } from 'vitest'
import { createEventIngester } from './event-ingester'

const mockCloudTasks = {
  enqueueTask: vi.fn(async () => 'task-receipt-123')
} as any

describe('Event Ingester', () => {
  it('rejects events for an inactive provider/capability', async () => {
    const ingester = createEventIngester({ metaEnabled: false }, mockCloudTasks)
    const result = await ingester.ingest({
      platform: 'instagram',
      eventType: 'comment',
      externalEventId: 'evt-1',
      accountExternalId: '123',
      payload: {},
    }, 'workspace-1', 'acc-123')

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/provider disabled/i)
  })

  it('accepts a valid event, enqueues it, and returns a receipt', async () => {
    mockCloudTasks.enqueueTask.mockClear()
    const ingester = createEventIngester({ metaEnabled: true }, mockCloudTasks)

    const result = await ingester.ingest({
      platform: 'instagram',
      eventType: 'message',
      externalEventId: 'evt-valid',
      accountExternalId: '123',
      payload: { text: 'hello' },
    }, 'workspace-1', 'acc-123')

    expect(result.ok).toBe(true)
    expect(result.receipt).toBe('task-receipt-123')
    expect(mockCloudTasks.enqueueTask).toHaveBeenCalledWith(
      '/api/workers/social/events',
      expect.objectContaining({
        eventId: 'evt-valid',
        workspaceId: 'workspace-1',
        accountId: 'acc-123',
      }),
      { queueName: 'social-events-queue' }
    )
  })
})
