import { createApprovalService, createPublicationService } from '@lumenva/core'
import {
  createApprovalRepository,
  createSupabaseApprovalStore,
} from '@lumenva/db/approval'
import { createAuditRepository } from '@lumenva/db/audit'
import {
  createBackgroundJobRepository,
  createSupabaseBackgroundJobStore,
} from '@lumenva/db/jobs'
import {
  createPublicationRepository,
  createSupabasePublicationStore,
} from '@lumenva/db/publishing'

import { createSupabaseServerClient } from '../supabase/server'
import { createSupabaseServiceRoleClient } from '../supabase/service-role'

export async function createSupabasePublishingRuntime() {
  const ownerSupabase = await createSupabaseServerClient()
  const serviceSupabase = createSupabaseServiceRoleClient()
  const approvalService = createApprovalService(
    createApprovalRepository(createSupabaseApprovalStore(ownerSupabase as never)),
  )
  const publicationRepository = createPublicationRepository(
    createSupabasePublicationStore(serviceSupabase),
  )
  const backgroundJobs = createBackgroundJobRepository(
    createSupabaseBackgroundJobStore(serviceSupabase),
  )
  const audit = createAuditRepository(serviceSupabase)

  const publicationService = createPublicationService({
    repository: publicationRepository,
    assertCurrentApproval: approvalService.assertCurrentApproval,
    enqueuePublishJob: async (job) => {
      await backgroundJobs.enqueueJob({
        workspaceId: job.workspaceId,
        jobType: 'publish.execute',
        payload: { publishJobId: job.id },
        maxAttempts: 3,
      })
    },
  })

  return {
    publicationRepository,
    publicationService,
    backgroundJobs,
    async recordRetry(owner: { userId: string; workspaceId: string }, publishJobId: string) {
      await audit.appendEvent({
        workspaceId: owner.workspaceId,
        actorUserId: owner.userId,
        eventType: 'publication.retry_requested',
        entityType: 'publish_job',
        entityId: publishJobId,
        correlationId: crypto.randomUUID(),
        metadata: {},
      })
    },
  }
}
