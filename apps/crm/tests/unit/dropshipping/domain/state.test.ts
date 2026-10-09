import { describe, expect, test } from 'vitest';
import { transitionState, validateMarket, InvalidMarketError, InvalidTransitionError, IllegalExecutorError, IdempotencyConflictError, InvalidModeError } from '../../../../lib/ecommerce/dropshipping/domain/state';
import type { DropshippingOrder } from '../../../../lib/ecommerce/dropshipping/domain/types';

describe('Dropshipping Domain State Machine', () => {
  const validMarket = {
    currency: 'BRL',
    tax_cents: 0,
    margin_cents: 0,
    shipping_cents: 0,
    cost_cents: 0,
    price_cents: 0,
  };

  const createBaseOrder = (overrides?: Partial<DropshippingOrder>): DropshippingOrder => ({
    tenant_id: 'tenant-1',
    idempotency_key: 'key-1',
    payload_hash: 'hash-1',
    executor_id: null,
    state: 'not_started',
    mode: 'simulated',
    market: { ...validMarket },
    receipts: [],
    ...overrides,
  });

  describe('validateMarket', () => {
    test('passes valid market', () => {
      expect(() => validateMarket(validMarket)).not.toThrow();
    });

    test('fails if a cents field is missing or not a number', () => {
      const invalidMarket = { ...validMarket } as Record<string, unknown>;
      delete invalidMarket.tax_cents;
      expect(() => validateMarket(invalidMarket)).toThrow(InvalidMarketError);
      expect(() => validateMarket(invalidMarket)).toThrow('Market config invalid tax_cents');

      const invalidMarket2 = { ...validMarket, shipping_cents: '100' } as Record<string, unknown>;
      expect(() => validateMarket(invalidMarket2)).toThrow(InvalidMarketError);
    });

    test('fails if currency is missing or empty string', () => {
      const invalidMarket = { ...validMarket, currency: '' } as Record<string, unknown>;
      expect(() => validateMarket(invalidMarket)).toThrow(InvalidMarketError);
      expect(() => validateMarket(invalidMarket)).toThrow('Market config missing currency or currency is empty');

      const invalidMarket2 = { ...validMarket } as Record<string, unknown>;
      delete invalidMarket2.currency;
      expect(() => validateMarket(invalidMarket2)).toThrow(InvalidMarketError);
    });

    test('fails if cents are negative', () => {
      const invalidMarket = { ...validMarket, cost_cents: -10 } as Record<string, unknown>;
      expect(() => validateMarket(invalidMarket)).toThrow(InvalidMarketError);
      expect(() => validateMarket(invalidMarket)).toThrow('Market config invalid cost_cents: must be a finite nonnegative integer');
    });

    test('fails if cents are fractional', () => {
      const invalidMarket = { ...validMarket, cost_cents: 10.5 } as Record<string, unknown>;
      expect(() => validateMarket(invalidMarket)).toThrow(InvalidMarketError);
      expect(() => validateMarket(invalidMarket)).toThrow('Market config invalid cost_cents: must be a finite nonnegative integer');
    });

    test('fails if cents are infinity or NaN', () => {
      const invalidMarket = { ...validMarket, margin_cents: NaN } as Record<string, unknown>;
      expect(() => validateMarket(invalidMarket)).toThrow(InvalidMarketError);
      const invalidMarket2 = { ...validMarket, margin_cents: Infinity } as Record<string, unknown>;
      expect(() => validateMarket(invalidMarket2)).toThrow(InvalidMarketError);
    });
  });

  describe('transitionState', () => {
    test('enforces disabled approved_write mode', () => {
      const order = createBaseOrder({ mode: 'approved_write' });
      expect(() => transitionState(order, 'submitted', 'exec-1', 'key-1', 'hash-1')).toThrow(InvalidModeError);
    });

    test('allows valid transition from not_started to submitted', () => {
      const order = createBaseOrder();
      const nextOrder = transitionState(order, 'submitted', 'exec-1', 'key-1', 'hash-1');
      expect(nextOrder.state).toBe('submitted');
      expect(nextOrder.executor_id).toBe('exec-1');
    });

    test('blocks invalid transition', () => {
      const order = createBaseOrder({ state: 'confirmed' });
      expect(() => transitionState(order, 'submitted', 'exec-1', 'key-2', 'hash-2')).toThrow(InvalidTransitionError);
    });

    test('enforces idempotency conflict on payload mismatch', () => {
      const order = createBaseOrder({ idempotency_key: 'key-1', payload_hash: 'hash-1', state: 'submitted', executor_id: 'exec-1' });
      expect(() => transitionState(order, 'confirmed', 'exec-1', 'key-1', 'hash-2')).toThrow(IdempotencyConflictError);
    });

    test('allows strict replay on same state, key, and hash', () => {
      const order = createBaseOrder({ state: 'submitted', idempotency_key: 'key-1', payload_hash: 'hash-1', executor_id: 'exec-1' });
      const nextOrder = transitionState(order, 'submitted', 'exec-1', 'key-1', 'hash-1');
      expect(nextOrder).toBe(order); // Returns the same instance
    });

    test('locks executor ID once set', () => {
      const order = createBaseOrder({ state: 'submitted', executor_id: 'exec-1' });
      expect(() => transitionState(order, 'confirmed', 'exec-2', 'key-2', 'hash-2')).toThrow(IllegalExecutorError);
      expect(() => transitionState(order, 'confirmed', 'exec-2', 'key-2', 'hash-2')).toThrow('Executor ID cannot be changed once set');
    });

    test('locks unknown state from retry or executor change', () => {
      const order = createBaseOrder({ state: 'unknown', executor_id: 'exec-1' });

      expect(() => transitionState(order, 'submitted', 'exec-1', 'key-2', 'hash-2')).toThrow(IllegalExecutorError);
      expect(() => transitionState(order, 'unknown', 'exec-2', 'key-2', 'hash-2')).toThrow(IllegalExecutorError);
    });
  });
});
