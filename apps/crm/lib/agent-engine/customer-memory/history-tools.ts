export interface CustomerHistoryQueryable {
  query<T = Record<string, unknown>>(sql: string, params: unknown[]): Promise<{ rows: T[] }>;
}

export interface CustomerHistoryMessage {
  direction: string;
  body: string | null;
  sent_at: Date | string | null;
}

export function createCustomerHistoryReader(db: CustomerHistoryQueryable) {
  return {
    async getRecentMessages(
      organizationId: string,
      contactId: string,
      requestedLimit = 20,
    ): Promise<CustomerHistoryMessage[]> {
      const limit = Math.min(50, Math.max(1, Math.trunc(requestedLimit)));
      const { rows } = await db.query<CustomerHistoryMessage>(
        `select m.direction, m.body, m.sent_at
           from messages m
           join conversations c
             on c.organization_id = m.organization_id and c.id = m.conversation_id
          where m.organization_id = $1
            and c.contact_id = $2
          order by m.sent_at desc, m.id desc
          limit $3`,
        [organizationId, contactId, limit],
      );
      return rows;
    },
  };
}
