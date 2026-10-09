import type { CloudTasksClient } from '../../cloud-tasks'

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

export function createEventIngester(config: IngestConfig, cloudTasks: CloudTasksClient) {
  return {
    async ingest(event: WebhookEventPayload, workspaceId: string, internalAccountId: string): Promise<IngestResult> {
      if (event.platform === 'instagram' || event.platform === 'facebook') {
        if (!config.metaEnabled) {
          return { ok: false, error: 'Provider disabled' }
        }
      }

      // Enqueue to existing job/event contract (Cloud Tasks)
      // Deduplication is handled by Cloud Tasks if we pass a deterministic task name,
      // but without the exact real SDK we simulate the contract call here.
      const dedupeKey = `${event.platform}-${event.accountExternalId || 'unknown'}-${event.externalEventId}`

      const receipt = await cloudTasks.enqueueTask(
        '/api/workers/social/events',
        {
          eventId: event.externalEventId,
          workspaceId,
          accountId: internalAccountId,
          platform: event.platform,
          eventType: event.eventType,
          payload: event.payload
        },
        { queueName: 'social-events-queue' }
      )

      return { ok: true, receipt }
    }
  }
}
