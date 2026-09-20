# Neon boundary

**Current state: local seam PASS / product runtime NOT WIRED.**

This is the intentionally small Neon boundary for the migration. It does not
install a driver, create a Neon project, run migrations, or replace the
existing Supabase repositories.

## Contract

- `resolveNeonConnection` reads an explicitly supplied URL or `DATABASE_URL`.
  Missing credentials are represented as `configured: false`; they are not
  replaced with a local or fake connection. The returned contract never
  contains the URL, so callers cannot accidentally persist or log it.
- `NeonExecutor` is the injection point for `@neondatabase/serverless` (or a
  test double). The package dependency and runtime-specific WebSocket setup
  remain outside this boundary until a separate migration task authorizes
  them.
- `sql` creates parameterized `{ text, values }` queries. Values are never
  interpolated into SQL text.
- `withIdentity` establishes subject, optional workspace, and optional claims
  using transaction-local `set_config` calls, validates that the subject is a
  UUID, and requires an active row in `public.lumenva_identities` before
  application queries. The caller must still use a database role and RLS
  policy design that cannot bypass authorization.
- `createServerNeonClient` is an explicit server-only opt-in seam. It accepts a
  previously validated authenticated session, validates its UUID identity,
  requires an explicit `runtime` (`node`, `serverless`, or `edge`), binds that
  session to `withAuthenticatedIdentity`, and refuses to create a pool unless
  `enabled: true` is supplied. It does not accept browser identity fields as
  authority. `unknown` is rejected at this boundary.

The server factory requires `runtime` explicitly. Missing or unknown values
fail closed with `Neon server-side runtime is required`. This prevents silent
transport selection but does not connect product routes to Neon.

## Runtime and pooling

The intended mapping follows Neon’s current driver guidance:

- HTTP-style one-shot queries are suitable for serverless/edge workloads.
- WebSocket `Pool`/`Client` is for session or interactive transaction needs;
  in serverless handlers it must be created, used, and closed within one
  request.
- A hostname with the Neon `-pooler` endpoint suffix is reported as pooled.
  Neon’s pooler uses PgBouncer transaction pooling, so session-level state is
  not a portable application contract. This boundary therefore uses
  transaction-local identity state.

## Evidence state

The runtime seam and negative tests are implemented and locally validated with
injected test doubles. No existing route, worker, MCP context, repository, or
Supabase provider was changed. The real Neon driver, live `DATABASE_URL`,
provider authentication, schema/role grants, RLS behavior against the product
database, and production suitability remain **NOT_PROVEN**. Supabase remains
the active authority.
