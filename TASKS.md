# TASKS

Controller state projection. Queue source: `loop/queue.json`.

## TASK-LOOP-V01 — Minimum bounded remediation loop

- Status: REVIEW
- Responsible: Agent B / Owner gate pending
- Dependencies: Agent A V0 branch consolidation and final cross-review
- Files: `scripts/verify.sh`, `scripts/loop-controller.mjs`, `scripts/*loop*.test.mjs`, `loop/queue.json`, `loop/QUEUE.md`, `.codex/agents/reviewer.toml`
- Acceptance: deterministic four-step verification; branch/worktree audit; three-attempt bound; Builder feedback retry; independent Reviewer PASS; `READY_FOR_HUMAN`; no automatic merge/push/deploy
- Verification: `node --test scripts/verify.test.mjs scripts/loop-controller.test.mjs`; `bash -n scripts/verify.sh`; `node --check scripts/loop-controller.mjs`; `git diff --check`
- Attempts: 1/3
- Reviewer: PENDING final independent review artifact and owner gate

## Remediation queue

- No branch queued. Agent A must confirm canonical branch and worktree before enqueue.
