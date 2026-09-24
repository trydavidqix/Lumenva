import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShadowHarness } from '../../lib/db/shadow-read/harness';
import { ShadowFlagProvider } from '../../lib/db/shadow-read/flags';
import { ShadowComparator } from '../../lib/db/shadow-read/comparator';
import type { TenantReadContext, DomainNormalizer, ShadowLogPayload } from '../../lib/db/shadow-read/types';
import type { ShadowMode } from '../../lib/db/shadow-read/types';
import type { Mock } from 'vitest';

describe('Shadow Read Contract', () => {
  let flags: ShadowFlagProvider;
  let comparator: ShadowComparator;
  let loggerMock: Mock<(...args: unknown[]) => unknown>;
  let harness: ShadowHarness;

  const ctx: TenantReadContext = {
    userId: 'u1',
    organizationId: 'org1',
    role: 'agent',
    requestId: 'req1'
  };

  const normalizer: DomainNormalizer<unknown, Record<string, unknown>> = {
    normalize: (row) => row as Record<string, unknown>,
    normalizeList: (rows) => [...rows] as Record<string, unknown>[]
  };

  beforeEach(() => {
    flags = new ShadowFlagProvider();
    comparator = new ShadowComparator();
    loggerMock = vi.fn();
    harness = new ShadowHarness({ flags, comparator, logger: (payload: ShadowLogPayload) => loggerMock(payload), timeoutMs: 50 });
  });

  it('should bypass shadow path when flag is OFF', async () => {
    flags.setFlag('test-domain', 'org1', 'off');

    const legacyFn = vi.fn().mockResolvedValue({ id: 1 });
    const shadowFn = vi.fn().mockResolvedValue({ id: 1 });

    const result = await harness.run(ctx, 'test-domain', 'findById', legacyFn, shadowFn, normalizer);

    expect(result).toEqual({ id: 1 });
    expect(legacyFn).toHaveBeenCalledOnce();
    expect(shadowFn).not.toHaveBeenCalled();
    expect(loggerMock).not.toHaveBeenCalled();
  });

  it('should run shadow path and detect field mismatch in observe mode', async () => {
    flags.setFlag('test-domain', 'org1', 'observe');

    const legacyFn = vi.fn().mockResolvedValue({ id: 1, name: 'old' });
    const shadowFn = vi.fn().mockResolvedValue({ id: 1, name: 'new' });

    const result = await harness.run(ctx, 'test-domain', 'findById', legacyFn, shadowFn, normalizer);

    expect(result).toEqual({ id: 1, name: 'old' }); // Always returns legacy
    expect(legacyFn).toHaveBeenCalledOnce();
    expect(shadowFn).toHaveBeenCalledOnce();

    expect(loggerMock).toHaveBeenCalledOnce();
    const logCall = loggerMock.mock.calls[0]?.[0] as ShadowLogPayload | undefined;
    expect(logCall?.mismatch_type).toBe('field');
    expect(logCall?.differences).toEqual([{ path: 'name' }]);
    expect(JSON.stringify(logCall)).not.toContain('old');
    expect(JSON.stringify(logCall)).not.toContain('new');
  });

  it('should timeout shadow path and NOT fail legacy response', async () => {
    flags.setFlag('test-domain', 'org1', 'observe');

    const legacyFn = vi.fn().mockResolvedValue({ id: 1 });
    const shadowFn = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ id: 1 }), 100)));

    const result = await harness.run(ctx, 'test-domain', 'findById', legacyFn, shadowFn, normalizer);

    expect(result).toEqual({ id: 1 }); // Still returns legacy
    expect(loggerMock).toHaveBeenCalledOnce();
    const logCall = loggerMock.mock.calls[0]?.[0] as ShadowLogPayload | undefined;
    expect(logCall?.mismatch_type).toBe('timeout');
  });

  it('should catch shadow connection error and NOT fail legacy response', async () => {
    flags.setFlag('test-domain', 'org1', 'observe');

    const legacyFn = vi.fn().mockResolvedValue({ id: 1 });
    const shadowFn = vi.fn().mockRejectedValue(new Error('Connection failed'));

    const result = await harness.run(ctx, 'test-domain', 'findById', legacyFn, shadowFn, normalizer);

    expect(result).toEqual({ id: 1 }); // Still returns legacy
    expect(loggerMock).toHaveBeenCalledOnce();
    const logCall = loggerMock.mock.calls[0]?.[0] as ShadowLogPayload | undefined;
    expect(logCall?.mismatch_type).toBe('error');
    expect(logCall).not.toHaveProperty('error');
    expect(JSON.stringify(logCall)).not.toContain('Connection failed');
  });

  it('should enforce rollback on authorization mismatch', async () => {
    flags.setFlag('test-domain', 'org1', 'observe');

    const legacyFn = vi.fn().mockResolvedValue({ id: 1, organization_id: 'org1' });
    const shadowFn = vi.fn().mockResolvedValue({ id: 1, organization_id: 'org2' });

    await harness.run(ctx, 'test-domain', 'findById', legacyFn, shadowFn, normalizer);

    expect(loggerMock).toHaveBeenCalledOnce();
    const logCall = loggerMock.mock.calls[0]?.[0] as ShadowLogPayload | undefined;
    expect(logCall?.mismatch_type).toBe('authorization');

    // Check that rollback occurred
    expect(flags.getFlag('test-domain', 'org1')).toBe('off');
  });

  it('should return shadow result if in enforced mode', async () => {
    flags.setFlag('test-domain', 'org1', 'enforced');

    const legacyFn = vi.fn().mockResolvedValue({ id: 1, organization_id: 'org1', val: 'old' });
    const shadowFn = vi.fn().mockResolvedValue({ id: 1, organization_id: 'org1', val: 'old' });

    const result = await harness.run(ctx, 'test-domain', 'findById', legacyFn, shadowFn, normalizer);

    expect(result).toEqual({ id: 1, organization_id: 'org1', val: 'old' }); // Returns validated shadow
  });

  it('falls back to legacy in enforced mode when a shadow row has another tenant id', async () => {
    flags.setFlag('test-domain', 'org1', 'enforced');
    const legacy = { id: 'lead-1', organization_id: 'org1' };
    const legacyFn = vi.fn().mockResolvedValue(legacy);
    const shadowFn = vi.fn().mockResolvedValue({ id: 'lead-2', organization_id: 'org2' });

    const result = await harness.run(ctx, 'test-domain', 'findById', legacyFn, shadowFn, normalizer);

    expect(result).toEqual(legacy);
    expect(loggerMock).toHaveBeenCalledOnce();
    const logCall = loggerMock.mock.calls[0]?.[0] as ShadowLogPayload | undefined;
    expect(logCall?.mismatch_type).toBe('authorization');
  });

  it('times out enforced shadow reads and returns the legacy result', async () => {
    flags.setFlag('test-domain', 'org1', 'enforced');
    const legacyFn = vi.fn().mockResolvedValue({ id: 'lead-1', organization_id: 'org1' });
    const shadowFn = vi.fn().mockImplementation(() => new Promise(() => {}));

    const result = await harness.run(ctx, 'test-domain', 'findById', legacyFn, shadowFn, normalizer);

    expect(result).toEqual({ id: 'lead-1', organization_id: 'org1' });
    expect(loggerMock).toHaveBeenCalledOnce();
    expect((loggerMock.mock.calls[0]?.[0] as ShadowLogPayload).mismatch_type).toBe('timeout');
  });

  it('keeps platform_admin reads on the legacy path', async () => {
    flags.setFlag('test-domain', 'org1', 'enforced');
    const platformAdminContext = { ...ctx, role: 'platform_admin' } as unknown as TenantReadContext;
    const legacyFn = vi.fn().mockResolvedValue({ id: 'tenant-list' });
    const shadowFn = vi.fn().mockResolvedValue({ id: 'shadow-tenant-list' });

    const result = await harness.run(platformAdminContext, 'test-domain', 'listTenants', legacyFn, shadowFn, normalizer);

    expect(result).toEqual({ id: 'tenant-list' });
    expect(shadowFn).not.toHaveBeenCalled();
  });

  it.each(['enabled', 'true', 'yes', true, 1, null])('fails closed for invalid runtime flag value %s', (invalidValue) => {
    flags.setFlag('test-domain', 'org1', invalidValue as unknown as ShadowMode);

    expect(flags.getFlag('test-domain', 'org1')).toBe('off');
  });

  it.each(['viewer', 'agent', 'manager', 'admin'] as const)(
    'preserves %s RBAC result when enforced shadow output differs', async (role) => {
      flags.setFlag('test-domain', 'org1', 'enforced');
      const roleContext = { ...ctx, role };
      const legacy = { id: 'conversation-1', organization_id: 'org1', assigned_to_user_id: 'visible-to-role' };
      const legacyFn = vi.fn().mockResolvedValue(legacy);
      const shadowFn = vi.fn().mockResolvedValue({ ...legacy, assigned_to_user_id: 'other-agent' });

      const result = await harness.run(roleContext, 'test-domain', 'findConversation', legacyFn, shadowFn, normalizer);

      expect(result).toEqual(legacy);
    }
  );

  it('should fallback to legacy if shadow fails in enforced mode', async () => {
    flags.setFlag('test-domain', 'org1', 'enforced');

    const legacyFn = vi.fn().mockResolvedValue({ id: 1, val: 'legacy-fallback' });
    const shadowFn = vi.fn().mockRejectedValue(new Error('Shadow DB down'));

    const result = await harness.run(ctx, 'test-domain', 'findById', legacyFn, shadowFn, normalizer);

    expect(result).toEqual({ id: 1, val: 'legacy-fallback' }); // Returns legacy as fallback
    expect(loggerMock).toHaveBeenCalledOnce();
    const logCall = loggerMock.mock.calls[0]?.[0] as ShadowLogPayload | undefined;
    expect(logCall?.mismatch_type).toBe('error');
    expect(logCall).not.toHaveProperty('error');
    expect(JSON.stringify(logCall)).not.toContain('Shadow DB down');
  });
});
