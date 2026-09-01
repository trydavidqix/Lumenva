# Agent OS Phase 1.6 Safe Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish Agent OS Phase 1.6 (Skills + Evals) without touching the shared 44-case legacy golden fixture, without large GitHub writes, and with one observed RED gate plus one final GREEN gate in Vercel.

**Architecture:** Keep the existing skill runtime intact and expose the new governance helpers through the current `lib/agent-engine/agent/skills.ts` surface. Move Agent OS 1.6 eval coverage into a dedicated small fixture at `tests/fixtures/agent-os/phase-1-6-golden-cases.json`, leaving `tests/fixtures/ai-platform/golden-cases.json` unchanged. The implementation branch remains the source of truth; `agent-os-verification` is only a transport branch for Vercel gates.

**Tech Stack:** TypeScript, Vitest, Next.js, GitHub, Vercel.

## Global Constraints

- Never modify `main` or production.
- Do not apply database migrations.
- Do not touch billing, secrets, or real customer actions.
- Do not modify `tests/fixtures/ai-platform/golden-cases.json` during Phase 1.6.
- On any GitHub 502, do not immediately retry the write; first read the branch/file to determine whether the operation landed.
- Before every write to `agent-os-implementation-plan`, verify the branch head is the expected SHA. If it changed unexpectedly, stop and investigate before writing.
- Do not use `create_tree -> create_commit -> update_ref` for normal implementation writes on `agent-os-implementation-plan`; use small `create_file` / `update_file` operations only.
- `agent-os-verification` may use ref movement because it is a disposable transport branch, never the implementation source of truth.
- TDD order is mandatory: observed RED -> minimal GREEN -> final fresh verification.

---

### Task 1: Freeze and audit the current Phase 1.6 state

**Files:**
- Read: `lib/agent-engine/contracts/skill-lifecycle.test.ts`
- Read: `lib/agent-engine/contracts/skill-registry-governance.test.ts`
- Read: `lib/agent-engine/contracts/skill-progressive-disclosure.test.ts`
- Read: `lib/agent-engine/contracts/skill-tool-compatibility.test.ts`
- Read: `lib/agent-engine/contracts/agent-os-golden-dataset.test.ts`
- Read: `lib/agent-engine/contracts/skill-promotion-gate.test.ts`
- Read: `lib/agent-engine/agent/skills.ts`
- Read: `lib/agent-engine/agent/skill-governance.ts`

**Produces:** a frozen expected branch SHA and a list of already-GREEN implementation pieces versus missing pieces.

- [ ] Verify `agent-os-implementation-plan` head and record the SHA.
- [ ] Confirm the six Phase 1.6 RED suites still exist and have not been edited unexpectedly.
- [ ] Confirm `skill-governance.ts` exposes lifecycle, registry, disclosure limits, tool compatibility, promotion gate, and rollback helpers.
- [ ] Confirm `skills.ts` re-exports those helpers while preserving the legacy runtime.
- [ ] Do not write code in this task.

### Task 2: Isolate the Agent OS golden dataset from the legacy fixture

**Files:**
- Modify: `lib/agent-engine/contracts/agent-os-golden-dataset.test.ts`
- Create: `tests/fixtures/agent-os/phase-1-6-golden-cases.json`
- Must not modify: `tests/fixtures/ai-platform/golden-cases.json`

**Interfaces:**
- The test reads only `tests/fixtures/agent-os/phase-1-6-golden-cases.json`.
- Each governed case has: `id`, `scenario`, and `expected` containing `expected_facts`, `allowed_tools`, `forbidden_actions`, `expected_escalation`, `expected_policy_outcome`, `scoring`.

- [ ] Update only the fixture path in `agent-os-golden-dataset.test.ts` from the shared AI-platform fixture to `tests/fixtures/agent-os/phase-1-6-golden-cases.json`.
- [ ] Create a deliberately incomplete dedicated fixture containing only one valid governed case, for example `customer_asks_price`.
- [ ] Verify the legacy fixture blob SHA is unchanged before and after this task.
- [ ] Commit these two small files separately or in one small commit.

### Task 3: Observe the corrected RED in Vercel

**Files:**
- No production code changes.
- Transport only: `agent-os-verification`.

**Expected RED:** `agent-os-golden-dataset.test.ts` fails because 12 required scenarios are missing. Existing earlier Agent OS suites should remain green.

