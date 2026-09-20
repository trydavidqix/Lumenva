import type { PublicationJobRecord, PublicationJobStatus } from './publication-service'

export type PublishingProvider = {
  publish(job: PublicationJobRecord, idempotencyKey: string): Promise<{ success: boolean; externalId?: string; error?: string }>
}

export type EvidenceLogger = {
  log(event: string, payload: unknown): Promise<void>
}

export type PublishingManagerDeps = {
  provider: PublishingProvider
  evidence: EvidenceLogger
  updateJobStatus(jobId: string, status: PublicationJobStatus): Promise<void>
  getRetryCount(jobId: string): Promise<number>
}

export async function processPublishQueue(
  deps: PublishingManagerDeps,
  jobs: PublicationJobRecord[],
  maxRetries: number = 3
): Promise<void> {
  const processable = jobs.filter(
    (j) => j.status === 'queued' || j.status === 'scheduled' || j.status === 'retrying'
  )

  for (const job of processable) {
    try {
      // Call Meta/Provider passing the idempotency key for safe retries
      const result = await deps.provider.publish(job, job.idempotencyKey)
      
      if (result.success) {
        await deps.updateJobStatus(job.id, 'published')
        await deps.evidence.log('PUBLICATION_SUCCESS', {
          jobId: job.id,
          externalId: result.externalId
        })
      } else {
        throw new Error(result.error || 'Unknown publish error')
      }
    } catch (error) {
      // Handle automatic retries
      const retries = await deps.getRetryCount(job.id)
      
      if (retries < maxRetries) {
        await deps.updateJobStatus(job.id, 'retrying')
        await deps.evidence.log('PUBLICATION_RETRY_SCHEDULED', { jobId: job.id, error, attempt: retries + 1 })
      } else {
        await deps.updateJobStatus(job.id, 'failed')
        await deps.evidence.log('PUBLICATION_FAILED', { jobId: job.id, error, final: true })
      }
    }
  }
}
