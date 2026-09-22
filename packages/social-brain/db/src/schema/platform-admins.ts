import { pgTable, uuid, text, timestamp, boolean, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const platformAdmins = pgTable('platform_admins', {
  userId: uuid('user_id').primaryKey(),
  grantedBy: uuid('granted_by').notNull(),
  grantedAt: timestamp('granted_at', { withTimezone: true }).defaultNow().notNull(),
  scope: text('scope').default('full').notNull(),
  mfaRequired: boolean('mfa_required').default(true).notNull(),
  reason: text('reason').notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedBy: uuid('revoked_by'),
  revokeReason: text('revoke_reason'),
}, (t) => ({
  scopeCheck: check('platform_admins_scope_check', sql`${t.scope} = ANY (ARRAY['full', 'support_readonly'])`)
}));
