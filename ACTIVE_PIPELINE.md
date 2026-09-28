# ACTIVE PIPELINE — Lumenva Unification

**Pipeline:** ACTIVE  
**Scope:** Close out the safe consolidation tracked by PR #75. Do not merge the PR or modify `main`.  
**Project:** `trydavidqix/Lumenva`  
**Branch:** `consolidation/lumenva-main-2026-09-27`  
**Base:** `main` at `3fbe74a3ff7b7a99538d1e53aa55688294b7ba99`  
**Checkpoint evidence:** PR head `2ce0faec8c88594d9ef0f00eeaa46ca01e78904d`; after this tracker is committed, rerun checks against the resulting head.  
**Updated:** 2026-09-28 19:41 Europe/Lisbon

## Progress

- **Completed:** 2/7 — **29%**
- **Current:** reconcile stale consolidation reports with current evidence.
- **Next:** make the reports agree with the current PR head and this tracker.

## Checklist

- [x] Confirm isolated consolidation checkout, PR #75 open/unmerged, candidate branch synced, and `main` unchanged.
- [x] Audit the 92 paths removed by `082baf95`; retain them because the reviewed functionality was not found to be duplicated.
- [ ] Reconcile stale report/plan checkpoints, decisions, and remaining work with current evidence.
- [ ] Get all required PR checks green on the latest candidate commit; heavy validation runs in GitHub Actions only.
- [ ] Complete a comparable main-vs-candidate E2E run and classify shared failures versus regressions.
- [ ] Refresh the final Git archive/bundle and verify preserved refs against the final candidate.
- [ ] Publish final closeout evidence; leave PR #75 open and unmerged; stop without starting another task.

## Current state

- `verify` and `verify-and-build` were pending on candidate `2ce0faec` when this tracker was created; the other observed security, invariant, and vertical checks had passed. These results become stale after this file changes the PR head.
- Earlier paired E2E runs `36456011711` (main) and `36456014775` (candidate) were cancelled before completion. They do not establish final E2E parity.
- Existing archive proof predates recent PR changes. Preserve old bundles and refs; create a new uniquely named archive only after the final report update.
- The global `C:\Users\David\.codex\ACTIVE_PIPELINE.md` belongs to Nexus Brain. This project-local file is the source for Lumenva unification status and must not overwrite the global file.

## Guardrails

- Do not merge PR #75, modify `main`, alter the original Lumenva checkout, delete refs, prune worktrees, or overwrite existing archive bundles.
- Do not run heavy tests locally. Use GitHub Actions as the canonical validation environment.
- Count a checklist item complete only after its stated evidence is available. Update this file whenever status changes.
