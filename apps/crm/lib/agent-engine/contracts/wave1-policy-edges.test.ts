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

function atomicStore(): ApprovalStore & { rows: Map<string, ApprovalRequest> } {
  const rows = new Map<string, ApprovalRequest>();
  return {
    rows,
    async save(request) {
      rows.set(request.id, structuredClone(request));
    },
    async load(id) {
      const request = rows.get(id);
      return request ? structuredClone(request) : null;
    },
    async compareAndSet(id, expectedStatus, next) {
      const current = rows.get(id);
      if (!current || current.status !== expectedStatus) return false;
      rows.set(id, structuredClone(next));
      return true;
    },
  };
}

async function pending(store: ApprovalStore): Promise<ApprovalRequest> {
  return createApprovalRequest(store, {
    organizationId: 'org-a',
    runId: 'run-1',
    agentId: 'agent-1',
    toolId: 'crm.contact.update',
    approvalType: 'reversible_write',
    idempotencyKey: 'idem-edge-1',
    reason: 'approval_required',
    expiresAt: '2026-09-11T12:00:00.000Z',
  });
}

describe('Wave 1 policy and approval edge contracts', () => {
  it('expires at the exact deadline and remains pending before it', async () => {
    const store = atomicStore();
    const request = await pending(store);
    const before = await expireApprovalRequest(store, request.id, {
      organizationId: 'org-a',
      now: '2026-09-11T11:59:59.999Z',
    });
    expect(before.status).toBe('pending');
    const expired = await expireApprovalRequest(store, request.id, {
      organizationId: 'org-a',
      now: '2026-09-11T12:00:00.000Z',
    });
    expect(expired.status).toBe('expired');
    await expect(enforceApprovalDecision(store, request.id, () => 'must-not-run')).resolves.toEqual({
      kind: 'denied',
      reason: 'approval_expired',
    });
  });

  it('keeps cancellation terminal and idempotent on replay', async () => {
    const store = atomicStore();
    const request = await pending(store);
    const first = await cancelApprovalRequest(store, request.id, {
      organizationId: 'org-a',
      cancelledBy: 'user-1',
      reason: 'operator_cancelled',
    });
    const replay = await cancelApprovalRequest(store, request.id, {
      organizationId: 'org-a',
      cancelledBy: 'user-2',
    });
    expect(replay).toEqual(first);
  });

  it('uses compare-and-set so concurrent decisions have one deterministic winner', async () => {
    const store = atomicStore();
    const request = await pending(store);
    const [approved, denied] = await Promise.all([
      decideApprovalRequest(store, request.id, { decision: 'approved', decidedBy: 'user-1' }, { organizationId: 'org-a' }),
      decideApprovalRequest(store, request.id, { decision: 'denied', decidedBy: 'user-2' }, { organizationId: 'org-a' }),
    ]);
    expect(approved.status).toBe('approved');
    expect(denied.status).toBe('approved');
    expect((await store.load(request.id))?.decidedBy).toBe('user-1');
  });

  it('replays an executed approval without invoking the capability again', async () => {
    const store = atomicStore();
    const request = await pending(store);
    await decideApprovalRequest(store, request.id, { decision: 'approved', decidedBy: 'user-1' }, { organizationId: 'org-a' });
    let executions = 0;
    const execute = () => {
      executions += 1;
      return { idempotencyKey: 'idem-edge-1' };
    };
    await enforceApprovalDecision(store, request.id, execute, { organizationId: 'org-a' });
    await expect(enforceApprovalDecision(store, request.id, execute, { organizationId: 'org-a' })).resolves.toEqual({ kind: 'already_executed' });
    expect(executions).toBe(1);
  });

  it('serializes concurrent execution claims and invokes the capability once', async () => {
    const store = atomicStore();
    const request = await pending(store);
    await decideApprovalRequest(store, request.id, { decision: 'approved', decidedBy: 'user-1' }, { organizationId: 'org-a' });
    const execute = vi.fn(async () => ({ ok: true }));
    const results = await Promise.all([
      enforceApprovalDecision(store, request.id, execute, { organizationId: 'org-a' }),
      enforceApprovalDecision(store, request.id, execute, { organizationId: 'org-a' }),
    ]);
    expect(results.filter((result) => result.kind === 'executed')).toHaveLength(1);
    expect(results.filter((result) => result.kind === 'already_executed')).toHaveLength(1);
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
