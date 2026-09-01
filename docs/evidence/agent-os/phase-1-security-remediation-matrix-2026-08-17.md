# Agent OS Phase 1 — Security Remediation Matrix (2026-08-17)

This matrix turns the current Supabase advisor baseline into implementation decisions for Phase 1.2. It is intentionally non-destructive: no production DDL or auth setting is applied by this document.

## Decision classes

- `FIX_NOW` — clear autonomy/security risk with narrow, testable remediation.
- `HARDEN_NOW` — defense-in-depth worth completing before wider agent autonomy.
- `INTENTIONAL` — current exposure is required; document invariant and add regression evidence.
- `DEFER` — unrelated/broad migration whose risk exceeds immediate Agent OS benefit.

## Matrix

| Finding | Current classification | Agent OS risk | Proposed action | Production gate |
|---|---|---:|---|---|
| `fn_agent_versions_immutable()` mutable `search_path` | FIX_NOW | Medium | Set deterministic `search_path` in a narrow migration; preserve body/ownership/grants. Add regression evidence that immutability trigger behavior is unchanged. | Required before applying migration |
| `fn_ai_agent_version_content_immutable()` mutable `search_path` | FIX_NOW | Medium | Same as above. | Required before applying migration |
| `fn_decrypt_oauth(bytea)` executable by `anon/authenticated` | HARDEN_NOW | High | Trace all call paths. Preferred end state: trusted server/service role only unless a proven authenticated RPC use exists. Never expose plaintext through agent tools. | Required before grant changes |
| `fn_encrypt_oauth(text)` executable by `anon/authenticated` | HARDEN_NOW | High | Trace all call paths. Preferred end state: trusted server/service role only unless proven otherwise. | Required before grant changes |
| `fn_lgpd_cascade_redact_contact(...)` executable by `anon/authenticated` | HARDEN_NOW | High | Remove `anon`; require explicit trusted role / controlled server capability. Preserve LGPD workflow behavior with tests. | Required before grant changes |
| `activate_kb_version(...)` executable by `anon` | HARDEN_NOW | High | Remove anonymous execution if no public call path exists; require org-scoped server/tool-gateway path. | Required before grant changes |
| `fn_update_budget_consumption()` executable by `anon/authenticated` | HARDEN_NOW | High | Prefer internal execution only; ensure user/agent cannot forge usage/cost consumption. | Required before grant changes |
| `retrieve_top_k_chunks(...)` executable by `anon/authenticated` | REVIEW | Medium/High | Confirm RLS/org filter semantics and application usage. Anonymous access should be removed unless there is an explicit public product requirement. Authenticated use may remain only with tenant-safe filtering. | Required before grant changes |
| `emit_event(...)` executable by `authenticated` | REVIEW | Medium | Preserve only if application clients legitimately emit events and function validates tenant/entity semantics. Otherwise move emission behind server capability. | Required if grants change |
| RLS enabled, no policy: `system_update_runs` | INTENTIONAL candidate | Low | Verify service-only table. If service-only, document deny-by-default as intentional and test app roles cannot read/write. | No production change if intentional |
| RLS enabled, no policy: `system_version` | INTENTIONAL candidate | Low | Same classification process. | No production change if intentional |
| RLS enabled, no policy: `watchdog_cursors` | INTENTIONAL candidate | Low | Same classification process. | No production change if intentional |
| `vector`, `citext`, `pg_trgm` in public | DEFER | Low for Agent OS | Do not relocate in Phase 1 unless an independent exploit/compatibility reason appears. | N/A |
| Leaked-password protection disabled | HARDEN_NOW (account security) | Medium | Enable as a separate production auth-setting change after owner review; unrelated to code migration. | Explicit owner approval |

## Implementation order

1. Prepare deterministic `search_path` migration for the two agent-version immutability functions.
2. Inventory repository call sites for OAuth crypto, LGPD cascade, KB activation, budget consumption, retrieval and event emission.
3. Build a grant-intent table from call-site evidence before changing any function privileges.
4. Add regression/adversarial tests for cross-tenant and unauthorized invocation paths where the repository already has DB-test infrastructure.
5. Prepare privilege-hardening migrations only after call-path evidence exists.
6. Keep all migrations unapplied to production until the owner gate.

## Non-negotiable invariants

- Agent code never receives a general-purpose database privilege merely to simplify a tool.
- Credential encryption/decryption is not directly exposed as an agent capability.
- A user or model cannot self-report/forge budget consumption through a broadly executable RPC.
- LGPD destructive/redaction actions remain explicit, auditable and privileged.
- Knowledge retrieval must remain tenant-scoped even if callable by authenticated users.
- Event emission cannot become a generic way to manufacture privileged downstream work.

## Evidence limitations

The current connector can read Supabase advisor metadata, but direct SQL execution is not authorized in this session. Therefore this matrix does not claim live grant-body verification beyond the advisor/baseline evidence already captured. Repository call-path analysis and migration preparation can proceed safely; production verification remains a later gate.
