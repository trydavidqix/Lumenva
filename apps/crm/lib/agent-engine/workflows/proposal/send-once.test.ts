/**
 * Exactly-once proposal send tests — Task 1 (Phase 8) real implementation.
 *
 * Mocks `sendTurnMessage` (the canonical CRM send boundary) and a fake
 * `pg.Pool.query` to exercise `sendProposalOnce`'s decision logic without a
 * real database: crash/duplicate short-circuits, org isolation, STOP/LGPD
 * veto, and the outcome→status mapping.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type pg from 'pg';

import type { SendOutcome } from '@/lib/agent-engine/edge/crm/send-message';

const sendTurnMessageMock = vi.fn<(...args: unknown[]) => Promise<SendOutcome>>();
vi.mock('@/lib/agent-engine/edge/crm/send-message', () => ({
  sendTurnMessage: (...args: unknown[]) => sendTurnMessageMock(...args),
}));

import { sendProposalOnce } from './send-once';

const ORG_ID = 'org-1';
const RUN_ID = 'workflow-run-1';
const DRAFT = {
  proposal_title: 'Proposta X',
  executive_summary: 'Resumo',
  terms: 'Termos',
  next_steps: ['Passo 1'],
};

function fakeDb(row: Record<string, unknown> | undefined) {
  const query = vi.fn().mockImplementation((sql: string) => {
    if (sql.includes('select') && sql.includes('from ai_workflow_runs')) {
      return Promise.resolve({ rows: row ? [row] : [] });
    }
    return Promise.resolve({ rows: [] });
  });
  return { query } as unknown as pg.Pool;
}

beforeEach(() => {
  sendTurnMessageMock.mockReset();
});

describe('sendProposalOnce', () => {
  it('throws when the workflow run does not exist', async () => {
    const db = fakeDb(undefined);
    await expect(sendProposalOnce(RUN_ID, ORG_ID, db, { supabase: {} as never })).rejects.toThrow('not found');
    expect(sendTurnMessageMock).not.toHaveBeenCalled();
  });

  it('throws on organization mismatch without sending', async () => {
    const db = fakeDb({
      organization_id: 'other-org',
      contact_id: 'c1',
      conversation_id: 'conv1',
      lead_id: null,
      status: 'approved',
      sent_message_id: null,
      draft_payload: DRAFT,
    });
    await expect(sendProposalOnce(RUN_ID, ORG_ID, db, { supabase: {} as never })).rejects.toThrow('organization mismatch');
    expect(sendTurnMessageMock).not.toHaveBeenCalled();
  });

  it('short-circuits when sent_message_id is already set (resume/duplicate)', async () => {
    const db = fakeDb({
      organization_id: ORG_ID,
      contact_id: 'c1',
      conversation_id: 'conv1',
      lead_id: null,
      status: 'sending',
      sent_message_id: 'msg-existing',
      draft_payload: DRAFT,
    });
    const result = await sendProposalOnce(RUN_ID, ORG_ID, db, { supabase: {} as never });
    expect(result).toEqual({ messageId: 'msg-existing', duplicate: true, blocked: false });
    expect(sendTurnMessageMock).not.toHaveBeenCalled();
  });

  it('throws when there is no conversation_id to send into', async () => {
    const db = fakeDb({
      organization_id: ORG_ID,
      contact_id: 'c1',
      conversation_id: null,
      lead_id: null,
      status: 'approved',
      sent_message_id: null,
      draft_payload: DRAFT,
    });
    await expect(sendProposalOnce(RUN_ID, ORG_ID, db, { supabase: {} as never })).rejects.toThrow('conversation_id');
  });

  it('throws when there is no draft to send', async () => {
    const db = fakeDb({
      organization_id: ORG_ID,
      contact_id: 'c1',
      conversation_id: 'conv1',
      lead_id: null,
      status: 'approved',
      sent_message_id: null,
      draft_payload: null,
    });
    await expect(sendProposalOnce(RUN_ID, ORG_ID, db, { supabase: {} as never })).rejects.toThrow('draft_payload');
  });

  it('first send succeeds: returns messageId, duplicate false, blocked false', async () => {
    const db = fakeDb({
      organization_id: ORG_ID,
      contact_id: 'c1',
      conversation_id: 'conv1',
      lead_id: 'lead1',
      status: 'approved',
      sent_message_id: null,
      draft_payload: DRAFT,
    });
    sendTurnMessageMock.mockResolvedValue({ kind: 'sent', idempotencyKey: 'k1', crmMessageId: 'msg-1' });

    const result = await sendProposalOnce(RUN_ID, ORG_ID, db, { supabase: {} as never });

    expect(result).toEqual({ messageId: 'msg-1', duplicate: false, blocked: false });
    expect(sendTurnMessageMock).toHaveBeenCalledTimes(1);
    const call = sendTurnMessageMock.mock.calls[0]?.[2] as { jobId: string; seq: number; conversationId: string };
    expect(call.jobId).toBe(RUN_ID);
    expect(call.seq).toBe(1);
    expect(call.conversationId).toBe('conv1');
  });

  it('queued outcome is treated as a successful send (message under CRM custody)', async () => {
    const db = fakeDb({
      organization_id: ORG_ID,
      contact_id: 'c1',
      conversation_id: 'conv1',
      lead_id: null,
      status: 'approved',
      sent_message_id: null,
      draft_payload: DRAFT,
    });
    sendTurnMessageMock.mockResolvedValue({ kind: 'queued', idempotencyKey: 'k1', crmMessageId: 'msg-1' });

    const result = await sendProposalOnce(RUN_ID, ORG_ID, db, { supabase: {} as never });
    expect(result).toEqual({ messageId: 'msg-1', duplicate: false, blocked: false });
  });

  it('already_sent outcome is reported as duplicate: true', async () => {
    const db = fakeDb({
      organization_id: ORG_ID,
      contact_id: 'c1',
      conversation_id: 'conv1',
      lead_id: null,
      status: 'approved',
      sent_message_id: null,
      draft_payload: DRAFT,
    });
    sendTurnMessageMock.mockResolvedValue({ kind: 'already_sent', idempotencyKey: 'k1', crmMessageId: 'msg-1' });

    const result = await sendProposalOnce(RUN_ID, ORG_ID, db, { supabase: {} as never });
    expect(result).toEqual({ messageId: 'msg-1', duplicate: true, blocked: false });
  });

  it('STOP/LGPD veto (blocked): returns blocked true, never throws, no retry', async () => {
    const db = fakeDb({
      organization_id: ORG_ID,
      contact_id: 'c1',
      conversation_id: 'conv1',
      lead_id: null,
      status: 'approved',
      sent_message_id: null,
      draft_payload: DRAFT,
    });
    sendTurnMessageMock.mockResolvedValue({ kind: 'blocked', idempotencyKey: 'k1' });

    const result = await sendProposalOnce(RUN_ID, ORG_ID, db, { supabase: {} as never });
    expect(result).toEqual({ messageId: null, duplicate: false, blocked: true });
  });

  it('handler-level failure throws (surfaces loudly, retry ownership stays with the caller)', async () => {
    const db = fakeDb({
      organization_id: ORG_ID,
      contact_id: 'c1',
      conversation_id: 'conv1',
      lead_id: null,
      status: 'approved',
      sent_message_id: null,
      draft_payload: DRAFT,
    });
    sendTurnMessageMock.mockResolvedValue({ kind: 'failed', idempotencyKey: 'k1', crmMessageId: null });

    await expect(sendProposalOnce(RUN_ID, ORG_ID, db, { supabase: {} as never })).rejects.toThrow('send failed');
  });
});
