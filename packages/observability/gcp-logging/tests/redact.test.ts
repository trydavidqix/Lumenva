import { describe, it, expect } from 'vitest';
import { redact } from '../src/redact';

describe('redact', () => {
  it('should redact sensitive keys', () => {
    const input = {
      user_id: '123',
      password: 'supersecret',
      api_key: 'key_abc',
      authorization: 'Bearer token',
      email: 'test@example.com',
      cpf: '12345678909',
    };

    const expected = {
      user_id: '123',
      password: '[REDACTED]',
      api_key: '[REDACTED]',
      authorization: '[REDACTED]',
      email: '[REDACTED]',
      cpf: '[REDACTED]',
    };

    expect(redact(input)).toEqual(expected);
  });

  it('should redact nested sensitive keys', () => {
    const input = {
      request: {
        headers: {
          Cookie: 'session=xyz',
          'X-API-TOKEN': 'abc',
        },
        body: {
          user: {
            phone: '+123456789',
            name: 'John',
          },
        },
      },
    };

    const expected = {
      request: {
        headers: {
          Cookie: '[REDACTED]',
          'X-API-TOKEN': '[REDACTED]',
        },
        body: {
          user: {
            phone: '[REDACTED]',
            name: 'John',
          },
        },
      },
    };

    expect(redact(input)).toEqual(expected);
  });

  it('should handle arrays', () => {
    const input = [
      { id: 1, secret: 'hidden' },
      { id: 2, token: 'hidden2' },
      { id: 3, public_data: 'ok' }
    ];

    const expected = [
      { id: 1, secret: '[REDACTED]' },
      { id: 2, token: '[REDACTED]' },
      { id: 3, public_data: 'ok' }
    ];

    expect(redact(input)).toEqual(expected);
  });

  it('should handle null, undefined and primitives', () => {
    expect(redact(null)).toBeNull();
    expect(redact(undefined)).toBeUndefined();
    expect(redact('string')).toBe('string');
    expect(redact(123)).toBe(123);
  });
});
