import { pgTable, uuid, text, timestamp, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const userOrganizations = pgTable('user_organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(),
  organizationId: uuid('organization_id').notNull(),
  role: text('role').notNull(),
  invitedBy: uuid('invited_by'),
  invitedAt: timestamp('invited_at', { withTimezone: true }),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  roleCheck: check('user_organizations_role_check', sql`${t.role} = ANY (ARRAY['viewer', 'agent', 'manager', 'admin'])`)
}));
