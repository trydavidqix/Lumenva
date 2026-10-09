export interface InboxEventPayload {
  tenantId: string;
  accountId: string;
  provider: string;
  externalId: string;
  messageId: string;
  content: string;
  humanTakeover?: boolean;
}

export interface InboxEvent {
  type: string;
  payload: InboxEventPayload;
}

export async function handleInboxEvent(event: InboxEvent) {
  if (!event || !event.payload || typeof event.payload !== 'object') {
    throw new Error('INVALID_SCHEMA');
  }

  const { payload } = event;

  if (
      typeof payload.tenantId !== 'string' ||
      typeof payload.accountId !== 'string' ||
      typeof payload.provider !== 'string' ||
      typeof payload.externalId !== 'string' ||
      typeof payload.messageId !== 'string' ||
      typeof payload.content !== 'string'
  ) {
    throw new Error('INVALID_SCHEMA');
  }

  // The actual CRM contact bridge initialization and dependency injection
  // are dependent on Task 06 infrastructure which is currently missing/out-of-scope.
  // Throwing explicit blocker as requested.
  throw new Error('BLOCKED_DEPENDENCY: Task 06 infrastructure (ContactBridge, RBAC) is not integrated.');
}
