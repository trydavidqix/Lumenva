import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processInboxMessage, type InboxMessage, type ContactBridge } from './inbox-processor';

describe('Inbox Processor', () => {
  let mockContactBridge: ContactBridge;

  beforeEach(() => {
    mockContactBridge = {
      resolveContact: vi.fn().mockResolvedValue({ id: 'contact-123' }),
      recordInteraction: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('RED: should not duplicate conversation/lead on repeated webhook', async () => {
    const msg: InboxMessage = {
      tenantId: 'tenant-1',
      accountId: 'account-1',
      provider: 'instagram',
      externalId: 'ext-user-1',
      messageId: 'msg-1',
      content: 'hello',
    };

    mockContactBridge.resolveContact = vi.fn()
      .mockResolvedValueOnce({ id: 'contact-123', isNew: true })
      .mockResolvedValueOnce({ id: 'contact-123', isNew: false });

    const result1 = await processInboxMessage(msg, mockContactBridge);
    const result2 = await processInboxMessage(msg, mockContactBridge);

    expect(result1.contactId).toBe('contact-123');
    expect(result1.isNewContact).toBe(true);
    expect(result2.contactId).toBe('contact-123');
    expect(result2.isNewContact).toBe(false);
  });

  it('RED: human takeover suspends automatic response', async () => {
    const msg: InboxMessage = {
      tenantId: 'tenant-1',
      accountId: 'account-1',
      provider: 'instagram',
      externalId: 'ext-user-1',
      messageId: 'msg-2',
      content: 'keyword1',
      humanTakeover: true,
    };

    const result = await processInboxMessage(msg, mockContactBridge);
    expect(result.automationTriggered).toBe(false);
    expect(result.reason).toBe('human_takeover');
  });

  it('RED: incorrect tenant/account are denied', async () => {
    const msg: InboxMessage = {
      tenantId: 'invalid-tenant',
      accountId: 'invalid-account',
      provider: 'instagram',
      externalId: 'ext-user-1',
      messageId: 'msg-3',
      content: 'hello',
    };

    mockContactBridge.resolveContact = vi.fn().mockRejectedValue(new Error('Invalid tenant or account'));

    await expect(processInboxMessage(msg, mockContactBridge)).rejects.toThrow('Invalid tenant or account');
  });

  it('RED: opt-out prevents automation', async () => {
    const msg: InboxMessage = {
      tenantId: 'tenant-1',
      accountId: 'account-1',
      provider: 'instagram',
      externalId: 'ext-user-1',
      messageId: 'msg-4',
      content: 'STOP',
    };

    const result = await processInboxMessage(msg, mockContactBridge);
    expect(result.automationTriggered).toBe(false);
    expect(result.reason).toBe('opt_out');
  });

  it('RED: missing provider is rejected', async () => {
    const msg: Partial<InboxMessage> = {
      tenantId: 'tenant-1',
      accountId: 'account-1',
      externalId: 'ext-user-1',
      messageId: 'msg-5',
      content: 'hello',
    };

    await expect(processInboxMessage(msg as InboxMessage, mockContactBridge)).rejects.toThrow('Missing provider');
  });
});
