export type IngestConfig = {
  metaEnabled: boolean
}

export type WebhookEventPayload = {
  platform: 'instagram' | 'facebook' | string
  eventType: 'comment' | 'message' | 'reaction' | 'unknown' | string
  externalEventId: string
  accountExternalId?: string
  payload: Record<string, unknown>
}

export type IngestResult = {
  ok: boolean
  error?: string
  receipt?: string
}

export function createEventIngester(config: IngestConfig) {
  // Simple in-memory deduplication for now since durable idempotency isn't implemented
  const processedEvents = new Set<string>()

  return {
    ingest(event: WebhookEventPayload, workspaceId: string, internalAccountId: string): IngestResult {
      if (event.platform === 'instagram' || event.platform === 'facebook') {
        if (!config.metaEnabled) {
          return { ok: false, error: 'Provider disabled' }
        }
      }

      // Ensure robust cross-request deduplication via a compound key
      const dedupeKey = `${event.platform}:${event.accountExternalId || 'unknown'}:${event.externalEventId}`

      if (processedEvents.has(dedupeKey)) {
        return { ok: true, receipt: `dupe-${event.externalEventId}` }
      }

      processedEvents.add(dedupeKey)
      if (processedEvents.size > 10000) {
        const first = processedEvents.values().next().value
        if (first) {
            processedEvents.delete(first)
        }
      }

      // TODO: (Phase 16) Dispatch to actual queue or pipeline.
      // For now, we just validate, deduplicate, and return a receipt as instructed.

      return { ok: true, receipt: `receipt-${event.externalEventId}` }
    }
  }
}
