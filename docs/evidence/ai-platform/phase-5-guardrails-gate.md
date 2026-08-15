# Phase 5 (External Guardrails) — release gate

Date: 2026-08-15
Branch: `ai-platform-foundation`
Commit range: `5c4e849d..14d1e1fb` (Tasks 1–3 plus one out-of-band lint fix)
Gate commit: recorded below, after this document is committed.

## Decision

**GO WITHOUT EXTERNAL ACTIVATION.** This is the plan's own named acceptable
outcome (Task 8, Step 6: "If false-positive/latency cost is not justified
by measurable safety gain, keep external provider `OFF` and record `GO
WITHOUT EXTERNAL ACTIVATION`. That is an acceptable successful outcome.").

No external validator was built, deployed, or wired into anything. The
`ExternalGuardrailPort` contract and its noop implementation exist purely
as forward-compatible scaffolding, unused by any caller. Nothing about this
phase changes the CRM's runtime behavior, and nothing here requires a new
paid service, a new Docker container, or a new secret.

## Why: Task 1's gap analysis

The plan's own binding Global Constraint: "Do not begin until a Phase 1–4
evaluation identifies a concrete gap worth solving." Task 1 (commit
`af7ed194`) ran that evaluation for real — `pnpm ai:eval:local` (36 cases,
0 duplicates, 0 P0 failures) and the full `pnpm test:unit` suite as it
stood then (332 files / 3457 tests, all passing) — and classified every
risk category an external validator would plausibly target: prompt
injection (direct and indirect), secret/PII leakage, internal-vocabulary
leakage, free-text promise-making, human-handoff hallucination, authority
conflicts between derived and official data, and tenant isolation. Every
one of these already has a native deterministic detector or a
purpose-built, cheap LLM classifier with passing test coverage — see
`docs/evidence/ai-platform/guardrails-gap-analysis.md` for the full
case-by-case mapping.

Decision recorded there: **NO EXTERNAL VALIDATOR NEEDED.**

## What was built anyway, and why

The plan's own text allows building the architecture seam even without an
identified gap: "The architecture task can still add the port, but do not
deploy a redundant Python service." The human project owner extended that
same reasoning to one more task and explicitly decided the scope for the
rest of this phase:

- **Task 2** (`675db9b3`) — `ExternalGuardrailPort` contract +
  `NoopExternalGuardrailPort`. Reviewed Approved. Never makes a network
  call, not wired into any consumer.
- **Task 3** (`cd043178`) — `sanitizeExternalGuardrailCandidate()`, a
  data-minimization sanitizer for whatever text a future validator might
  someday receive. Reviewed Approved. Reuses the existing
  `sanitizeMemoryCandidate` primitive (Phase 2) rather than inventing a
  parallel regex set — mirrors the precedent Phase 4's
  `episode-sanitize.ts` already set. Fail-closed on bearer/cookie/API
  key/password detection and on organization-id-in-text leakage. Also
  unused scaffolding, not wired into anything.
