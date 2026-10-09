import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from 'vitest';
import { processDropshippingOrderTransition } from './service';
import { requireRole } from '@/lib/auth/require-role';
import { createAdminClient } from '@/lib/supabase/admin';

// Mock dependencies
vi.mock('@/lib/auth/require-role', () => ({
  requireRole: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

describe('processDropshippingOrderTransition', () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
  };

  const mockRequireRole = requireRole as unknown as MockedFunction<typeof requireRole>;
  const mockCreateAdminClient = createAdminClient as unknown as MockedFunction<typeof createAdminClient>;

  beforeEach(() => {
    vi.resetAllMocks();
    mockSupabase.from.mockReturnValue(mockSupabase);
    mockSupabase.select.mockReturnValue(mockSupabase);
    mockSupabase.eq.mockReturnValue(mockSupabase);
    mockSupabase.in.mockReturnValue(mockSupabase);
    mockSupabase.update.mockReturnValue(mockSupabase);
    mockCreateAdminClient.mockReturnValue(mockSupabase as unknown as ReturnType<typeof createAdminClient>);
    mockRequireRole.mockResolvedValue({
      ok: true,
      org: { orgId: 'org-123', role: 'agent', name: 'Test Org' },
      user: { id: 'user-456', email: 'test@test.com', full_name: 'Test', avatar_url: null, is_platform_admin: false, organizations: [] },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fails if authentication throws or denies', async () => {
    mockRequireRole.mockResolvedValue({
      ok: false,
      response: {} as unknown as NonNullable<Awaited<ReturnType<typeof requireRole>> extends { ok: false } ? Awaited<ReturnType<typeof requireRole>>['response'] : never>,
    });

    await expect(
      processDropshippingOrderTransition({
        orderId: 'order-1',
        expectedState: 'received',
        nextState: 'reviewed',
        expectedUpdatedAt: '2023-01-01T00:00:00Z',
      })
    ).rejects.toThrow('Forbidden');
  });

  it('fails if order is not found', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: 'Not found', code: 'PGRST116' } });

    await expect(
      processDropshippingOrderTransition({
        orderId: 'order-1',
        expectedState: 'received',
        nextState: 'reviewed',
        expectedUpdatedAt: '2023-01-01T00:00:00Z',
      })
    ).rejects.toThrow('Order not found or access denied');
  });

  it('fails on concurrent update (stale updated_at via fetch)', async () => {
    const existingOrder = {
      id: 'order-1',
      organization_id: 'org-123',
      payload: {},
      updated_at: '2023-01-02T00:00:00Z', // Different from expected
    };
    mockSupabase.single.mockResolvedValueOnce({ data: existingOrder, error: null });

    await expect(
      processDropshippingOrderTransition({
        orderId: 'order-1',
        expectedState: 'received',
        nextState: 'reviewed',
        expectedUpdatedAt: '2023-01-01T00:00:00Z',
      })
    ).rejects.toThrow('Concurrency conflict: Order was updated by another process');

    expect(mockSupabase.update).not.toHaveBeenCalled();
  });

  it('fails if expected state does not match actual state', async () => {
    const existingOrder = {
      id: 'order-1',
      organization_id: 'org-123',
      payload: { dropshipping_v1: { state: 'reviewed' } },
      updated_at: '2023-01-01T00:00:00Z',
    };
    mockSupabase.single.mockResolvedValueOnce({ data: existingOrder, error: null });

    await expect(
      processDropshippingOrderTransition({
        orderId: 'order-1',
        expectedState: 'received',
        nextState: 'approved',
        expectedUpdatedAt: '2023-01-01T00:00:00Z',
      })
    ).rejects.toThrow('Invalid state transition: Expected received but got reviewed');

    expect(mockSupabase.update).not.toHaveBeenCalled();
  });

  it('fails if transition is not in allowlist', async () => {
    const existingOrder = {
      id: 'order-1',
      organization_id: 'org-123',
      payload: { dropshipping_v1: { state: 'received' } },
      updated_at: '2023-01-01T00:00:00Z',
    };
    mockSupabase.single.mockResolvedValueOnce({ data: existingOrder, error: null });

    await expect(
      processDropshippingOrderTransition({
        orderId: 'order-1',
        expectedState: 'received',
        nextState: 'submitted', // Invalid transition from received directly to submitted
        expectedUpdatedAt: '2023-01-01T00:00:00Z',
      })
    ).rejects.toThrow('Invalid transition from received to submitted');
  });

  it('fails if order is in a failed or unknown state and trying to transition anywhere but received', async () => {
     const existingOrder = {
      id: 'order-1',
      organization_id: 'org-123',
      payload: { dropshipping_v1: { state: 'failed' } },
      updated_at: '2023-01-01T00:00:00Z',
    };
    mockSupabase.single.mockResolvedValueOnce({ data: existingOrder, error: null });

    await expect(
      processDropshippingOrderTransition({
        orderId: 'order-1',
        expectedState: 'failed',
        nextState: 'submitted',
        expectedUpdatedAt: '2023-01-01T00:00:00Z',
      })
    ).rejects.toThrow('Invalid transition from failed to submitted');
  });

  it('fails to transition to approved if snapshot is not provided', async () => {
     const existingOrder = {
      id: 'order-1',
      organization_id: 'org-123',
      payload: {
        dropshipping_v1: {
          state: 'reviewed',
          approval_snapshot: { version: 1 }
        }
      },
      updated_at: '2023-01-01T00:00:00Z',
    };
    mockSupabase.single.mockResolvedValueOnce({ data: existingOrder, error: null });

    await expect(
      processDropshippingOrderTransition({
        orderId: 'order-1',
        expectedState: 'reviewed',
        nextState: 'approved',
        expectedUpdatedAt: '2023-01-01T00:00:00Z',
        // snapshot is missing
      })
    ).rejects.toThrow('Cannot approve without providing an approval snapshot.');
  });

  it('fails to transition to approved if snapshot does not match stored snapshot', async () => {
     const existingOrder = {
      id: 'order-1',
      organization_id: 'org-123',
      payload: {
        dropshipping_v1: {
          state: 'reviewed',
          approval_snapshot: { version: 1 }
        }
      },
      updated_at: '2023-01-01T00:00:00Z',
    };
    mockSupabase.single.mockResolvedValueOnce({ data: existingOrder, error: null });

    await expect(
      processDropshippingOrderTransition({
        orderId: 'order-1',
        expectedState: 'reviewed',
        nextState: 'approved',
        expectedUpdatedAt: '2023-01-01T00:00:00Z',
        snapshot: { version: 2 }, // Mismatching snapshot provided by client
      })
    ).rejects.toThrow('Stale snapshot: Provided snapshot does not match the currently stored snapshot.');
  });

  it('fails to transition to submitted if approval is revoked (missing snapshot)', async () => {
     const existingOrder = {
      id: 'order-1',
      organization_id: 'org-123',
      payload: {
        dropshipping_v1: {
          state: 'approved',
          // Note: approval_snapshot is missing, simulating a revoked approval
        }
      },
      updated_at: '2023-01-01T00:00:00Z',
    };
    mockSupabase.single.mockResolvedValueOnce({ data: existingOrder, error: null });

    await expect(
      processDropshippingOrderTransition({
        orderId: 'order-1',
        expectedState: 'approved',
        nextState: 'submitted',
        expectedUpdatedAt: '2023-01-01T00:00:00Z',
      })
    ).rejects.toThrow('Cannot transition beyond approved without a valid approval snapshot on the server.');
  });

  it('fails CAS at update time if row was modified', async () => {
    const existingOrder = {
      id: 'order-1',
      organization_id: 'org-123',
      payload: { dropshipping_v1: { state: 'received' } },
      updated_at: '2023-01-01T00:00:00Z',
    };
    mockSupabase.single.mockResolvedValueOnce({ data: existingOrder, error: null });

    // Simulate zero rows returned from the CAS update
    mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    await expect(
      processDropshippingOrderTransition({
        orderId: 'order-1',
        expectedState: 'received',
        nextState: 'reviewed',
        expectedUpdatedAt: '2023-01-01T00:00:00Z',
      })
    ).rejects.toThrow('Concurrency conflict: Order was updated by another process (CAS failed)');
  });

  it('fails to persist client-supplied snapshot on review due to missing server-side contract', async () => {
    const existingOrder = {
      id: 'order-1',
      organization_id: 'org-123',
      payload: {
        other_data: true,
        dropshipping_v1: { state: 'received' }
      },
      updated_at: '2023-01-01T00:00:00Z',
    };
    mockSupabase.single.mockResolvedValueOnce({ data: existingOrder, error: null });

    const snapshot = { items: [{ id: 'item-1', price: 100 }] };

    await expect(
      processDropshippingOrderTransition({
        orderId: 'order-1',
        expectedState: 'received',
        nextState: 'reviewed',
        expectedUpdatedAt: '2023-01-01T00:00:00Z',
        snapshot, // Client trying to persist snapshot
        notes: 'Looks good',
      })
    ).rejects.toThrow('BLOCKED: Cannot persist client-supplied snapshot on review');
  });

  it('fails to transition to confirmed from agent role', async () => {
    const existingOrder = {
      id: 'order-1',
      organization_id: 'org-123',
      payload: {
        dropshipping_v1: {
          state: 'submitted',
          approval_snapshot: { version: 1 }
        }
      },
      updated_at: '2023-01-01T00:00:00Z',
    };
    mockSupabase.single.mockResolvedValueOnce({ data: existingOrder, error: null });

    await expect(
      processDropshippingOrderTransition({
        orderId: 'order-1',
        expectedState: 'submitted',
        nextState: 'confirmed',
        expectedUpdatedAt: '2023-01-01T00:00:00Z',
      })
    ).rejects.toThrow('BLOCKED: confirmed transitions must be driven by verified provider webhooks');
  });

  it('fails to transition to approved if server lacks snapshot', async () => {
     const existingOrder = {
      id: 'order-1',
      organization_id: 'org-123',
      payload: {
        dropshipping_v1: {
          state: 'reviewed',
          // approval_snapshot missing from server payload
        }
      },
      updated_at: '2023-01-01T00:00:00Z',
    };
    mockSupabase.single.mockResolvedValueOnce({ data: existingOrder, error: null });

    await expect(
      processDropshippingOrderTransition({
        orderId: 'order-1',
        expectedState: 'reviewed',
        nextState: 'approved',
        expectedUpdatedAt: '2023-01-01T00:00:00Z',
        snapshot: { version: 1 },
      })
    ).rejects.toThrow('BLOCKED: Cannot approve order. A canonical server-side snapshot builder/contract is missing from dropshipping domain, meaning there is no trusted server snapshot to verify against.');
  });
});