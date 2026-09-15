import { describe, expect, it, vi } from 'vitest';

import {
  createApprovalRequest,
  decideApprovalRequest,
  enforceApprovalDecision,
  type ApprovalStore,
} from '../policies/approval';

function memoryApprovalStore(): ApprovalStore & { read: () => unknown[] } {
  const rows: unknown[] = [];
  return {
    async save(request) {
      const index = rows.findIndex((row) => (row as { id?: string }).id === request.id);
      if (index >= 0) rows[index] = request;
      else rows.push(request);
    },
    async load(id) {
      return (rows.find((row) => (row as { id?: string }).id === id) as never) ?? null;
    },
    async compareAndSet(id, expectedStatus, next) {
      const index = rows.findIndex((row) => (row as { id?: string }).id === id);
      const current = index >= 0 ? (rows[index] as { status?: string }) : undefined;
      if (!current || current.status !== expectedStatus) return false;
      rows[index] = next;
      return true;
    },
    read: () => rows,
  };
}

describe('Agent OS approval contract', () => {
  it('expõe compare-and-set para rejeitar atualização com status esperado obsoleto', async () => {
    const store = memoryApprovalStore();
    const request = await createApprovalRequest(store, {
      organizationId: 'org-1',
      runId: 'run-cas',
      agentId: 'agent-1',
      toolId: 'crm.discount.apply',
      approvalType: 'sensitive_commercial',
      idempotencyKey: 'idem-cas-1',
      reason: 'approval_required',
    });

    const approved = { ...request, status: 'approved' as const };
    const stale = { ...request, status: 'denied' as const };

    expect(await store.compareAndSet(request.id, 'pending', approved)).toBe(true);
    expect(await store.compareAndSet(request.id, 'pending', stale)).toBe(false);
    expect((await store.load(request.id))?.status).toBe('approved');
  });

  it('cria pedido durável com identidade suficiente para retomar depois', async () => {
    const store = memoryApprovalStore();
    const request = await createApprovalRequest(store, {
      organizationId: 'org-1',
      runId: 'run-1',
      agentId: 'agent-1',
      toolId: 'crm.discount.apply',
      approvalType: 'sensitive_commercial',
      idempotencyKey: 'idem-1',
      reason: 'sensitive_commercial_requires_approval',
    });

    expect(request.status).toBe('pending');
    expect(request).toMatchObject({
      organizationId: 'org-1',
      runId: 'run-1',
      toolId: 'crm.discount.apply',
      idempotencyKey: 'idem-1',
    });
    expect(store.read()).toHaveLength(1);
  });

  it('não executa a tool enquanto a aprovação está pendente', async () => {
    const store = memoryApprovalStore();
    const execute = vi.fn();
    const request = await createApprovalRequest(store, {
      organizationId: 'org-1',
      runId: 'run-1',
      agentId: 'agent-1',
      toolId: 'send_message',
      approvalType: 'external_communication',
      idempotencyKey: 'idem-send-1',
      reason: 'autonomy_level_requires_approval',
    });

    const result = await enforceApprovalDecision(store, request.id, execute);

    expect(result).toEqual({ kind: 'pending_approval', approvalId: request.id });
    expect(execute).not.toHaveBeenCalled();
  });

  it('negação encerra de forma controlada sem executar a tool', async () => {
    const store = memoryApprovalStore();
    const execute = vi.fn();
    const request = await createApprovalRequest(store, {
      organizationId: 'org-1',
      runId: 'run-1',
      agentId: 'agent-1',
      toolId: 'send_message',
      approvalType: 'external_communication',
      idempotencyKey: 'idem-send-1',
      reason: 'autonomy_level_requires_approval',
    });

    await decideApprovalRequest(store, request.id, {
      decision: 'denied',
      decidedBy: 'user-1',
      reason: 'not_now',
    });

    const result = await enforceApprovalDecision(store, request.id, execute);

    expect(result).toEqual({ kind: 'denied', reason: 'approval_denied' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('aprovação executa uma vez e replay da mesma decisão não duplica o side effect', async () => {
    const store = memoryApprovalStore();
    const execute = vi.fn().mockResolvedValue({ ok: true });
    const request = await createApprovalRequest(store, {
      organizationId: 'org-1',
      runId: 'run-1',
      agentId: 'agent-1',
      toolId: 'send_message',
      approvalType: 'external_communication',
      idempotencyKey: 'idem-send-1',
      reason: 'autonomy_level_requires_approval',
    });

    await decideApprovalRequest(store, request.id, {
      decision: 'approved',
      decidedBy: 'user-1',
    });

    const first = await enforceApprovalDecision(store, request.id, execute);
    const replay = await enforceApprovalDecision(store, request.id, execute);

    expect(first).toEqual({ kind: 'executed', result: { ok: true } });
    expect(replay).toEqual({ kind: 'already_executed' });
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
