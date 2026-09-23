import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NuvemshopAdapter } from '../src/index';

describe('NuvemshopAdapter', () => {
  let adapter: NuvemshopAdapter;

  beforeEach(() => {
    adapter = new NuvemshopAdapter({ retryDelaysMs: [] });
    // mock global fetch
    global.fetch = vi.fn();
  });

  it('rejects execution when storeId or token is missing', async () => {
    const result = await adapter.execute(
      { organizationId: 'org_1', requestId: 'req_1' },
      { type: 'get_store', storeId: '', token: 't1' }
    );
    expect(result.ok).toBe(false);
    expect(result.error).toBe('not_configured');

    const result2 = await adapter.execute(
      { organizationId: 'org_1', requestId: 'req_1' },
      { type: 'get_store', storeId: 's1', token: '' }
    );
    expect(result2.ok).toBe(false);
    expect(result2.error).toBe('not_configured');
  });

  it('handles get_store successfully', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: 123, name: 'My Store' })
    });

    const result = await adapter.execute(
      { organizationId: 'org_1', requestId: 'req_1' },
      { type: 'get_store', storeId: '123', token: 'token' }
    );

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ id: 123, name: 'My Store' });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/123/store'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authentication: 'bearer token'
        })
      })
    );
  });

  it('handles webhooks valid creation', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 201,
      text: async () => JSON.stringify({ id: 10, event: 'app/uninstalled', url: 'https://a.b' })
    });

    const result = await adapter.execute(
      { organizationId: 'org_1', requestId: 'req_1' },
      { type: 'create_webhook', storeId: '123', token: 'token', event: 'app/uninstalled', url: 'https://a.b' }
    );

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ id: 10, event: 'app/uninstalled', url: 'https://a.b' });
  });

  it('rejects invalid webhook domains (SSRF protection)', async () => {
    const result = await adapter.execute(
      { organizationId: 'org_1', requestId: 'req_1' },
      { type: 'create_webhook', storeId: '123', token: 'token', event: 'app/uninstalled', url: 'http://localhost/test' }
    );
    expect(result.ok).toBe(false);
    expect(result.error).toBe('invalid_webhook_url');
  });

  it('handles rate limits with retries', async () => {
    // 1st request 429, 2nd request 200
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => ''
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: 123, name: 'My Store' })
      });

    // Set custom retry adapter
    const retryAdapter = new NuvemshopAdapter({ retryDelaysMs: [10], sleep: () => Promise.resolve() });

    const result = await retryAdapter.execute(
      { organizationId: 'org_1', requestId: 'req_1' },
      { type: 'get_store', storeId: '123', token: 'token' }
    );

    expect(result.ok).toBe(true);
    expect(result.data?.id).toBe(123);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('returns rate_limited error when retries exhausted', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => ''
    });

    const retryAdapter = new NuvemshopAdapter({ retryDelaysMs: [10], sleep: () => Promise.resolve() });

    const result = await retryAdapter.execute(
      { organizationId: 'org_1', requestId: 'req_1' },
      { type: 'get_store', storeId: '123', token: 'token' }
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe('rate_limited');
  });
});