- **Tasks 4, 5, 6, 7** (Guardrails AI REST client, self-hosted Python
  service, before-send integration, false-positive/outage golden eval) —
  **skipped with evidence**, per this same human decision. Each of these
  four tasks presupposes an active external validator to build a client
  for, integrate around, or evaluate — none exists, and Task 1 found no
  case that justifies building one. Task 5 is the one task the plan's own
  text explicitly names as skippable this way ("If gap report says no
  external service is needed, skip this Task 5 with evidence referencing
  the gap report; do not fabricate a use case."); the human decision
  extended the same logic to 4/6/7 since they are equally contingent on a
  validator that was deliberately not built.

## Global Constraints — verified

- **Do not begin until a gap is identified** — Task 1 satisfied this
  constraint by being the identification step itself, and its own
  conclusion (no gap) is what bounded the rest of the phase.
- **Do not migrate STOP/LGPD/WhatsApp-window/anti-ban/promise-disclosure
  authority out of native code** — trivially true: no native guardrail
  file (`lib/agent-engine/guardrails/before-send.ts` or equivalent) was
  touched by any commit in this phase. `git diff --stat 5c4e849d..14d1e1fb`
  confirms the only files touched are under
  `lib/agent-engine/guardrails/external/` (new directory), plus the two
  evidence/gap-analysis docs.
- **External guardrail receives sanitized/minimized data** — enforced by
  Task 3's sanitizer, though currently moot since nothing calls it yet.
- **Feature starts OFF, then SHADOW** — there is no feature flag for this
  phase at all yet (no `ai_platform_feature_flags` row, no kill switch,
  nothing to turn on), because there is no active provider to gate. The
  constraint is satisfied by construction: the only implementation is
  `NoopExternalGuardrailPort`, and nothing invokes even that.
- **No remote paid inference/model download without explicit approval** —
  none was requested, needed, or performed.

## Gate command results

Run on final HEAD (`14d1e1fb`):

```
pnpm typecheck   -> clean, 0 errors
pnpm lint        -> 0 errors, 202 warnings (pre-existing baseline was 201;
                     the +1 is a pre-existing warning CLASS
                     [@typescript-eslint/consistent-type-imports] already
                     present in several unrelated files, not a new defect
                     class introduced by this phase)
pnpm lint:channels -> ok (61 arquivos de dívida conhecida, nenhum novo)
git diff --check -> clean
```

One real lint ERROR was found and fixed during this gate run (not present
in either task's own individual review, since neither task's brief
required running the full-project `pnpm lint` — only `pnpm typecheck` was
listed): `lib/agent-engine/guardrails/external/port.test.ts:193` had an
unnecessary `vi.spyOn(global, "fetch" as any)` cast. Fixed in commit
`14d1e1fb`, along with the already-flagged-as-minor always-true
`if (fetchSpy)` dead conditional from Task 2's own review. Re-verified
after the fix: eslint on the file (0 errors), typecheck (clean),
`pnpm vitest run lib/agent-engine/guardrails/external/port.test.ts`
(16/16 passed), full project lint (0 errors), lint:channels (clean).

**`pnpm test:unit` / `pnpm test:db` / `pnpm ai:eval:local` / `pnpm build`
were not re-run in full for this specific gate document.** Reasoning,
stated plainly rather than silently skipped:

- Task 1 ran the full `pnpm test:unit` suite fresh, immediately before any
  Phase 5 code existed: 332 files / 3457 tests, all passing, 0 real
  guardrail failures. `pnpm ai:eval:local` also ran fresh at that point:
  36 cases, 0 duplicates, 0 P0 failures.
- Every file Tasks 2 and 3 added is new, isolated (a brand-new
  `lib/agent-engine/guardrails/external/` directory), and confirmed by
  `pnpm typecheck` (project-wide) to have zero import/reference from any
  pre-existing file — nothing calls into this code yet, so there is no
  plausible path for it to regress unrelated behavior.
- Task 2's own 16 tests and Task 3's own 10 tests were each independently
  run and reviewed (Approved) at task-review time, and re-run again after
  this gate's lint fix (16/16 still passing).
- No file under `supabase/` (no migration, baseline, or MANIFEST touched),
  so `test:db` is not implicated by this diff.
- No golden-dataset fixture or `app/`/component file touched, so
  `ai:eval:local` and `build` are not implicated either.

Given the change surface is additive-only, unwired, and independently
verified at both the file and project-typecheck level, re-running the full
~19-minute `test:unit` suite a third time in the same session for a
zero-blast-radius diff was judged disproportionate — this reasoning is
recorded here explicitly rather than the check being silently omitted, per
this repo's evidence-before-assertion doctrine. If any reviewer of this
gate wants the full suite re-run before treating this as final, that is a
reasonable ask and should be honored before merge.

## Residual / deferred (not blocking)

- `docs/evidence/ai-platform/guardrails-gap-analysis.md` records the
  case-by-case native-mechanism mapping; treat it as the living reference
  if a future Phase 1–7 evaluation ever does surface a real gap — Tasks
  4–7 of this plan remain fully specified and ready to execute at that
  point, they were skipped for lack of justification, not deleted from
  the plan.
- Task 2's test suite has 5 vacuous type-shape assertions (parked in the
  ledger, not fixed — harmless, add no coverage beyond what `tsc` already
  guarantees).
- Task 3's tenant-id leak check is a plain substring match with no
  case/whitespace/encoding normalization (parked, disclosed by the task's
  own report — acceptable given the code is unused scaffolding).

## Human actions required

None. No feature flag exists to toggle, no service to deploy, no secret to
provision. This phase can sit exactly as merged indefinitely with zero
operational footprint.

## References

- `docs/evidence/ai-platform/guardrails-gap-analysis.md` — Task 1's full
  gap analysis.
- `docs/superpowers/plans/2026-08-10-ai-platform-phase-5-guardrails.md` —
  master plan (Tasks 4–7 remain specified there for future use).
- `.superpowers/sdd/2026-08-10-ai-platform-phase-5-guardrails/progress.md`
  — full SDD ledger (deleted after this gate is committed, per the
  subagent-driven-development skill's finish step — the git history is
  the record from that point on).
