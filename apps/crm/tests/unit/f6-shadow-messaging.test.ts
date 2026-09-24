import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MessagingNormalizer } from '../../lib/db/drizzle/domains/messaging/normalizer';
import { DrizzleMessagingRepository } from '../../lib/db/drizzle/domains/messaging/repository';

// Mock dependencies
const mockTx = {
  execute: vi.fn().mockResolvedValue(true),
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  offset: vi.fn()
};
type MockTransactionCallback = (tx: typeof mockTx) => Promise<unknown>;

const mockDb = {
  transaction: vi.fn((cb: MockTransactionCallback): Promise<unknown> => cb(mockTx)),
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  offset: vi.fn().mockReturnThis(),
};

const mockSchema = {
  conversations: { id: 'id', organization_id: 'organization_id', status: 'status', channel: 'channel', last_message_at: 'last_message_at' },
  messages: { id: 'id', organization_id: 'organization_id', conversation_id: 'conversation_id', sent_at: 'sent_at' }
};

vi.mock('drizzle-orm', () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings: [...strings], values }),
  and: vi.fn(),
  eq: vi.fn(),
  desc: vi.fn(),
  asc: vi.fn(),
  lte: vi.fn(),
  gte: vi.fn(),
}));

describe('Messaging Shadow Read Normalizer', () => {
  describe('conversation', () => {
    it('normalizes missing fields correctly', () => {
      const input = {
        id: 'conv-123',
        organization_id: 'org-123',
        contact_id: 'ct-123',
        channel_session_id: 'cs-123',
        channel: 'whatsapp',
        status: 'open',
        unread_count_for_assignee: 5,
        is_group: false
      };

      const normalized = MessagingNormalizer.conversation(input);

      expect(normalized.id).toBe('conv-123');
      expect(normalized.status_changed_at).toBeUndefined();
      expect(normalized.assigned_to_user_id).toBeUndefined();
      expect(normalized.unread_count_for_assignee).toBe(5);
      expect(normalized.is_group).toBe(false);
      expect(normalized.tags).toEqual([]);
      expect(normalized.metadata).toEqual({});
    });

    it('sorts tags for stable comparison', () => {
      const input = {
        id: 'conv-123',
        tags: ['z', 'a', 'c']
      };

      const normalized = MessagingNormalizer.conversation(input);
      expect(normalized.tags).toEqual(['a', 'c', 'z']);
    });

    it('converts dates to ISO strings', () => {
      const now = new Date();
      const input = {
        id: 'conv-123',
        status_changed_at: now
      };

      const normalized = MessagingNormalizer.conversation(input);
      expect(normalized.status_changed_at).toBe(now.toISOString());
    });
  });

  describe('message', () => {
    it('redacts media_url', () => {
      const input = {
        id: 'msg-123',
        media_url: 'https://storage.example.com/secret-url?sig=123'
      };

      const normalized = MessagingNormalizer.message(input);
      expect(normalized.media_url).toBe('[REDACTED]');
    });

    it('converts numeric fields', () => {
      const input = {
        id: 'msg-123',
        ack: "2",
        media_size_bytes: "1024"
      };

      const normalized = MessagingNormalizer.message(input);
      expect(normalized.ack).toBe(2);
      expect(normalized.media_size_bytes).toBe(1024);
    });
  });
});

describe('DrizzleMessagingRepository', () => {
  let repository: DrizzleMessagingRepository;
  const ctx = {
    userId: 'user-1',
    organizationId: 'org-1',
    role: 'agent' as const,
    requestId: 'req-1'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = 'postgres://fake:fake@fake:5432/fake';
    repository = new DrizzleMessagingRepository(
      mockDb as unknown as ConstructorParameters<typeof DrizzleMessagingRepository>[0],
      mockSchema as unknown as ConstructorParameters<typeof DrizzleMessagingRepository>[1]
    );
  });

  afterEach(() => {
    delete process.env.DATABASE_URL;
  });

  it('findConversationById isolates by organization and executes SET LOCAL', async () => {
    mockTx.limit.mockResolvedValueOnce([{ id: 'conv-1', organization_id: 'org-1' }]);

    const result = await repository.findConversationById(ctx, 'conv-1');

    expect(mockDb.transaction).toHaveBeenCalled();
    const tenantSetting = mockTx.execute.mock.calls[0]?.[0] as { strings: string[]; values: unknown[] };
    expect(tenantSetting.strings.join('')).toContain('SET LOCAL app.organization_id = ');
    expect(tenantSetting.values).toEqual(['org-1']);
    expect(result).toBeDefined();
    expect(result?.id).toBe('conv-1');
  });

  it('executes the select on the transaction that received SET LOCAL', async () => {
    mockTx.limit.mockResolvedValueOnce([]);

    await repository.findConversationById(ctx, 'conv-1');

    expect(mockTx.select).toHaveBeenCalledOnce();
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('findMessageById isolates by organization and returns null if missing', async () => {
    mockTx.limit.mockResolvedValueOnce([]);

    const result = await repository.findMessageById(ctx, 'msg-none');

    expect(mockDb.transaction).toHaveBeenCalled();
    const tenantSetting = mockTx.execute.mock.calls[0]?.[0] as { strings: string[]; values: unknown[] };
    expect(tenantSetting.strings.join('')).toContain('SET LOCAL app.organization_id = ');
    expect(tenantSetting.values).toEqual(['org-1']);
    expect(result).toBeNull();
  });

  it('listConversations correctly queries by context', async () => {
    mockTx.offset.mockResolvedValueOnce([
      { id: 'conv-1', organization_id: 'org-1' },
      { id: 'conv-2', organization_id: 'org-1' }
    ]);

    const results = await repository.listConversations(ctx, { limit: 10 });

    expect(mockDb.transaction).toHaveBeenCalled();
    expect(results).toHaveLength(2);
    expect(results[0]?.id).toBe('conv-1');
  });

  it('listMessages correctly queries by context and conversationId', async () => {
    mockTx.limit.mockResolvedValueOnce([
      { id: 'msg-1', organization_id: 'org-1', conversation_id: 'conv-1' }
    ]);

    const results = await repository.listMessages(ctx, { conversationId: 'conv-1', direction: 'forward' });

    expect(mockDb.transaction).toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe('msg-1');
  });

  it('listMessages applies cursor filter correctly', async () => {
    mockTx.limit.mockResolvedValueOnce([
      { id: 'msg-2', organization_id: 'org-1', conversation_id: 'conv-1' }
    ]);

    const cursorStr = new Date('2023-01-01T00:00:00Z').toISOString();

    const results = await repository.listMessages(ctx, { conversationId: 'conv-1', direction: 'forward', cursor: cursorStr });

    expect(mockDb.transaction).toHaveBeenCalled();
    expect(mockTx.where).toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe('msg-2');
  });
});
