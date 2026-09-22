import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';

export const contentItems = pgTable('content_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  topic: text('topic').notNull(),
  objective: text('objective'),
  hook: text('hook'),
  script: text('script'),
  videoBrief: jsonb('video_brief'),
  status: text('status').notNull(),
  proposedPublishMode: text('proposed_publish_mode'),
  proposedScheduledFor: text('proposed_scheduled_for'),
  scheduleRationale: text('schedule_rationale'),
  reviewSnapshotJson: jsonb('review_snapshot_json'),
  reviewSnapshotHash: text('review_snapshot_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
