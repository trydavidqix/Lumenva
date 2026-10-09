import { describe, expect, it } from 'vitest'
import { createEventIngester } from './event-ingester'

describe('Event Ingester', () => {
  it('rejects events for an inactive provider/capability', () => {
    const ingester = createEventIngester({ metaEnabled: false })
    const result = ingester.ingest({
      platform: 'instagram',
      eventType: 'comment',
      externalEventId: 'evt-1',
      accountExternalId: '123',
      payload: {},
    }, 'workspace-1', 'acc-123')

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/provider disabled/i)
  })

  it('deduplicates events by event ID', () => {
    const ingester = createEventIngester({ metaEnabled: true })
    const event = {
      platform: 'instagram' as const,
      eventType: 'comment' as const,
      externalEventId: 'evt-dupe',
      accountExternalId: '123',
      payload: {},
    }

    const res1 = ingester.ingest(event, 'workspace-1', 'acc-123')
    expect(res1.ok).toBe(true)

    const res2 = ingester.ingest(event, 'workspace-1', 'acc-123')
    expect(res2.ok).toBe(true)
    expect(res2.receipt).toBe(`dupe-evt-dupe`)
  })

  it('accepts a valid event and returns a receipt', () => {
    const ingester = createEventIngester({ metaEnabled: true })
    const result = ingester.ingest({
      platform: 'instagram',
      eventType: 'message',
      externalEventId: 'evt-valid',
      accountExternalId: '123',
      payload: { text: 'hello' },
    }, 'workspace-1', 'acc-123')

    expect(result.ok).toBe(true)
    expect(result.receipt).toBe('receipt-evt-valid')
  })
})
