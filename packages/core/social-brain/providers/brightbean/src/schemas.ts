import { z } from 'zod'

const uuid = z.string().uuid()
const nullableIso = z.string().nullable()

export const AccountSummarySchema = z.object({
  id: uuid,
  platform: z.string(),
  account_name: z.string(),
  account_handle: z.string(),
  connection_status: z.string(),
  char_limit: z.number().int(),
  escaped_chars: z.string(),
  needs_title: z.boolean(),
  supports_first_comment: z.boolean(),
})

export const AccountsListSchema = z.object({
  accounts: z.array(AccountSummarySchema),
})

export const DerivedMetricSchema = z.object({
  key: z.string(),
  label: z.string(),
  kind: z.string(),
  value: z.number(),
  delta: z.number(),
  series: z.array(z.number()),
})

export const EngagementCardSchema = z.object({
  rate: DerivedMetricSchema,
  parts: z.array(DerivedMetricSchema),
})

export const AccountAnalyticsSchema = z.object({
  account_id: uuid,
  platform: z.string(),
  account_name: z.string(),
  connection_status: z.string(),
  days: z.number().int().min(7).max(90),
  analytics_available: z.boolean(),
  unavailable_reason: z.string().nullable(),
  hero_metrics: z.array(DerivedMetricSchema),
  engagement: EngagementCardSchema.nullable(),
  follower_growth: DerivedMetricSchema.nullable(),
  captured_at: nullableIso,
  next_sync_eta: nullableIso,
})

export const PostMetricTileSchema = z.object({
  key: z.string(),
  label: z.string(),
  kind: z.string(),
  value: z.number(),
  series: z.array(z.number()),
  is_primary: z.boolean(),
})

export const PlatformPostAnalyticsSchema = z.object({
  platform_post_id: uuid,
  social_account_id: uuid,
  platform: z.string(),
  status: z.string(),
  published_at: nullableIso,
  analytics_available: z.boolean(),
  unavailable_reason: z.string().nullable(),
  metric_tiles: z.array(PostMetricTileSchema),
  captured_at: nullableIso,
  next_sync_eta: nullableIso,
})

export const PostAnalyticsSchema = z.object({
  post_id: uuid,
  workspace_id: uuid,
  title: z.string(),
  caption: z.string(),
  platform_posts: z.array(PlatformPostAnalyticsSchema),
})

export const PlatformPostSummarySchema = z.object({
  id: uuid,
  social_account_id: uuid,
  platform: z.string(),
  status: z.string(),
  scheduled_at: nullableIso,
  published_at: nullableIso,
  platform_post_id: z.string(),
  publish_error: z.string(),
})

export const PostResponseSchema = z.object({
  id: uuid,
  workspace_id: uuid,
  title: z.string(),
  caption: z.string(),
  first_comment: z.string(),
  internal_notes: z.string(),
  scheduled_at: nullableIso,
  published_at: nullableIso,
  proposed_publish_at: nullableIso,
  status: z.string(),
  platform_posts: z.array(PlatformPostSummarySchema),
  created_at: z.string(),
  updated_at: z.string(),
})

export const MediaAssetResponseSchema = z.object({
  id: uuid,
  organization_id: uuid.nullable(),
  workspace_id: uuid.nullable(),
  filename: z.string(),
  media_type: z.string(),
  mime_type: z.string(),
  file_size: z.number().int().nonnegative(),
  file_size_display: z.string(),
  width: z.number().int().nonnegative(),
  height: z.number().int().nonnegative(),
  aspect_ratio: z.number(),
  duration: z.number().nonnegative(),
  title: z.string(),
  alt_text: z.string(),
  tags: z.array(z.string()),
  folder_id: uuid.nullable(),
  is_starred: z.boolean(),
  is_shared: z.boolean(),
  processing_status: z.string(),
  url: z.string(),
  thumbnail_url: z.string().nullable(),
  last_used_at: nullableIso.optional(),
  created_at: z.string(),
  updated_at: z.string(),
})

export type BrightBeanAccountSummary = z.infer<typeof AccountSummarySchema>
export type BrightBeanDerivedMetric = z.infer<typeof DerivedMetricSchema>
export type BrightBeanPostMetricTile = z.infer<typeof PostMetricTileSchema>
export type BrightBeanMediaAssetResponse = z.infer<typeof MediaAssetResponseSchema>
