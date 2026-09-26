import type { McpServer } from '@modelcontextprotocol/server'
import * as z from 'zod/v4'

import type { McpApplicationContext } from '../context'
import { runInstrumentedTool } from '../instrumentation/tool-run'
import { toolResult } from './result'

const VideoBriefSchema = z.object({
  format: z.literal('9:16'),
  durationTargetSeconds: z.number().int().positive(),
  visualDirection: z.string().trim().min(1),
  voiceDirection: z.string().trim().min(1).optional(),
}).strict()

const VariantSchema = z.object({
  platform: z.enum(['instagram', 'facebook', 'tiktok', 'youtube']),
  title: z.string().trim().min(1).nullable(),
  caption: z.string().trim().min(1),
  hashtags: z.array(z.string().trim().min(1)),
  metadata: z.record(z.string(), z.unknown()),
}).strict()

export function registerContentTools(server: McpServer, context: McpApplicationContext): void {
  server.registerTool(
    'social.content.create_plan',
    {
      description: 'Create a draft content plan in the owner workspace.',
      inputSchema: z.object({
        objective: z.string().trim().min(1),
        topic: z.string().trim().min(1),
        hook: z.string().trim().min(1),
        script: z.string().trim().min(1),
        videoBrief: VideoBriefSchema,
      }).strict(),
    },
    async (input) => toolResult(await runInstrumentedTool(context, 'social.content.create_plan', input, async () => {
      const item = await context.content.createContentPlan(context.workspaceId, input)
      return { id: item.id, status: item.status, topic: item.topic }
    })),
  )

  server.registerTool(
    'social.content.create_variants',
    {
      description: 'Persist exactly one variant for Instagram, Facebook, TikTok, and YouTube Shorts.',
      inputSchema: z.object({ contentId: z.string().uuid(), variants: z.array(VariantSchema).length(4) }).strict(),
    },
    async ({ contentId, variants }) => toolResult(await runInstrumentedTool(
      context,
      'social.content.create_variants',
      { contentId, variants },
      async () => context.variants.savePlatformVariants(contentId, variants),
    )),
  )

  server.registerTool(
    'social.approval.request',
    {
      description: 'Request human review for an exact snapshot. This tool cannot approve content.',
      inputSchema: z.object({ contentId: z.string().uuid() }).strict(),
    },
    async ({ contentId }) => toolResult(await runInstrumentedTool(context, 'social.approval.request', { contentId }, async () => {
      const pending = await context.approval.requestApproval(contentId)
      return {
        contentId,
        snapshotHash: pending.snapshotHash,
        status: 'PENDING_APPROVAL',
        reviewPath: `/approvals/${contentId}`,
        humanApprovalRequired: true,
      }
    })),
  )

  server.registerTool(
    'social.approval.status',
    {
      description: 'Read local approval state and snapshot identity. Read only.',
      inputSchema: z.object({ contentId: z.string().uuid() }).strict(),
      annotations: { readOnlyHint: true },
    },
    async ({ contentId }) => toolResult(await runInstrumentedTool(context, 'social.approval.status', { contentId }, async () => {
      const { data, error } = await context.supabase
        .from('content_items')
        .select('id,status,review_snapshot_hash,proposed_publish_mode,proposed_scheduled_for')
        .eq('workspace_id', context.workspaceId)
        .eq('id', contentId)
        .maybeSingle()
      if (error) throw new Error('Failed to load approval status')
      return data
    })),
  )

  server.registerTool(
    'social.schedule.propose',
    {
      description: 'Store a proposed publication time. Changing schedule invalidates any current approval.',
      inputSchema: z.object({
        contentId: z.string().uuid(),
        proposedFor: z.string().datetime({ offset: true }),
        rationale: z.string(),
      }).strict(),
    },
    async ({ contentId, proposedFor, rationale }) => toolResult(await runInstrumentedTool(
      context,
      'social.schedule.propose',
      { contentId, proposedFor, rationale },
      async () => context.scheduling.proposeSchedule(contentId, proposedFor, rationale),
    )),
  )
}
