import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';
import { contentItems } from './content-items';

export const mediaAssets = pgTable('media_assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  contentItemId: uuid('content_item_id').references(() => contentItems.id),
  provider: text('provider').notNull(),
  providerAssetId: text('provider_asset_id'),
  storageBucket: text('storage_bucket').notNull(),
  storagePath: text('storage_path'),
  mimeType: text('mime_type'),
  status: text('status').notNull(),
  metadata: jsonb('metadata').default('{}').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
