/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import type { Conversation, Message } from '../../../types/messaging';

export interface TenantReadContext {
  userId: string;
  organizationId: string;
  role: 'viewer' | 'agent' | 'manager' | 'admin';
  requestId: string;
}

export interface ConversationFilter {
  status?: string;
  channel?: string;
  limit?: number;
  offset?: number;
}

export interface MessageFilter {
  conversationId: string;
  limit?: number;
  cursor?: string;
  direction?: 'forward' | 'backward';
}

export interface MessagingRepository {
  findConversationById(ctx: TenantReadContext, id: string): Promise<Conversation | null>;
  listConversations(ctx: TenantReadContext, filter: ConversationFilter): Promise<readonly Conversation[]>;
  findMessageById(ctx: TenantReadContext, id: string): Promise<Message | null>;
  listMessages(ctx: TenantReadContext, filter: MessageFilter): Promise<readonly Message[]>;
}
