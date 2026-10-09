# Lumenva Unified Architecture

## 1. Auth/RBAC (Lumenva)
- **Authority**: Firebase Auth session via `loadAuthUser()` and server-side verification (`verifySessionCookie()`).
- **RBAC**: Implemented in `apps/crm/lib/auth/require-role.ts`. Evaluates roles `viewer`, `agent`, `ai_operator`, `manager`, `admin` from `user_organizations` table via `resolveActiveOrg()`.
- **Tenant Scope**: Strict boundaries enforced per `organization_id` derived from verified sessions.

## 2. Jobs & Events (Lumenva)
- **Job Authority**: Events are processed via queueing and robust retries to prevent duplication.
- **Paths**: e.g., `webhook-sources/[id]/events/route.ts`, Content OS events.

## 3. Social Brain Boundaries
- **Ownership**: Adapters/Ingestion map incoming identities without blindly duplicating a CRM DB.
- **Capabilities**: Normalizes accounts, events, channels, and content (publishing/analytics) without acting outside explicit approvals.
- **Tenant Handling**: Identifiers are logically segregated by `organization_id` + `social_account`.

## 4. Dropshipping Contracts
- **Scope**: Focused on orders, markets, and events configuration mapped originally in `trydavidqix/Drop` (`src/contracts/events.ts`, `orders.ts`, `markets.ts`).
- **Implementation Status**: Handled strictly via simulation or `read_only` in development unless `approved_write` is engaged.
- **Idempotency**: All execution states (`not_started`, `submitted`, `confirmed`, `failed`, `unknown`) require specific transitions. No blind retries on `unknown` state.

## 5. Architectural Invariants
- **Approval Snapshots**: Approvals are bound strictly to specific snapshots of content or orders. Any alterations invalidate the snapshot.
- **Unknown State Handling**: If a process times out or stalls (`unknown`), automatic retry or provider switching is forbidden to avoid side effects.
- **Idempotency**: Essential across jobs and incoming webhooks to avoid duplicates. Replayed IDs are dropped gracefully.
- **Concurrent PR Locks**: Path prefixes like `apps/crm/lib/auth/`, shared schema (`migrations`), and core config MUST NOT be altered in parallel PRs.
