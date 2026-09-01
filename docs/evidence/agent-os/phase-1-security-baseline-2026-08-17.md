# Agent OS Phase 1 — Supabase Security Baseline (2026-08-17)

**Project:** `CRM` (`idqlutosaqqqqxetepen`)  
**Purpose:** record the current security-advisor state before Agent OS autonomy work. No production changes were applied as part of this baseline.

## Important context

The repository already received a broad August 2026 security sweep (PR #17), including MCP cross-tenant fixes, AI credential/budget RLS role hardening, outbound idempotency and other controls. This baseline records what remains after those fixes.

## Remaining findings relevant to Agent OS

### 1. Mutable function search_path

WARN:

- `public.fn_agent_versions_immutable()`
- `public.fn_ai_agent_version_content_immutable()`

These functions currently have no explicit `proconfig` search path. Before agents depend on version immutability as a control-plane invariant, privileged/function resolution should be deterministic.

Remediation reference: https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

### 2. SECURITY DEFINER functions executable by `anon`

Confirmed current grants include:

- `activate_kb_version(uuid, uuid)` — `anon`, `postgres`, `service_role`
- `fn_decrypt_oauth(bytea)` — `anon`, `authenticated`, `postgres`, `service_role`
- `fn_encrypt_oauth(text)` — `anon`, `authenticated`, `postgres`, `service_role`
- `fn_lgpd_cascade_redact_contact(uuid, uuid, uuid)` — `anon`, `authenticated`, `postgres`, `service_role`
- `fn_update_budget_consumption()` — `anon`, `authenticated`, `postgres`, `service_role`
- `retrieve_top_k_chunks(uuid, uuid, vector, integer, real)` — `anon`, `authenticated`, `postgres`, `service_role`

These require per-function intent review. Agent OS must not assume an advisor warning automatically means “revoke all”; each function may have legitimate internal RPC requirements. The safe target is least privilege with server/tool-gateway ownership.

Remediation reference: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable

### 3. SECURITY DEFINER functions executable by `authenticated`

Advisor flags include functions such as:

- `emit_event(...)`
- `fn_audit_log_row()`
- `fn_can_view_conversation(...)`
- `fn_can_view_lead(...)`
- `fn_conversation_assign(...)`
- `fn_decrypt_oauth(...)`
- `fn_encrypt_oauth(...)`
- `fn_is_platform_admin()`
- `fn_lgpd_cascade_redact_contact(...)`
- `fn_log_event(...)`
- `fn_member_role_in_org(...)`
- `fn_role_at_least(...)`
- `fn_update_budget_consumption()`
- `fn_user_org_ids()`
- `fn_user_role_in(...)`
- `fn_user_role_in_org(...)`
- `retrieve_top_k_chunks(...)`

Some helper functions may intentionally be callable by authenticated users to support RLS/policy logic; others, especially credential crypto/LGPD/event-mutation functions, deserve stronger scrutiny. Do not blanket-revoke policy helper functions without checking dependency graphs.

Remediation reference: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

### 4. RLS enabled but no policy

INFO:

- `public.system_update_runs`
- `public.system_version`
- `public.watchdog_cursors`

This can be intentional when tables are service-only. Phase 1.2 must classify each explicitly instead of treating “no policy” as automatically unsafe.

Remediation reference: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

### 5. Extensions in `public`

WARN:

- `vector`
- `citext`
- `pg_trgm`

This is schema hardening, but moving extensions can have broad compatibility impact and is not required merely to start Agent OS. Treat as deferred unless an exploit path or migration-safe benefit is proven.

Remediation reference: https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public

### 6. Leaked password protection disabled

WARN: Supabase Auth leaked-password protection is disabled.

This is account-security hardening, independent from the Agent OS code path, but should be considered for production security posture.

Remediation reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Phase 1.2 classification rules

For every finding, implementation must record one of:

```text
FIX_NOW        clear agent/autonomy risk and safe migration path
HARDEN_NOW     defense-in-depth worth doing before autonomy
INTENTIONAL    required exposure with documented invariant/test
DEFER          unrelated/broad migration whose risk exceeds current benefit
```

## Production gate

No migration generated from this baseline is authorized for production merely because it exists in the branch. Every production DDL/grant change remains behind the previously agreed owner-approval gate.

## Recommended implementation order

1. Fix explicit `search_path` for the two agent-version immutability functions in a migration + tests.
2. Review OAuth crypto functions; likely restrict to trusted server/service role if application call paths permit.
3. Review `activate_kb_version`, budget update, LGPD cascade and retrieval RPC call paths; remove anonymous execution wherever not required.
4. Preserve authenticated helper functions only where they are intentionally part of RLS/application semantics and prove tenant checks.
5. Classify RLS-with-no-policy service tables.
6. Treat extension relocation as deferred unless independently justified.
7. Consider enabling leaked-password protection as a separate production-security configuration decision.
