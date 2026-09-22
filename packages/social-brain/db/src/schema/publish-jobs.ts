import { pgTable, uuid, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { workspaces } from './workspaces';
import { contentItems } from './content-items';
import { contentVariants } from './content-variants';
import { socialAccounts } from './social-accounts';
import { approvals } from './approvals';

export const publishJobs = pgTable('publish_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  contentItemId: uuid('content_item_id').notNull().references(() => contentItems.id),
  contentVariantId: uuid('content_variant_id').notNull().references(() => contentVariants.id),
  socialAccountId: uuid('social_account_id').notNull().references(() => socialAccounts.id),
  approvalId: uuid('approval_id').notNull().references(() => approvals.id),
  platform: text('platform').notNull(),
  publishMode: text('publish_mode').notNull(),
  scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
  status: text('status').default('pending').notNull(),
  idempotencyKey: text('idempotency_key').notNull(),
  brightbeanPublicationId: text('brightbean_publication_id'),
  externalPostId: text('external_post_id'),
  externalUrl: text('external_url'),
  attemptCount: integer('attempt_count').default(0).notNull(),
  lastErrorCode: text('last_error_code'),
  lastErrorMessage: text('last_error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
});
