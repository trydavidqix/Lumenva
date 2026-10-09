import { describe, it, expect } from 'vitest';
import { handleInboxEvent, type InboxEvent } from './inbox-handler';

describe('Inbox Worker Handler', () => {
  it('should validate schema and reject invalid payloads', async () => {
    const invalidEvent = {
      type: 'social.inbox.message',
      payload: {
        tenantId: 'tenant-1'
        // missing fields
      }
    };

    await expect(handleInboxEvent(invalidEvent as unknown as InboxEvent)).rejects.toThrow('INVALID_SCHEMA');
  });

  it('should throw BLOCKED_DEPENDENCY if valid payload but missing task 06 infrastructure', async () => {
    const validEvent: InboxEvent = {
      type: 'social.inbox.message',
      payload: {
        tenantId: 'tenant-1',
        accountId: 'account-1',
        provider: 'instagram',
        externalId: 'ext-user-1',
        messageId: 'msg-1',
        content: 'hello'
      }
    };

    await expect(handleInboxEvent(validEvent)).rejects.toThrow('BLOCKED_DEPENDENCY');
  });
});
