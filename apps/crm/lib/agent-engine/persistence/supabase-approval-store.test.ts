import { describe, expect, it } from 'vitest';

import {
  SupabaseApprovalStore,
  type ApprovalStoreDatabase,
} from './supabase-approval-store';

const request = {
  id: '11111111-1111-4111-8111-111111111111',
  organizationId: '22222222-2222-4222-8222-222222222222',
  runId: 'run-1',
  agentId: 'agent-1',
  toolId: 'crm.contact.update',
  approvalType: 'reversible_write',
  idempotencyKey: 'idem-1',
  reason: 'approval_required',
  status: 'pending' as const,
  createdAt: '2026-09-15T10:00:00.000Z',
};

function databaseForCompareAndSet() {
  let updateCount = 0;
  const calls: Array<{ id?: unknown; status?: unknown }> = [];
  const db: ApprovalStoreDatabase = {
    from(table) {
      expect(table).toBe('approval_requests');
      const query = {
        update() { return query; },
        insert() { return query; },
        upsert() { return query; },
        select() { return query; },
        eq(column: string, value: unknown) {
          if (column === 'id') calls.push({ id: value });
          if (column === 'status') calls.push({ status: value });
          return query;
        },
        async maybeSingle() {
          updateCount += 1;
          return updateCount === 1
            ? { data: { ...request, status: 'approved', payload: { ...request, status: 'approved' } }, error: null }
            : { data: null, error: null };
        },
      };
      return query;
    },
  };
  return { db, calls };
}

describe('SupabaseApprovalStore', () => {
  it('carrega o payload persistido por id', async () => {
    const db: ApprovalStoreDatabase = {
      from(table) {
        expect(table).toBe('approval_requests');
        const query = {
          update() { return query; },
          insert() { return query; },
          upsert() { return query; },
          select() { return query; },
          eq() { return query; },
          async maybeSingle() {
            return { data: { status: 'pending', payload: request }, error: null };
          },
        };
        return query;
      },
    };

    await expect(new SupabaseApprovalStore(db).load(request.id)).resolves.toEqual(request);
  });

  it('returns one winner and false for the losing concurrent CAS', async () => {
    const { db, calls } = databaseForCompareAndSet();
    const store = new SupabaseApprovalStore(db);
    const next = { ...request, status: 'approved' as const };

    const [first, second] = await Promise.all([
      store.compareAndSet(request.id, 'pending', next),
      store.compareAndSet(request.id, 'pending', { ...request, status: 'denied' as const }),
    ]);

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(calls).toEqual([
      { id: request.id },
      { status: 'pending' },
      { id: request.id },
      { status: 'pending' },
    ]);
  });
});
