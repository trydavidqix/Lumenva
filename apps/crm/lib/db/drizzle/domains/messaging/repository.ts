import { and, eq, desc, asc, lte, gte } from 'drizzle-orm';
import type { Conversation, Message } from '../../../../types/messaging';
import type { TenantReadContext, ConversationFilter, MessageFilter, MessagingRepository } from './types';
import { MessagingNormalizer, type ConversationDbRow, type MessageDbRow } from './normalizer';

type DrizzleColumn = Parameters<typeof eq>[0];
type DrizzleRow = Readonly<Record<string, unknown>>;

interface ConversationTable {
  id: DrizzleColumn;
  organization_id: DrizzleColumn;
  status: DrizzleColumn;
  channel: DrizzleColumn;
  last_message_at: DrizzleColumn;
}

interface MessageTable {
  id: DrizzleColumn;
  organization_id: DrizzleColumn;
  conversation_id: DrizzleColumn;
  sent_at: DrizzleColumn;
}

interface MessagingSchema {
  conversations: ConversationTable;
  messages: MessageTable;
}

interface MessagingQueryResult extends Promise<readonly DrizzleRow[]> {
  offset(value: number): Promise<readonly DrizzleRow[]>;
}

interface MessagingQuery {
  from(table: ConversationTable | MessageTable): MessagingQuery;
  where(condition: unknown): MessagingQuery;
  orderBy(...clauses: unknown[]): MessagingQuery;
  limit(value: number): MessagingQueryResult;
}

interface MessagingTransaction {
  execute(query: string): Promise<unknown>;
}

interface MessagingDatabase {
  transaction(callback: (tx: MessagingTransaction) => Promise<unknown>): Promise<unknown>;
  select(): MessagingQuery;
}

export class DrizzleMessagingRepository implements MessagingRepository {
  private db: MessagingDatabase;
  private schema: MessagingSchema;

  constructor(dbClient: MessagingDatabase, schemaMap: MessagingSchema) {
    this.db = dbClient;
    this.schema = schemaMap;
  }

  private async executeWithContext<T>(ctx: TenantReadContext, queryFn: () => Promise<T>): Promise<T> {
    if (!ctx.organizationId) throw new Error('Missing organizationId in context');

    const result = await this.db.transaction(async (tx) => {
      await tx.execute(`SET LOCAL app.organization_id = '${ctx.organizationId}'`);
      return await queryFn();
    });

    return result as T;
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
      return MessagingNormalizer.conversation(result[0] as ConversationDbRow | undefined) as Conversation;
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

      return results.map((row) => MessagingNormalizer.conversation(row as ConversationDbRow) as Conversation);
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
      return MessagingNormalizer.message(result[0] as MessageDbRow | undefined) as Message;
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

      return results.map((row) => MessagingNormalizer.message(row as MessageDbRow) as Message);
    });
  }
}
