/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { and, eq, desc, asc, lte, gte } from 'drizzle-orm';
import type { Conversation, Message } from '../../../types/messaging';
import type { TenantReadContext, ConversationFilter, MessageFilter, MessagingRepository } from './types';
import { MessagingNormalizer } from './normalizer';

export class DrizzleMessagingRepository implements MessagingRepository {
  private db: unknown;
  private schema: unknown;

  constructor(dbClient: unknown, schemaMap: unknown) {
    this.db = dbClient;
    this.schema = schemaMap;
  }

  private async executeWithContext<T>(ctx: TenantReadContext, queryFn: () => Promise<T>): Promise<T> {
    if (!ctx.organizationId) throw new Error('Missing organizationId in context');

    const dbClient = this.db as { transaction: (cb: (tx: { execute: (sql: string) => Promise<unknown> }) => Promise<T>) => Promise<T> };
    return await dbClient.transaction(async (tx) => {
      await tx.execute(`SET LOCAL app.organization_id = '${ctx.organizationId}'`);
      return await queryFn();
    });
  }

  async findConversationById(ctx: TenantReadContext, id: string): Promise<Conversation | null> {
    return this.executeWithContext(ctx, async () => {
      const { conversations } = this.schema as { conversations: unknown };
      const dbClient = this.db as { select: () => { from: (table: unknown) => { where: (condition: unknown) => { limit: (n: number) => Promise<unknown[]> } } } };

      const result = await dbClient.select()
        .from(conversations)
        .where(and(
          eq((conversations as { id: unknown }).id, id),
          eq((conversations as { organization_id: unknown }).organization_id, ctx.organizationId)
        ))
        .limit(1);

      if (result.length === 0) return null;
      return MessagingNormalizer.conversation(result[0]) as Conversation;
    });
  }

  async listConversations(ctx: TenantReadContext, filter: ConversationFilter): Promise<readonly Conversation[]> {
    return this.executeWithContext(ctx, async () => {
      const { conversations } = this.schema as { conversations: unknown };
      const dbClient = this.db as { select: () => { from: (table: unknown) => { where: (condition: unknown) => { orderBy: (col: unknown) => { limit: (n: number) => { offset: (n: number) => Promise<unknown[]> } } } } } };

      const conditions = [eq((conversations as { organization_id: unknown }).organization_id, ctx.organizationId)];

      if (filter.status) {
        conditions.push(eq((conversations as { status: unknown }).status, filter.status));
      }

      if (filter.channel) {
        conditions.push(eq((conversations as { channel: unknown }).channel, filter.channel));
      }

      const results = await dbClient.select()
        .from(conversations)
        .where(and(...conditions))
        .orderBy(desc((conversations as { last_message_at: unknown }).last_message_at))
        .limit(filter.limit || 50)
        .offset(filter.offset || 0);

      return results.map((row: unknown) => MessagingNormalizer.conversation(row) as Conversation);
    });
  }

  async findMessageById(ctx: TenantReadContext, id: string): Promise<Message | null> {
    return this.executeWithContext(ctx, async () => {
      const { messages } = this.schema as { messages: unknown };
      const dbClient = this.db as { select: () => { from: (table: unknown) => { where: (condition: unknown) => { limit: (n: number) => Promise<unknown[]> } } } };

      const result = await dbClient.select()
        .from(messages)
        .where(and(
          eq((messages as { id: unknown }).id, id),
          eq((messages as { organization_id: unknown }).organization_id, ctx.organizationId)
        ))
        .limit(1);

      if (result.length === 0) return null;
      return MessagingNormalizer.message(result[0]) as Message;
    });
  }

  async listMessages(ctx: TenantReadContext, filter: MessageFilter): Promise<readonly Message[]> {
    return this.executeWithContext(ctx, async () => {
      const { messages } = this.schema as { messages: unknown };
      const dbClient = this.db as { select: () => { from: (table: unknown) => { where: (condition: unknown) => { orderBy: (col: unknown) => { limit: (n: number) => Promise<unknown[]> } } } } };

      const conditions: unknown[] = [
        eq((messages as { organization_id: unknown }).organization_id, ctx.organizationId),
        eq((messages as { conversation_id: unknown }).conversation_id, filter.conversationId)
      ];

      if (filter.cursor) {
         if (filter.direction === 'forward') {
            conditions.push(gte((messages as { sent_at: unknown }).sent_at, new Date(filter.cursor)));
         } else {
            conditions.push(lte((messages as { sent_at: unknown }).sent_at, new Date(filter.cursor)));
         }
      }

      const orderByClause = filter.direction === 'forward'
        ? asc((messages as { sent_at: unknown }).sent_at)
        : desc((messages as { sent_at: unknown }).sent_at);

      const results = await dbClient.select()
        .from(messages)
        .where(and(...conditions))
        .orderBy(orderByClause)
        .limit(filter.limit || 50);

      return results.map((row: unknown) => MessagingNormalizer.message(row) as Message);
    });
  }
}
