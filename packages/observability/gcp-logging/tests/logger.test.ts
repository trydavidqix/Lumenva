import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../src/logger';

describe('logger', () => {
  beforeEach(() => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should output structured JSON', () => {
    const stdoutSpy = vi.mocked(process.stdout.write);
    logger.info('test message');
    expect(stdoutSpy).toHaveBeenCalled();
    const callArg = stdoutSpy.mock.calls[0][0];
    const parsed = JSON.parse(String(callArg));

    expect(parsed.message).toBe('test message');
    expect(parsed.severity).toBe('INFO');
    expect(parsed.level).toBe('info');
    expect(parsed.timestamp).toBeDefined();
  });

  it('should output structured JSON to stderr for errors', () => {
    const stderrSpy = vi.mocked(process.stderr.write);
    logger.error('error message');
    expect(stderrSpy).toHaveBeenCalled();
    const callArg = stderrSpy.mock.calls[0][0];
    const parsed = JSON.parse(String(callArg));

    expect(parsed.message).toBe('error message');
    expect(parsed.severity).toBe('ERROR');
  });

  it('should redact sensitive fields in context', () => {
    const stdoutSpy = vi.mocked(process.stdout.write);
    logger.info('user login', {
      user_id: '123',
      password: 'mypassword',
      organization_id: 'org_1',
    });

    const callArg = stdoutSpy.mock.calls[0][0];
    const parsed = JSON.parse(String(callArg));

    expect(parsed.password).toBe('[REDACTED]');
    expect(parsed.user_id).toBe('123');
    expect(parsed.organization_id).toBe('org_1');
  });

  it('should include GCP trace format', () => {
    const stdoutSpy = vi.mocked(process.stdout.write);
    logger.debug('trace test', {
      trace_id: 'projects/my-project/traces/123456',
      request_id: 'req_1',
    });

    const callArg = stdoutSpy.mock.calls[0][0];
    const parsed = JSON.parse(String(callArg));

    expect(parsed['logging.googleapis.com/trace']).toBe('projects/my-project/traces/123456');
    expect(parsed.request_id).toBe('req_1');
  });

  it('should format Error objects properly instead of swallowing them', () => {
    const stderrSpy = vi.mocked(process.stderr.write);
    const error = new Error('Database connection failed');
    logger.error('System failed', { error });

    const callArg = stderrSpy.mock.calls[0][0];
    const parsed = JSON.parse(String(callArg));

    expect(parsed.message).toBe('System failed');
    expect(parsed.severity).toBe('ERROR');
    expect(parsed.error).toBeDefined();
    expect(parsed.error.message).toBe('Database connection failed');
    expect(parsed.error.name).toBe('Error');
    expect(parsed.error.stack).toBeDefined();
  });
});
