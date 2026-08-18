import { describe, expect, it, vi } from 'vitest';

import {
  cancelApprovalRequest,
  createApprovalRequest,
  decideApprovalRequest,
  enforceApprovalDecision,
  expireApprovalRequest,
  type ApprovalRequest,
  type ApprovalStore,
} from '../policies/approval';

function memoryStore(): ApprovalStore & { rows: Map<string, ApprovalRequest> } {
  const rows = new Map<string, ApprovalRequest>();
  return {
    rows,
    async save(request) {
      rows.set(request.id, structuredClone(request));
    },
    async load(id) {
      const row = rows.get(id);
      return row ? structuredClone(row) : null;
    },
  };
}

async function pending(store: ApprovalStore, overrides: Partial<Parameters<typeof createApprovalRequest>[1]> = {}) {
  return createApprovalRequest(store, {
    organizationId: 'org-a',
    runId: 'run-1',
    agentId: 'agent-1',
    toolId: 'crm.contact.update',
    approvalType: 'reversible_write',
    idempotencyKey: 'idem-stable-1',
    reason: 'approval_required',
    expiresAt: '2026-08-18T12:00:00.000Z',
    ...overrides,
  });
}

describe('Phase 5 approval hardening', () => {
  it('expires a pending approval and prevents execution', async () => {
    const store = memoryStore();
    const request = await pending(store);
    const execute = vi.fn();

    await expireApprovalRequest(store, request.id, {
      organizationId: 'org-a',
      now: '2026-08-18T12:00:01.000Z',
    });

    const result = await enforceApprovalDecision(store, request.id, execute, {
      organizationId: 'org-a',
    });

    expect(result).toEqual({ kind: 'denied', reason: 'approval_expired' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('cancels a pending approval and prevents execution', async () => {
    const store = memoryStore();
    const request = await pending(store);
    const execute = vi.fn();

    await cancelApprovalRequest(store, request.id, {
      organizationId: 'org-a',
      cancelledBy: 'user-1',
      reason: 'operator_cancelled',
    });

    const result = await enforceApprovalDecision(store, request.id, execute, {
      organizationId: 'org-a',
    });

    expect(result).toEqual({ kind: 'denied', reason: 'approval_cancelled' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('first concurrent decision wins and cannot be overwritten', async () => {
    const store = memoryStore();
    const request = await pending(store);

    const approved = await decideApprovalRequest(
      store,
      request.id,
      { decision: 'approved', decidedBy: 'user-1' },
      { organizationId: 'org-a', runTerminal: false },
    );
    const deniedAfter = await decideApprovalRequest(
      store,
      request.id,
      { decision: 'denied', decidedBy: 'user-2', reason: 'late_denial' },
      { organizationId: 'org-a', runTerminal: false },
    );

    expect(approved.status).toBe('approved');
    expect(deniedAfter.status).toBe('approved');
    expect(deniedAfter.decidedBy).toBe('user-1');
  });

  it('rejects approval decisions for a terminal run', async () => {
    const store = memoryStore();
    const request = await pending(store);

    await expect(
      decideApprovalRequest(
        store,
        request.id,
        { decision: 'approved', decidedBy: 'user-1' },
        { organizationId: 'org-a', runTerminal: true },
      ),
    ).rejects.toThrow('approval_run_terminal');
  });

  it('fails closed on cross-tenant decision and execution lookup', async () => {
    const store = memoryStore();
    const request = await pending(store);

    await expect(
      decideApprovalRequest(
        store,
        request.id,
        { decision: 'approved', decidedBy: 'user-b' },
        { organizationId: 'org-b', runTerminal: false },
      ),
    ).rejects.toThrow('approval_tenant_mismatch');

    await expect(
      enforceApprovalDecision(store, request.id, vi.fn(), { organizationId: 'org-b' }),
    ).rejects.toThrow('approval_tenant_mismatch');
  });

  it('preserves idempotency identity and executes once across replay', async () => {
    const store = memoryStore();
    const request = await pending(store);
    const execute = vi.fn().mockResolvedValue({ ok: true });

    await decideApprovalRequest(
      store,
      request.id,
      { decision: 'approved', decidedBy: 'user-1' },
      { organizationId: 'org-a', runTerminal: false },
    );

    const first = await enforceApprovalDecision(store, request.id, execute, {
      organizationId: 'org-a',
    });
    const replay = await enforceApprovalDecision(store, request.id, execute, {
      organizationId: 'org-a',
    });
    const stored = await store.load(request.id);

    expect(first).toEqual({ kind: 'executed', result: { ok: true } });
    expect(replay).toEqual({ kind: 'already_executed' });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(stored?.idempotencyKey).toBe('idem-stable-1');
  });
});