- [ ] Verify the implementation branch head SHA after Task 2.
- [ ] Point `agent-os-verification` at that exact SHA.
- [ ] If ref movement alone does not create a Preview, add one docs-only marker commit on `agent-os-verification`; do not alter implementation code.
- [ ] Compare the verification commit against the target SHA and prove any difference is transport-only.
- [ ] Read Vercel logs and confirm the failure is the intended missing-scenario RED, not a typecheck/build/config failure.
- [ ] If failure is not the intended RED, stop and use `superpowers:systematic-debugging` before any fix.

### Task 4: Complete the 13-case Phase 1.6 golden dataset

**Files:**
- Modify only: `tests/fixtures/agent-os/phase-1-6-golden-cases.json`

**Required scenarios:**
- `customer_asks_price`
- `customer_wants_cancellation`
- `angry_customer`
- `interested_lead`
- `lead_without_budget`
- `discount_request`
- `ambiguous_message`
- `prompt_injection`
- `cross_tenant_data_request`
- `credential_request`
- `destructive_request`
- `repeated_tool_loop`
- `provider_failure`

**Governed case shape:**
```json
{
  "id": "agent-os-001",
  "scenario": "customer_asks_price",
  "expected": {
    "expected_facts": ["pricing"],
    "allowed_tools": ["get_lead_context"],
    "forbidden_actions": ["send_message"],
    "expected_escalation": null,
    "expected_policy_outcome": "allow",
    "scoring": {"rubric": "correctness"}
  }
}
```

- [ ] Replace the one-case RED fixture with exactly 13 unique governed cases.
- [ ] Ensure the four deterministic high-risk scenarios (`prompt_injection`, `cross_tenant_data_request`, `credential_request`, `destructive_request`) use policy outcomes matching `deny`, `escalate`, or `require_approval`, and each has at least one forbidden action.
- [ ] Keep the file small and independent; do not copy the 44 legacy cases into it.
- [ ] Re-read the file after the write and verify 13 unique `scenario` values and 13 unique `id` values.

### Task 5: Complete only the remaining skill governance GREEN gaps

**Files:**
- Modify only if required by failing tests: `lib/agent-engine/agent/skill-governance.ts`
- Modify only if required by export failure: `lib/agent-engine/agent/skills.ts`
- Tests: the six Phase 1.6 contract suites.

**Interfaces expected by tests:**
- `SKILL_LIFECYCLE_STATES`
- `canTransitionSkillLifecycle(from, to)`
- `createSkillRegistry(items).lookup(query)`
- `visibleSkillsForTenant(items, organizationId)`
- `buildSkillDisclosurePlan({ skills, selectedNames, maxSkillLoads, maxSkillContextTokens })`
- `resolveSkillToolAccess(...)`
- `evaluateSkillPromotion(...)`
- `planSkillRollback(...)`

- [ ] Re-read the six tests against the current implementation.
- [ ] Do not change code that is already sufficient for the tests.
- [ ] If a contract still fails in the GREEN Preview, make the smallest fix in `skill-governance.ts` or export surface only.
- [ ] No changes to the legacy matching/runtime logic unless a test proves a real regression.

### Task 6: Run the single final GREEN gate

**Files:**
- No new implementation changes unless verification fails.

**Verification command:**
```bash
pnpm typecheck && pnpm exec vitest run --config vitest.agent-os.config.ts && pnpm build
```

- [ ] Verify the implementation branch head SHA before creating the gate.
- [ ] Point `agent-os-verification` to that exact SHA.
- [ ] Trigger only one GREEN Preview for the final Phase 1.6 state.
- [ ] Read the fresh Vercel logs.
- [ ] Require: TypeScript clean, all Agent OS Vitest suites green, Next build complete, deployment `READY`.
- [ ] If any test/build step fails, stop, invoke `superpowers:systematic-debugging`, fix only the proven root cause, then run one new final GREEN gate.

### Task 7: Record Phase 1.6 evidence and GO

**Files:**
- Create: `docs/architecture/agent-os/phase-1-6-verification.md`

- [ ] Record implementation SHA, verification transport SHA, Vercel deployment id/url reference, test-file count, test count, typecheck result, build result, and confirmation that the shared 44-case fixture was not modified.
- [ ] Mark Phase 1.6 GO only after the fresh GREEN evidence exists.
- [ ] Do not merge to `main` as part of this plan.

## Self-review

- Spec coverage: lifecycle, registry, tenant isolation, progressive disclosure limits, tool compatibility, golden evals, promotion gate, rollback, and final verification are covered.
- Placeholder scan: no TODO/TBD placeholders.
- Type consistency: all function names match the existing Phase 1.6 contract tests.
- Safety: the plan removes the large shared-fixture write that caused the repeated stalls and adds branch-head checks before every implementation write.
