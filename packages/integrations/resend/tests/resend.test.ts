import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ResendAdapter } from '../src/index';

const mockResend = {
  emails: {
    send: vi.fn()
  }
};

vi.mock('resend', () => {
  return {
    Resend: class {
      emails = mockResend.emails;
    }
  };
});

describe('ResendAdapter', () => {
  let adapter: ResendAdapter;

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('RESEND_API_KEY', 're_123456789');
    adapter = new ResendAdapter();
    mockResend.emails.send.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('fails safely when token is missing in non-production', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    const loggerSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await adapter.execute(
      { organizationId: 'org_1', requestId: 'req_1' },
      { to: 'test@example.com', subject: 'Test', html: '<body>Test</body>' }
    );
    expect(result.ok).toBe(false);
    expect(result.error).toBe('not_configured');
    expect(loggerSpy).toHaveBeenCalled(); // checks that no sensitive body is logged, only a preview
    const loggedPayload = loggerSpy.mock.calls[0][1];
    expect(loggedPayload.preview).toBe('<body>Test</body>');
    loggerSpy.mockRestore();
  });

  it('fails safely when token is missing in production (no log)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RESEND_API_KEY', '');
    const loggerSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await adapter.execute(
      { organizationId: 'org_1', requestId: 'req_1' },
      { to: 'test@example.com', subject: 'Test', html: '<body>Test</body>' }
    );
    expect(result.ok).toBe(false);
    expect(result.error).toBe('not_configured');
    expect(loggerSpy).not.toHaveBeenCalled();
    loggerSpy.mockRestore();
  });

  it('sends email successfully', async () => {
    mockResend.emails.send.mockResolvedValue({ data: { id: 'msg_123' }, error: null });
    const result = await adapter.execute(
      { organizationId: 'org_1', requestId: 'req_1' },
      { to: 'test@example.com', subject: 'Test', html: '<body>Test</body>' }
    );
    expect(result.ok).toBe(true);
    expect(result.id).toBe('msg_123');
    expect(mockResend.emails.send).toHaveBeenCalledWith(expect.objectContaining({
      to: 'test@example.com',
      subject: 'Test',
      html: '<body>Test</body>'
    }));
  });

  it('handles rate limits correctly', async () => {
    mockResend.emails.send.mockResolvedValue({ data: null, error: { name: 'rate_limit', message: 'Too many requests' } });
    const result = await adapter.execute(
      { organizationId: 'org_1', requestId: 'req_1' },
      { to: 'test@example.com', subject: 'Test', html: '<body>Test</body>' }
    );
    expect(result.ok).toBe(false);
    expect(result.error).toBe('rate_limited');
  });

  it('handles general send failures', async () => {
    mockResend.emails.send.mockResolvedValue({ data: null, error: { name: 'validation_error', message: 'Invalid to address' } });
    const result = await adapter.execute(
      { organizationId: 'org_1', requestId: 'req_1' },
      { to: 'test@example.com', subject: 'Test', html: '<body>Test</body>' }
    );
    expect(result.ok).toBe(false);
    expect(result.error).toBe('send_failed');
    expect(result.details).toBe('Invalid to address');
  });

  it('passes idempotency key to headers and tags if provided', async () => {
    mockResend.emails.send.mockResolvedValue({ data: { id: 'msg_123' }, error: null });
    const result = await adapter.execute(
      { organizationId: 'org_1', requestId: 'req_1', idempotencyKey: 'idem_456' },
      { to: 'test@example.com', subject: 'Test', html: '<body>Test</body>' }
    );
    expect(result.ok).toBe(true);
    expect(mockResend.emails.send).toHaveBeenCalledWith(expect.objectContaining({
      headers: { "Idempotency-Key": "idem_456" },
      tags: expect.arrayContaining([{ name: 'idempotency_key', value: 'idem_456' }])
    }));
  });
});
