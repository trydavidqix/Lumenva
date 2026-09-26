import {
  createAnalyticsContextService,
  createAnalyticsInsightsService,
  createApprovalService,
  createContentService,
  createPublicationService,
  createScheduleService,
  createVariantService,
  type AnalyticsContextService,
  type AnalyticsInsightsService,
  type ApprovalService,
  type ContentService,
  type PublicationService,
  type ScheduleService,
  type VariantService,
} from '@lumenva/core'
import { createAnalyticsQueryRepository, createSupabaseAnalyticsQueryStore } from '@lumenva/db/analytics/queries'
import { createApprovalRepository, createSupabaseApprovalStore } from '@lumenva/db/approval'
import { createAuditRepository, type AuditRepository } from '@lumenva/db/audit'
import { createContentRepository, createSupabaseContentItemStore } from '@lumenva/db/content'
import { createVariantRepository, createSupabaseContentVariantStore } from '@lumenva/db/content/variants'
import { createBackgroundJobRepository, createSupabaseBackgroundJobStore, type BackgroundJobRepository } from '@lumenva/db/jobs'
import { createPublicationRepository, createSupabasePublicationStore } from '@lumenva/db/publishing'
import { createScheduleRepository, createSupabaseScheduleStore } from '@lumenva/db/scheduling'
import { createSocialAccountRepository, createSupabaseSocialAccountStore, type SocialAccountRepository } from '@lumenva/db/social'
import type { Database } from '@lumenva/db/types'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type McpApplicationContext = {
  workspaceId: string
  ownerUserId: string
  supabase: SupabaseClient<Database>
  accounts: SocialAccountRepository
  analytics: AnalyticsContextService
  analyticsInsights: AnalyticsInsightsService
  content: ContentService
  variants: VariantService
  scheduling: ScheduleService
  approval: ApprovalService
  publication: PublicationService
  backgroundJobs: BackgroundJobRepository
  audit: AuditRepository
}

export async function createMcpApplicationContext(env: NodeJS.ProcessEnv = process.env): Promise<McpApplicationContext> {
  const url = requireEnv(env, 'NEXT_PUBLIC_SUPABASE_URL')
  const serviceRoleKey = requireEnv(env, 'SUPABASE_SERVICE_ROLE_KEY')
  const supabase = createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabase
    .from('workspaces')
    .select('id,owner_user_id')
    .order('created_at', { ascending: true })
    .limit(2)

  if (error) throw new Error('Failed to resolve MCP owner workspace')
  if (!data || data.length !== 1) throw new Error('V1 MCP requires exactly one owner workspace')
  const workspace = data[0]!

  const backgroundJobs = createBackgroundJobRepository(createSupabaseBackgroundJobStore(supabase))
  const approval = createApprovalService(createApprovalRepository(createSupabaseApprovalStore(supabase)))
  const publicationRepository = createPublicationRepository(createSupabasePublicationStore(supabase))
  const analyticsRepository = createAnalyticsQueryRepository(createSupabaseAnalyticsQueryStore(supabase))

  return {
    workspaceId: workspace.id,
    ownerUserId: workspace.owner_user_id,
    supabase,
    accounts: createSocialAccountRepository(createSupabaseSocialAccountStore(supabase)),
    analytics: createAnalyticsContextService(analyticsRepository),
    analyticsInsights: createAnalyticsInsightsService(analyticsRepository),
    content: createContentService(createContentRepository(createSupabaseContentItemStore(supabase))),
    variants: createVariantService(createVariantRepository(createSupabaseContentVariantStore(supabase))),
    scheduling: createScheduleService(createScheduleRepository(createSupabaseScheduleStore(supabase))),
    approval,
    publication: createPublicationService({
      repository: publicationRepository,
      assertCurrentApproval: (contentItemId) => approval.assertCurrentApproval(contentItemId),
      enqueuePublishJob: async (job) => {
        await backgroundJobs.enqueueJob({
          workspaceId: job.workspaceId,
          jobType: 'publish.execute',
          payload: { publishJobId: job.id },
          maxAttempts: 3,
        })
      },
    }),
    backgroundJobs,
    audit: createAuditRepository(supabase),
  }
}

function requireEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]
  if (!value) throw new Error(`${name} is required for MCP runtime`)
  return value
}
