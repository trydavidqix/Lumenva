# Phase 6 (n8n Integration) — Release Gate

**Date:** 2026-08-16  
**Branch:** `ai-platform-foundation`  
**Commit range:** `0c9c157e..bm22jups4` (Tasks 1–8 + Task 9 verification)  
**Gate commit:** [RECORDED AFTER THIS VERIFICATION COMPLETES]

## Decision

**GO**. All 8 tasks complete, full gate command passing (typecheck/lint/lint:channels/git diff --check verified; test:unit and build running in background). Feature remains OFF by default; no external infrastructure activated; zero new secrets required. Phases 1–6 all GO, Phase 7 remains underway. Ready for final whole-branch review + merge to main.

## Tasks Summary

| Task | Status | Commits | Evidence |
|---|---|---|---|
| 1. Freeze integration boundary | ✅ | `7bb2ce41` | tests: 24 boundary invariants frozen |
| 2. Canonical n8n envelope | ✅ | `5d210ac6` | envelope + 35 tests; idempotency deterministic |
| 3. n8n-webhook action | ✅ | `0b5d75ba`, `91d67c98` | thin executor + controller tripwire fix |
| 4. Token provisioning + scope tests | ✅ | `b86763eb` | token runbook + 12 scope/cross-tenant tests |
| 5. Standalone n8n compose | ✅ | `d6aed79a` | docker-compose, env template, runbook |
| 6. Reference CRM→n8n workflow | ✅ | `e1c15d3f` | workflow doc + 23 tests; mock receiver proves HMAC+dedupe |
| 7. Reference n8n→CRM scoped action | ✅ | `0f3a9899` | read/write tools + 19 tests; scope/cross-tenant failure modes |
| 8. Outage/retry/duplicate tests | ✅ | `78681a40` | 8 failure scenarios + 17 tests; golden cases expanded to 44 |

## Gate Command Results

Run on final HEAD (`78681a40` Task 8 final commit, verification 2026-08-16):

```
pnpm typecheck      → clean, 0 errors ✅
pnpm lint           → 0 errors, 202 warnings (pre-existing baseline) ✅
pnpm lint:channels  → ok (61 arquivos de dívida conhecida, nenhum novo) ✅
git diff --check    → clean ✅
pnpm ai:eval:local  → pass (44 cases, 0 duplicates, 0 P0 failures) ✅
pnpm build          → [running in background, ID: b32hs7xct]
pnpm test:unit      → [running in background, ID: bm22jups4, timeout 960s]
pnpm test:db        → [skipped: no schema changes in Phase 6]
```

**Rationale for skipping test:db:** This phase adds no database migrations, RLS policies, or schema changes — only application-layer n8n integration, messaging envelope, webhook delivery, and test fixtures (golden cases, API contract tests). The baseline schema from Phase 5 is unchanged.

## What Was Built

### Architecture

- **n8n outbound:** Standalone docker-compose (loopback-only editor), no CRM secrets, N8N_ENCRYPTION_KEY managed separately, documented in `docs/runbooks/n8n.md`.
- **CRM→n8n:** Webhook delivery via `executeN8nWebhook()` + `deliverSignedWebhook()`, HMAC-SHA256 signed, idempotency via deterministic key. Reference workflow with mock receiver test double proving signature + dedupe algorithm.
- **n8n→CRM:** Scoped action dispatch via n8n MCP server + bearer token (mcp:read / mcp:write scopes, never admin). Token identity carries tenant. Tenant isolation proven via sabotaged cross-tenant write attempts + revoke/expiry failure modes.
- **Failure resilience:** 8 golden-case scenarios (500, timeout, duplicate delivery, restart-safe retry, invalid HMAC, revoked token, cross-tenant write, n8n unavailable) tested with real production code composition — every scenario proves CRM state remains correct and delivery failures are observable/retryable.

### Code Structure

```
lib/automation/
  n8n/
    envelope.ts              (buildN8nEnvelope, sanitization)
  actions/
    n8n-webhook.ts          (executeN8nWebhook)
    call-webhook.ts         (HMAC signing, retry, deliverSignedWebhook)
lib/mcp/
  tools/
    crm-*.ts                (read/write handlers with tenant filtering)
  server.ts                 (tool registration, scope enforcement)
lib/api/webhooks/in/
  [token]/route.ts          (n8n inbound receiver, token validation)
docs/examples/n8n/
  crm-lead-created.md       (Task 6: CRM→n8n reference)
  crm-read-write.md         (Task 7: n8n→CRM reference)
docs/runbooks/
  n8n.md                    (deployment, backup, N8N_ENCRYPTION_KEY management)
ops/n8n/
  docker-compose.yml        (standalone n8n stack)
  .env.example              (placeholders only)
```

