# F1 — Identity and Tenant Isolation Design

Status: proposal only. No auth, database, schema, RLS, backfill, or production code changes are included.

## Decision boundary

Firebase Authentication becomes identity provider. Firebase `uid` is the canonical external identity and stays `text`. Existing Supabase Auth UUIDs remain legacy references during migration. No destructive conversion occurs until parity evidence and Owner approval exist.

## 1. Identity mapping

Recommended table: `identity_user_mappings`.

| Column | Type | Rules |
|---|---|---|
| `id` | `uuid` | Primary key, generated server-side |
| `firebase_uid` | `text` | Not null, unique, immutable after creation |
| `legacy_auth_user_id` | `uuid` | Nullable, unique when present |
| `email_snapshot` | `citext` | Optional operational snapshot; never authorization source |
| `status` | `text` | `active`, `pending`, `blocked`, `retired` |
| `created_at` | `timestamptz` | Not null, server default |
| `updated_at` | `timestamptz` | Not null, server default |
| `migrated_at` | `timestamptz` | Nullable |

Constraints:

- Unique `firebase_uid`.
- Unique nullable `legacy_auth_user_id`.
- Check `status` against the allowed values.
- No email uniqueness used for authorization.
- Index `firebase_uid` and `legacy_auth_user_id`.

`user_organizations.user_id` remains the canonical internal membership key during transition. Do not change its type in F1. Resolve Firebase UID to the existing internal UUID through the mapping row.

### Backfill

1. Export existing Supabase Auth users and current membership rows without exposing tokens or passwords.
2. Match Firebase users by verified provider linkage, never by unverified email alone.
3. Create one mapping per confirmed pair.
4. Put unmatched users in `pending`; do not grant membership automatically.
5. Detect duplicate Firebase UID, duplicate legacy UUID, email collision, deleted user, and missing membership.
6. Produce counts and a review file for Owner approval.
7. Enable new Firebase users only after mapping creation succeeds.

Backfill must be idempotent. It must use a transaction per identity and an immutable audit record. It must not rewrite tenant rows.

### Dual-read

- Read Firebase session and obtain `firebase_uid`.
- Resolve mapping to internal user ID.
- Read memberships using internal user ID.
- During transition, legacy Supabase session may be accepted only on an explicit compatibility path with separate metrics and expiry date.
- Never use email, Firebase custom claims, request body `user_id`, or request body `organization_id` as membership authority.

### Reversal

- Keep Supabase Auth and legacy UUID unchanged until cutover sign-off.
- Disable Firebase session acceptance with a feature flag.
- Re-enable legacy compatibility path.
- Preserve mapping rows and audit records.
- Roll back only new mapping status and routing flags; do not delete identity or membership data.

## 2. Tenant isolation in Cloud SQL

Use two independent controls:

1. Application-level tenant filtering as the first gate.
2. Native PostgreSQL RLS as defense in depth.

### Required request flow

```text
Firebase session cookie
  validateSession()
  resolve firebase_uid -> internal user id
  resolve active membership
  authorize role/action
  create TenantContext
  execute repository query
```

`TenantContext` is required for every tenant-aware repository operation. It contains:

- `userId`
- `organizationId`
- `role`
- `isPlatformAdmin`
- request ID and auth source

Rules:

- Repository methods receive `TenantContext` or use a request-scoped context that has been validated.
- A missing context throws before SQL executes.
- Every query includes tenant scope or uses a tenant-scoped SQL helper.
- `organization_id` from body, query string, path, or model output is an input candidate only. Server-resolved organization is authoritative.
- Cross-tenant IDs return not-found, not authorization details.
- Mutations verify tenant scope in both `WHERE` and changed values.
- Bulk operations require one explicit organization scope.

### PostgreSQL RLS defense

Use a dedicated application database role without `BYPASSRLS`. At transaction start, set a local tenant variable only after server authorization:

```sql
SET LOCAL app.user_id = '...';
SET LOCAL app.organization_id = '...';
SET LOCAL app.role = '...';
```

Policies compare row `organization_id` with `current_setting('app.organization_id', true)`. The transaction must use `SET LOCAL`; session-global settings are unsafe with pooled connections.

RLS policy requirements:

- `SELECT`: tenant equality.
- `INSERT`: tenant equality in `WITH CHECK`.
- `UPDATE`: tenant equality in both `USING` and `WITH CHECK`.
- `DELETE`: tenant equality in `USING`.
- Platform administration uses a separate controlled path and explicit audit, not a universal bypass role.

### Admin/service equivalent

No general service-role bypass exists in application code. Use separate service accounts:

- `app_runtime`: no `BYPASSRLS`, tenant-scoped requests only.
- `worker_runtime`: no `BYPASSRLS`; receives signed job tenant context and validates it.
- `migration_admin`: schema-only operational role, never used by request handlers.
- `platform_admin_runtime`: still subject to explicit platform-admin authorization and audit; no arbitrary tenant omission.

Any maintenance task requiring cross-tenant access runs offline, with Owner approval, explicit tenant list, short-lived credentials, and an audit receipt.

## 3. RBAC and authorization

Preserve role order and meanings:

```text
viewer < agent < manager < admin
```

Keep `platform_admins` separate from organization membership. A platform admin is not automatically an organization admin.

Central authorization service input:

```text
authorize(context, action, resource)
```

Checks, in order:

1. Valid authenticated identity.
2. Active membership for target organization.
3. Role permission for action.
4. Resource belongs to resolved organization.
5. Entitlement/module gate, when applicable.
6. Audit event for sensitive mutations.

All API, Server Action, worker, MCP, CLI, webhook, and browser execution paths use the same authorization facade. No role checks in UI are authoritative.

## 4. Deferred work

MFA, GCS migration, Supabase Realtime replacement, and storage cutover remain separate phases. They require independent design, tests, rollback, and Owner approval.

## Approval gates

Do not implement F1 until Owner approves:

- mapping table and UID compatibility;
- backfill matching policy;
- TenantContext and transaction-local RLS design;
- service account separation;
- RBAC action matrix;
- rollback and dual-read duration.
