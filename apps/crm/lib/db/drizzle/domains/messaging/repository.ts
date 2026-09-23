import { and, eq, desc, asc, lte, gte } from 'drizzle-orm';
import type { Conversation, Message } from '@/lib/types/messaging';
import type { TenantReadContext, ConversationFilter, MessageFilter, MessagingRepository } from './types';
import { MessagingNormalizer } from './normalizer';

// Since we cannot import directly from `@lumenva/db/drizzle/*` because it is not exported in package.json,
// we will have to make mock references and inject db as a dependency or assume it's globally mocked by our tests for now
// according to the assignment requirements which forces to not modify outside allowlist.

// Assuming the app would normally inject or resolve this somehow without modifying the package.json outside allowlist.
// We will export a class that accepts the db instance.

export class DrizzleMessagingRepository implements MessagingRepository {
  private db: any;
  private schema: any;

  constructor(dbClient: any, schemaMap: any) {
    this.db = dbClient;
    this.schema = schemaMap;
  }

  private async executeWithContext<T>(ctx: TenantReadContext, queryFn: () => Promise<T>): Promise<T> {
    if (!ctx.organizationId) throw new Error('Missing organizationId in context');

    return await this.db.transaction(async (tx: any) => {
      await tx.execute(`SET LOCAL app.organization_id = '${ctx.organizationId}'`);
      return await queryFn();
    });
  }

  async findConversationById(ctx: TenantReadContext, id: string): Promise<Conversation | null> {
    return this.executeWithContext(ctx, async () => {
      const { conversations } = this.schema;
      const result = await this.db.select()
        .from(conversations)
        .where(and(
          eq(conversations.id, id),
          eq(conversations.organization_id, ctx.organizationId)
        ))
        .limit(1);

      if (result.length === 0) return null;
      return MessagingNormalizer.conversation(result[0]) as Conversation;
    });
  }

  async listConversations(ctx: TenantReadContext, filter: ConversationFilter): Promise<readonly Conversation[]> {
    return this.executeWithContext(ctx, async () => {
      const { conversations } = this.schema;
      const conditions = [eq(conversations.organization_id, ctx.organizationId)];

      if (filter.status) {
        conditions.push(eq(conversations.status, filter.status));
      }

      if (filter.channel) {
        conditions.push(eq(conversations.channel, filter.channel));
      }

      const results = await this.db.select()
        .from(conversations)
        .where(and(...conditions))
        .orderBy(desc(conversations.last_message_at))
        .limit(filter.limit || 50)
        .offset(filter.offset || 0);

      return results.map((row: any) => MessagingNormalizer.conversation(row) as Conversation);
    });
  }

  async findMessageById(ctx: TenantReadContext, id: string): Promise<Message | null> {
    return this.executeWithContext(ctx, async () => {
      const { messages } = this.schema;
      const result = await this.db.select()
        .from(messages)
        .where(and(
          eq(messages.id, id),
          eq(messages.organization_id, ctx.organizationId)
        ))
        .limit(1);

      if (result.length === 0) return null;
      return MessagingNormalizer.message(result[0]) as Message;
    });
  }

  async listMessages(ctx: TenantReadContext, filter: MessageFilter): Promise<readonly Message[]> {
    return this.executeWithContext(ctx, async () => {
      const { messages } = this.schema;
      const conditions = [
        eq(messages.organization_id, ctx.organizationId),
        eq(messages.conversation_id, filter.conversationId)
      ];

      if (filter.cursor) {
         if (filter.direction === 'forward') {
            conditions.push(gte(messages.sent_at, new Date(filter.cursor)));
         } else {
            conditions.push(lte(messages.sent_at, new Date(filter.cursor)));
         }
      }

      const orderByClause = filter.direction === 'forward'
        ? asc(messages.sent_at)
        : desc(messages.sent_at);

      const results = await this.db.select()
        .from(messages)
        .where(and(...conditions))
        .orderBy(orderByClause)
        .limit(filter.limit || 50);

      return results.map((row: any) => MessagingNormalizer.message(row) as Message);
    });
  }
}