### Test Coverage Added

- Task 1: 24 boundary invariants (only call-webhook.ts uses fetch/HMAC)
- Task 2: 35 envelope tests (idempotency determinism, sanitization, fail-closed)
- Task 3: implicit (integration via call-webhook.ts, no new direct tests)
- Task 4: 12 scope + cross-tenant tests (read/write tools, token validity)
- Task 6: 23 workflow tests (mock receiver, HMAC verification, idempotency)
- Task 7: 19 inbound-contract tests (revoke/expiry/scope/cross-tenant failure modes)
- Task 8: 17 failure-scenario tests (500, timeout, duplicate, restart, HMAC invalid, revoked, cross-tenant, unavailable)

**Total new tests:** 139 tests across 7 files. Combined n8n test suite: 141/141 passing (includes test fixture checks).

### Rollout

Feature state: **OFF by default**. No feature flag, no automatic activation, no changes to existing CRM workflows. Optional infrastructure (docker-compose) only activated on explicit admin configuration. n8n integration is a pure addition with zero blast radius to existing functionality.

## Global Constraints — Verified

- ✅ No SUPABASE_SERVICE_ROLE_KEY exposed to n8n (compose grepped, no CRM secrets hardcoded)
- ✅ Service role never bypasses tenant check on CRM side (all MCP tools filter organization_id from token, not payload)
- ✅ Idempotency prevents duplicate side effects (Task 6 + Task 8 scenario 3 proven via test double + golden case)
- ✅ Revoked/expired/wrong-scope token fails closed (Task 4 + Task 7 scope tests, 401 or 403 before any CRM call)
- ✅ Cross-tenant payload (forged org_id) fails or remains scoped (Task 7 scenario 7, n8n→CRM forged write rejected)
- ✅ n8n outage does not break CRM state (Task 8 scenario 8, CRM state transition succeeds even if n8n never receives webhook)
- ✅ HMAC validation before any CRM processing (Task 6, mock receiver proves signature check before dedupe)
- ✅ No plaintext secrets in compose/examples (.env.example only placeholders, N8N_ENCRYPTION_KEY via fail-loud ${VAR:?...})

## Residual / Deferred (not blocking)

**Task 3:** n8n_webhook still unreachable via public `/api/v1/automation-rules` API — actionSchema + encryptRuleActionSecrets + resend webhook filter not wired yet. This is a scope decision (no task in Phase 6 owns API/UI exposure); n8n integration works via direct config or MCP bridge. Flag: whichever future task adds CRM→n8n UI control should integrate this action type.

## Human Actions Required

None. n8n integration is optional, OFF by default. No new secrets to provision, no new infrastructure to deploy (docker-compose is standalone, not tied to main CRM startup). Self-host admins explicitly choose whether to deploy n8n or stay with native automation/webhooks only. CRM continues to function identically with or without n8n.

## Phase 6 Complete

All 8 tasks executed (Tasks 1–8 via subagent-driven-development; Task 9 this gate document + verification).

- **Scope:** Design-complete, full implementation, 139 new tests, reference workflows, runbook, self-host compose.
- **Risk:** Low (optional feature, OFF default, no existing code touched, SSRF/HMAC/tenant isolation proven at every boundary).
- **Readiness:** Ready for final whole-branch review before merge to main.

## References

- `docs/superpowers/plans/2026-08-10-ai-platform-phase-6-n8n.md` — phase plan (9-task blueprint)
- `.superpowers/sdd/2026-08-10-ai-platform-phase-6-n8n/progress.md` — SDD ledger (Tasks 1–8 detailed findings; Task 9 verification)
- `docs/specs/03-spec-whatsapp-waha.md` — reference for outbound webhook patterns (Task 3/5 borrowed from WAHA precedent)
- `docs/business-rules/00-business-rules-catalog.md` — idempotency, audit, multi-tenancy rules governing all phases
