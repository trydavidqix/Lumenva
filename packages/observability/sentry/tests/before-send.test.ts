import { describe, it, expect } from 'vitest';
import { scrubEvent } from '../src/before-send';
import { Event } from '@sentry/types';

describe('Sentry beforeSend', () => {
  it('should scrub authorization headers', () => {
    const event: Event = {
      request: {
        headers: {
          'authorization': 'Bearer super-secret-token',
          'content-type': 'application/json',
          'cookie': 'session=abc; other=def'
        }
      }
    };

    const scrubbed = scrubEvent(event);

    expect(scrubbed?.request?.headers?.['authorization']).toBe('[Filtered]');
    expect(scrubbed?.request?.headers?.['cookie']).toBe('[Filtered]');
    expect(scrubbed?.request?.headers?.['content-type']).toBe('application/json');
  });

  it('should scrub PII from request body if parsed as object', () => {
    const event: Event = {
      request: {
        data: {
          password: 'my-password',
          email: 'test@example.com',
          name: 'John Doe',
          token: 'some-token',
          safe_field: 'safe_value'
        }
      }
    };

    const scrubbed = scrubEvent(event);
    const data = scrubbed?.request?.data as Record<string, unknown>;

    expect(data.password).toBe('[Filtered]');
    expect(data.token).toBe('[Filtered]');
    expect(data.email).toBe('[Filtered PII]');
    expect(data.name).toBe('[Filtered PII]');
    expect(data.safe_field).toBe('safe_value');
  });

  it('should scrub PII from context data', () => {
    const event: Event = {
      contexts: {
        user: {
          email: 'user@example.com',
          id: '123'
        },
        custom: {
          api_key: 'sk_test_123',
          public_info: 'hello'
        }
      }
    };

    const scrubbed = scrubEvent(event);

    expect(scrubbed?.contexts?.user?.email).toBe('[Filtered PII]');
    expect(scrubbed?.contexts?.user?.id).toBe('123');
    expect(scrubbed?.contexts?.custom?.api_key).toBe('[Filtered]');
    expect(scrubbed?.contexts?.custom?.public_info).toBe('hello');
  });

  it('should not throw on null or undefined event parts', () => {
    const event: Event = {
      message: 'test error'
    };

    const scrubbed = scrubEvent(event);
    expect(scrubbed?.message).toBe('test error');
    expect(scrubbed?.request).toBeUndefined();
  });
});
