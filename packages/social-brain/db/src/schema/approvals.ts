import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';
import { contentItems } from './content-items';

export const approvals = pgTable('approvals', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  contentItemId: uuid('content_item_id').notNull().references(() => contentItems.id),
  decision: text('decision').notNull(),
  reason: text('reason'),
  reviewSnapshotJson: jsonb('review_snapshot_json').notNull(),
  snapshotHash: text('snapshot_hash').notNull(),
  publishMode: text('publish_mode').notNull(),
  decidedBy: text('decided_by').notNull(),
  decidedAt: timestamp('decided_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
