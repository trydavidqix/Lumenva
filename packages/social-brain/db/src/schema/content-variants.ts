import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';
import { contentItems } from './content-items';

export const contentVariants = pgTable('content_variants', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  contentItemId: uuid('content_item_id').notNull().references(() => contentItems.id),
  platform: text('platform').notNull(),
  title: text('title'),
  caption: text('caption'),
  hashtags: text('hashtags').array().default([]).notNull(),
  metadata: jsonb('metadata').default('{}').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
