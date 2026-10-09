export interface InboxMessage {
  tenantId: string;
  accountId: string;
  provider: string;
  externalId: string;
  messageId: string;
  content: string;
  humanTakeover?: boolean;
}

export interface ContactResolution {
  id: string;
  isNew?: boolean;
}

export interface ContactBridge {
  resolveContact(tenantId: string, accountId: string, provider: string, externalId: string): Promise<ContactResolution>;
  recordInteraction(contactId: string, messageId: string, content: string): Promise<void>;
}

export interface ProcessResult {
  contactId: string;
  isNewContact: boolean;
  automationTriggered: boolean;
  reason?: string;
}

export async function processInboxMessage(msg: InboxMessage, bridge: ContactBridge): Promise<ProcessResult> {
  if (!msg.provider) {
    throw new Error('Missing provider');
  }

  const contact = await bridge.resolveContact(msg.tenantId, msg.accountId, msg.provider, msg.externalId);

  await bridge.recordInteraction(contact.id, msg.messageId, msg.content);

  if (msg.humanTakeover) {
    return {
      contactId: contact.id,
      isNewContact: !!contact.isNew,
      automationTriggered: false,
      reason: 'human_takeover'
    };
  }

  const optOutKeywords = ['STOP', 'UNSUBSCRIBE', 'SAIR', 'CANCELAR'];
  if (optOutKeywords.includes(msg.content.trim().toUpperCase())) {
    return {
      contactId: contact.id,
      isNewContact: !!contact.isNew,
      automationTriggered: false,
      reason: 'opt_out'
    };
  }

  return {
    contactId: contact.id,
    isNewContact: !!contact.isNew,
    automationTriggered: false, // Default is disabled per requirements
    reason: 'automation_disabled'
  };
}
