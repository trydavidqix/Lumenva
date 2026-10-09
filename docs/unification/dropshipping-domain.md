# Dropshipping Domain Model

This document outlines the core domain model and state machine for the dropshipping integration unification (Lumenva CRM + Social + Dropshipping), specifically enforcing contractual integrity and isolation.

## Context

The dropshipping domain model sits within `apps/crm/lib/ecommerce/dropshipping/domain`. It manages the state and progression of dropshipping orders under the constraints of strict authorization and tenant isolation.

## State Machine

The order lifecycle consists of the following states:

- **`not_started`**: Initial state of an order intent.
- **`submitted`**: Order submitted to the dropshipping provider for processing.
- **`confirmed`**: Order successfully confirmed by the provider.
- **`failed`**: Order failed to be processed by the provider (terminal).
- **`unknown`**: Order state is ambiguous/timed out (terminal).

### Valid Transitions

- `not_started` -> `submitted`
- `submitted` -> `confirmed`, `failed`, `unknown`
- `confirmed` -> (None)
- `failed` -> (None)
- `unknown` -> (None)

## Restrictions & Enforcements

1. **Market Configuration**
   - Must be fully specified: `currency`, `tax_cents`, `margin_cents`, `shipping_cents`, `cost_cents`, `price_cents`.
   - No defaults or optional fields are permitted to guarantee explicit financial awareness.

2. **Mode**
   - Valid modes: `read_only`, `simulated`, `approved_write`.
   - `approved_write` is currently disabled and transitions in this mode will be rejected (`InvalidModeError`).

3. **Idempotency**
   - Transitions strictly check `idempotency_key` and `payload_hash`.
   - A replay of the exact same state, key, and hash returns the instance silently (idempotent).
   - Reusing an `idempotency_key` with a different `payload_hash` immediately throws `IdempotencyConflictError`.

4. **Executor Locking**
   - The `executor_id` is locked once set on an order.
   - Any transition attempting to change a non-null `executor_id` throws `IllegalExecutorError`.
   - The `unknown` state strictly prohibits retries or executor changes. Any attempt to modify an order in `unknown` state will throw `IllegalExecutorError`.

## Architecture & Code Rules

- Operates in complete isolation from the main CRM database and Nuvemshop integration.
- Strictly adheres to synchronous, functional validation and transformation.
- Does not rely on external APIs, databases, or local shells for correctness. Testing is performed in CI via Vitest.
