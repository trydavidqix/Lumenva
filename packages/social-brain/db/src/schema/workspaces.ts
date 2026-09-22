import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const workspaces = pgTable('workspaces', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerUserId: text('owner_user_id').notNull(),
  name: text('name').notNull(),
  timezone: text('timezone').default('UTC').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
