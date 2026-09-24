import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NuvemshopAdapter } from '../src/index';

describe('NuvemshopAdapter', () => {
  let adapter: NuvemshopAdapter;
  let mockFetch: ReturnType<typeof vi.fn<typeof fetch>>;

  beforeEach(() => {
    adapter = new NuvemshopAdapter({ retryDelaysMs: [], callbackBaseUrl: '' });
    mockFetch = vi.fn<typeof fetch>();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ id: 123, name: 'My Store' }), { status: 200 }));

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
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ id: 10, event: 'app/uninstalled', url: 'https://a.b' }), { status: 201 }));

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

  it.each([
    'http://example.com/hook',
    'https://localhost/hook',
    'https://crm.localhost/hook',
    'https://127.0.0.1/hook',
    'https://10.1.2.3/hook',
    'https://172.16.0.1/hook',
    'https://192.168.1.2/hook',
    'https://169.254.169.254/latest/meta-data',
    'https://[::1]/hook',
    'https://[fc00::1]/hook',
    'https://8.8.8.8/hook',
    'https://metadata.google.internal/hook',
  ])('rejects non-public callback URL %s without a request', async (url) => {
    const result = await adapter.execute(
      { organizationId: 'org_1', requestId: 'req_1' },
      { type: 'create_webhook', storeId: '123', token: 'token', event: 'app/uninstalled', url }
    );

    expect(result).toMatchObject({ ok: false, error: 'invalid_webhook_url' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('requires a public callback host to match the configured application URL', async () => {
    const configuredAdapter = new NuvemshopAdapter({
      retryDelaysMs: [],
      callbackBaseUrl: 'https://crm.example.com',
    });

    const result = await configuredAdapter.execute(
      { organizationId: 'org_1', requestId: 'req_1' },
      { type: 'create_webhook', storeId: '123', token: 'token', event: 'app/uninstalled', url: 'https://attacker.example/hook' }
    );

    expect(result).toMatchObject({ ok: false, error: 'invalid_webhook_url' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('uses the configured public WAHA or app base host when no option is passed', async () => {
    vi.stubEnv('WAHA_WEBHOOK_BASE_URL', 'https://crm.example.com/waha');
    const environmentAdapter = new NuvemshopAdapter({ retryDelaysMs: [] });

    const result = await environmentAdapter.execute(
      { organizationId: 'org_1', requestId: 'req_1' },
      { type: 'create_webhook', storeId: '123', token: 'token', event: 'app/uninstalled', url: 'https://different.example/hook' }
    );

    expect(result).toMatchObject({ ok: false, error: 'invalid_webhook_url' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('allows the configured public application host as callback', async () => {
    const configuredAdapter = new NuvemshopAdapter({
      retryDelaysMs: [],
      callbackBaseUrl: 'https://crm.example.com/base',
    });
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ id: 10 }), { status: 201 }));

    const result = await configuredAdapter.execute(
      { organizationId: 'org_1', requestId: 'req_1' },
      { type: 'create_webhook', storeId: '123', token: 'token', event: 'app/uninstalled', url: 'https://crm.example.com/api/hook' }
    );

    expect(result.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    'http://api.nuvemshop.com.br/v1',
    'https://attacker.example/v1',
    'https://api.nuvemshop.com.br:8443/v1',
  ])('rejects an unsafe Nuvemshop API base %s before network access', async (apiBase) => {
    const unsafeAdapter = new NuvemshopAdapter({ retryDelaysMs: [], apiBase });

    const result = await unsafeAdapter.execute(
      { organizationId: 'org_1', requestId: 'req_1' },
      { type: 'get_store', storeId: '123', token: 'token' }
    );

    expect(result).toMatchObject({ ok: false, error: 'invalid_api_url' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('disallows redirects on outbound Nuvemshop API calls', async () => {
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ id: 123 }), { status: 200 }));

    await adapter.execute(
      { organizationId: 'org_1', requestId: 'req_1' },
      { type: 'get_store', storeId: '123', token: 'token' }
    );

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ redirect: 'error' })
    );
  });

  it('accepts the official Tiendanube API hostname', async () => {
    const tiendanubeAdapter = new NuvemshopAdapter({
      retryDelaysMs: [],
      apiBase: 'https://api.tiendanube.com/v1',
      callbackBaseUrl: '',
    });
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ id: 123 }), { status: 200 }));

    const result = await tiendanubeAdapter.execute(
      { organizationId: 'org_1', requestId: 'req_1' },
      { type: 'get_store', storeId: '123', token: 'token' }
    );

    expect(result.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('https://api.tiendanube.com/v1/'),
      expect.any(Object)
    );
  });

  it('handles rate limits with retries', async () => {
    // 1st request 429, 2nd request 200
    mockFetch
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 123, name: 'My Store' }), { status: 200 }));

    // Set custom retry adapter
    const retryAdapter = new NuvemshopAdapter({ retryDelaysMs: [10], sleep: () => Promise.resolve() });

    const result = await retryAdapter.execute(
      { organizationId: 'org_1', requestId: 'req_1' },
      { type: 'get_store', storeId: '123', token: 'token' }
    );

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ id: 123, name: 'My Store' });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('returns rate_limited error when retries exhausted', async () => {
    mockFetch.mockResolvedValue(new Response('', { status: 429 }));

    const retryAdapter = new NuvemshopAdapter({ retryDelaysMs: [10], sleep: () => Promise.resolve() });

    const result = await retryAdapter.execute(
      { organizationId: 'org_1', requestId: 'req_1' },
      { type: 'get_store', storeId: '123', token: 'token' }
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBe('rate_limited');
  });
});
