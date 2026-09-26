import type { SocialPlatform } from '@lumenva/core'

import { createSupabaseServerClient } from '../supabase/server'

export type PublishingStatusItem = {
  id: string
  contentItemId: string
  topic: string
  platform: SocialPlatform
  accountName: string | null
  status: string
  publishMode: 'schedule' | 'now'
  scheduledFor: string | null
  publishedAt: string | null
  attemptCount: number
  externalPostId: string | null
  externalUrl: string | null
  errorCode: string | null
  errorSummary: string | null
  retryEligible: boolean
}

export async function listPublishingStatus(workspaceId: string): Promise<PublishingStatusItem[]> {
  const supabase = await createSupabaseServerClient()
  const client = supabase as any

  const { data: jobs, error } = await client
    .from('publish_jobs')
    .select(
      'id,content_item_id,social_account_id,platform,publish_mode,scheduled_for,status,external_post_id,external_url,attempt_count,last_error_code,published_at,updated_at',
    )
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false })
    .limit(100)

  if (error) throw new Error('Failed to load publishing status')
  if (!jobs?.length) return []

  const contentIds = [...new Set(jobs.map((job: any) => job.content_item_id))]
  const accountIds = [...new Set(jobs.map((job: any) => job.social_account_id))]

  const [{ data: content, error: contentError }, { data: accounts, error: accountError }] = await Promise.all([
    client
      .from('content_items')
      .select('id,topic')
      .eq('workspace_id', workspaceId)
      .in('id', contentIds),
    client
      .from('social_accounts')
      .select('id,display_name')
      .eq('workspace_id', workspaceId)
      .in('id', accountIds),
  ])

  if (contentError || accountError) throw new Error('Failed to load publishing status context')

  const topicById = new Map((content ?? []).map((row: any) => [row.id, row.topic]))
  const accountById = new Map((accounts ?? []).map((row: any) => [row.id, row.display_name]))

  return jobs.map((job: any) => ({
    id: job.id,
    contentItemId: job.content_item_id,
    topic: String(topicById.get(job.content_item_id) ?? 'Conteúdo'),
    platform: job.platform as SocialPlatform,
    accountName: (accountById.get(job.social_account_id) as string | null | undefined) ?? null,
    status: job.status,
    publishMode: job.publish_mode as 'schedule' | 'now',
    scheduledFor: job.scheduled_for,
    publishedAt: job.published_at,
    attemptCount: Number(job.attempt_count ?? 0),
    externalPostId: job.external_post_id,
    externalUrl: job.external_url,
    errorCode: job.last_error_code,
    errorSummary: safeErrorSummary(job.last_error_code),
    retryEligible: job.status === 'failed',
  }))
}

function safeErrorSummary(code: string | null): string | null {
  switch (code) {
    case null:
      return null
    case 'approval_stale':
    case 'approval_required':
      return 'A aprovação já não corresponde ao conteúdo atual.'
    case 'rate_limited':
      return 'O serviço de publicação pediu para tentar novamente mais tarde.'
    case 'upstream_error':
    case 'network_error':
      return 'O serviço de publicação teve uma falha temporária.'
    case 'timeout':
    case 'publication_still_unknown':
      return 'O resultado remoto ainda está a ser reconciliado.'
    case 'publication_failed':
      return 'A rede social não concluiu esta publicação.'
    case 'brightbean_media_processing_failed':
      return 'O vídeo não pôde ser preparado para esta rede.'
    default:
      return 'Esta publicação precisa de atenção antes de continuar.'
  }
}
