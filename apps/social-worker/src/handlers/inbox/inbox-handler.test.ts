import { describe, it, expect } from 'vitest';
import { handleInboxEvent } from './inbox-handler';

describe('Inbox Worker Handler', () => {
  it('should process inbox events successfully', async () => {
    const event = {
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

    const result = await handleInboxEvent(event);
    expect(result.success).toBe(true);
  });
});
