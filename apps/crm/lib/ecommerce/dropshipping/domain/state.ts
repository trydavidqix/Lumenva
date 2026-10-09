import type { DropshippingOrder, DropshippingState } from './types';

export class InvalidTransitionError extends Error {}
export class InvalidMarketError extends Error {}
export class IllegalExecutorError extends Error {}
export class IdempotencyConflictError extends Error {}
export class InvalidModeError extends Error {}

const VALID_TRANSITIONS: Record<DropshippingState, DropshippingState[]> = {
  not_started: ['submitted'],
  submitted: ['confirmed', 'failed', 'unknown'],
  confirmed: [],
  failed: [],
  unknown: [], // Terminal, requires manual intervention or specific resolution out of band
};

export function validateMarket(market: any) {
  if (!market || typeof market !== 'object') throw new InvalidMarketError('Market config is required');
  const requiredKeys = ['currency', 'tax_cents', 'margin_cents', 'shipping_cents', 'cost_cents', 'price_cents'];
  for (const key of requiredKeys) {
    if (market[key] === undefined || market[key] === null) {
      throw new InvalidMarketError(`Market config missing ${key}`);
    }
  }
}

export function transitionState(
  order: DropshippingOrder,
  newState: DropshippingState,
  executorId: string,
  idempotencyKey: string,
  payloadHash: string
): DropshippingOrder {
  // Validate mode
  if (order.mode === 'approved_write') {
    throw new InvalidModeError('approved_write mode is disabled');
  }

  if (order.idempotency_key === idempotencyKey && order.payload_hash !== payloadHash) {
    throw new IdempotencyConflictError('Idempotency key reused with different payload');
  }

  if (order.state === newState && order.idempotency_key === idempotencyKey && order.payload_hash === payloadHash) {
    return order;
  }

  // Validate Executor lock First
  // "unknown/timeout não autoriza retry nem troca de executor"
  if (order.state === 'unknown') {
    throw new IllegalExecutorError('Cannot change executor or retry when in unknown state');
  }

  if (order.executor_id !== null && order.executor_id !== executorId) {
    throw new IllegalExecutorError('Executor ID cannot be changed once set');
  }

  // Validate state transition
  if (!VALID_TRANSITIONS[order.state].includes(newState)) {
    throw new InvalidTransitionError(`Cannot transition from ${order.state} to ${newState}`);
  }

  validateMarket(order.market);

  return {
    ...order,
    state: newState,
    executor_id: executorId,
    idempotency_key: idempotencyKey,
    payload_hash: payloadHash,
  };
}
