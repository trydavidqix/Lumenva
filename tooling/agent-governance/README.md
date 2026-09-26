# Agent Governance Harness

`docs/engineering/AGENT_GOVERNANCE.md` is the canonical policy. Provider files are adapters only. This harness adds a local, unversioned task state and checks completion evidence; it does not dispatch an unavailable provider or pretend local checks are GitHub Actions.

## Commands

Run from the repository root with Node 22:

```powershell
node tooling/agent-governance/gate.mjs begin --kind code --summary "short task summary"
# after implementation is committed and the PR branch is pushed:
node tooling/agent-governance/gate.mjs seal
node tooling/agent-governance/gate.mjs status
node tooling/agent-governance/gate.mjs dispatch-codex
node tooling/agent-governance/gate.mjs dispatch-jules
node tooling/agent-governance/gate.mjs dispatch-gemini
node tooling/agent-governance/gate.mjs complete
```

`begin` requires a clean task branch, classifies the task, pins the current branch and starting HEAD, and creates unsealed state below `.git/agent-governance/`. Small isolated work routes Jules first; other/ambiguous work routes Codex first. After implementation is committed and the PR branch is pushed, `seal` snapshots the final clean PR HEAD, invalidates earlier receipts, and permits provider dispatch. A sealed run blocks further mutations; `reopen` invalidates every receipt before work resumes. Completion also requires a clean working tree, so uncommitted changes cannot reuse same-SHA receipts.

`dispatch-codex` checks `CODEX_CLOUD_ENV_ID`; absent configuration reports `CODEX_CLOUD_ENV_REQUIRED` and exits without dispatch or receipt. After the owner configures a real environment ID, the adapter calls the installed official Codex CLI on the explicit branch. Runtime state is local and ignored by Git.

`dispatch-jules` uses the official Jules Sessions API only when `JULES_API_KEY` is provided in the local process environment. It verifies that the connected `trydavidqix/Lumenva` source exposes the exact task branch before dispatch, requires plan approval, and stores the actual session reference. A missing key reports `JULES_API_KEY_REQUIRED`; it does not create a session. The Jules CLI remains available for interactive work, but its installed `remote new` interface does not pin a branch.

`begin --require-gemini` adds Gemini analysis to the completion gate. `dispatch-gemini` uses the installed Gemini CLI in `plan` (read-only) mode and records output as unverified until a matching receipt is independently imported. It may use Gemini account quota when explicitly run. Antigravity uses its native project hook/rule adapter; this harness does not create an Antigravity task automatically.

Provider receipts must be evidence-backed JSON imported with `record <provider> <receipt.json>`. Keep downloaded receipts under `.git/agent-governance/` so they cannot dirty the checkout. The receipt schema is in `receipt.schema.json`. Never write a receipt on a provider's behalf. GitHub Actions evidence includes its run URL and exact PR head SHA. `complete` fails closed when relevant evidence is missing, failed, dirty, or stale. A changed HEAD invalidates the run's provider and Actions evidence; run `reopen` before continuing and seal again after the next commit.

## Surfaces

| Surface | Classification | Adapter |
| --- | --- | --- |
| `AGENTS.md` and this policy | CANONICAL | Shared contract and governance |
| `.claude/settings.json` | SUPPORTED | Claude hooks/permissions; retain existing deny/ask rules |
| `.gemini/settings.json` | SUPPORTED | Gemini CLI context and hooks |
| `.agents/rules/` and `.agents/skills/` | SUPPORTED | Shared rules/skills discovered by Gemini/Antigravity; provider discovery varies |
| `.agents/hooks.json` | SUPPORTED | Antigravity project hooks |
| `.codex/config.toml` | SUPPORTED | Existing Codex CLI configuration; no unsupported hook claims |
| `.codex/rules/orchestration.rules` | OPTIONAL / PREVIEW | Codex execpolicy rule file; evaluated only when explicitly passed to `codex execpolicy check`, not a native automatic interactive hook in the installed version |
| `~/.claude`, `~/.codex`, `~/.gemini` | LOCAL-ONLY | Native user config/auth; not modified by this project adapter |
| `CODEX_CLOUD_ENV_ID` | LOCAL-ONLY | Set by Owner in secure local environment; no repository value |
| `.git/agent-governance/` | LOCAL-ONLY | Runtime state and evidence pointers |

Gemini CLI is observed at `0.60.0`; its hooks honor workspace trust. Antigravity CLI is observed as `agy 1.2.10`; its project hook schema is separate. Claude Code `2.1.282`, Codex CLI `0.155.1`, Jules Tools `v0.1.42`, and GitHub CLI `2.101.0` were present during the audit. These are audit snapshots, not pinned runtime versions. Native Claude shared-skill discovery from `.agents/skills` is not assumed; Claude's thin skill adapters stay under `.claude/skills/`.

The installed Codex CLI provides `execpolicy check --rules` to evaluate preview policy files, but the current CLI offers no project-loaded pre-tool hook for that policy. The policy file is therefore an explicit safe evaluator and the root AGENTS contract, not a falsely claimed automatic Codex blocker. GitHub required checks/branch protection remain the merge enforcement boundary.

Jules API follows its documented connected-source and `startingBranch` contract, with plan approval enabled; the task prompt also names the expected SHA. The result still needs independent verification and a receipt before it counts. Never infer a reviewed SHA from the session branch alone.

## Operational limits

Hooks perform only local checks and never call network services. CI remains the objective judge. Existing user-level skills/configuration and duplicate skill names are preserved; they are neither copied nor deleted by this harness. Gemini's trust prompt must be accepted locally before project hooks/config apply.
