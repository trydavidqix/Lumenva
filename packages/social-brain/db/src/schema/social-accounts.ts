import { pgTable, uuid, text, timestamp, jsonb, unique } from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';

export const socialAccounts = pgTable('social_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  platform: text('platform').notNull(),
  externalAccountId: text('external_account_id'),
  brightbeanAccountId: text('brightbean_account_id').notNull(),
  displayName: text('display_name'),
  status: text('status').default('active').notNull(),
  metadata: jsonb('metadata').default('{}').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  unq: unique().on(t.workspaceId, t.platform, t.brightbeanAccountId)
}));
