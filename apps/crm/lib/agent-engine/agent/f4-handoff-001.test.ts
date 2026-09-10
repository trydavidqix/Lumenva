import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  openCase: vi.fn().mockResolvedValue({ ok: true }),
  cancelPendingCronsForLead: vi.fn().mockResolvedValue(undefined),
  emitAgentActivityForContact: vi.fn().mockResolvedValue({ routed: true }),
  expectativaDeAtendimento: vi.fn().mockResolvedValue({ frase: 'equipe disponível' }),
}));
vi.mock('./human-cases', () => ({ openCase: mocks.openCase }));
vi.mock('../cron/scheduler', () => ({ cancelPendingCronsForLead: mocks.cancelPendingCronsForLead }));
vi.mock('@/lib/leads/agent-activity', () => ({ emitAgentActivityForContact: mocks.emitAgentActivityForContact }));
vi.mock('@/lib/escalacao/disponibilidade', () => ({ expectativaDeAtendimento: mocks.expectativaDeAtendimento }));

import {
  applyRequestHumanHandoff,
  buildHandoffSummary,
  detectHumanHandoffRequest,
  performHumanHandoff,
} from './human-handoff';

const ids = { tenantId: 'org-1', leadId: 'lead-1', conversationId: 'conversation-1' };
const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const query = vi.fn().mockResolvedValue({ rows: [] });
const pool = { query } as unknown as Parameters<typeof performHumanHandoff>[0];

describe('F4-HANDOFF-001', () => {
  it('aplica persistência idempotente do contrato sem transporte externo', async () => {
    await performHumanHandoff(pool, ids, { reason: 'pedido explícito', conversationSummary: 'cliente quer ajuda', log });
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('update contacts set force_human = true'), ['org-1', 'lead-1']);
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('bot_silenced_until = $3'), ['org-1', 'conversation-1', 'infinity', 'pedido explícito']);
    expect(mocks.cancelPendingCronsForLead).toHaveBeenCalledWith(pool, 'org-1', 'lead-1');
    expect(mocks.openCase).toHaveBeenCalledOnce();
    expect(mocks.emitAgentActivityForContact).toHaveBeenCalledOnce();
  });

  it('recusa payload extra antes de tocar o banco', async () => {
    query.mockClear();
    const result = await applyRequestHumanHandoff(pool, ids, { conversationSummary: 'resumo', log }, { reason: 'ok', actor: 'forbidden' });
    expect(result).toMatchObject({ ok: false, error: { code: 'invalid_payload' } });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('mantém detecção e resumo determinísticos', () => {
    expect(detectHumanHandoffRequest('Quero falar com uma pessoa')).toBe(true);
    expect(detectHumanHandoffRequest('qual o preço?')).toBe(false);
    const input = { commitments: ['retorno hoje'], objections: [], next_action: 'ligar', rolling_summary: 'interessado' };
    expect(buildHandoffSummary(input)).toBe(buildHandoffSummary(input));
  });
});
