# Codex adapter — Lumenva

This file supplements the root [`AGENTS.md`](../AGENTS.md) for Codex-specific behavior. The shared governance policy is [`docs/engineering/AGENT_GOVERNANCE.md`](../docs/engineering/AGENT_GOVERNANCE.md); it is not duplicated here.

## Authority

- Canonical doctrine: `../CLAUDE.md`.
- Portable contract: `../AGENTS.md`.
- Provider authority and lifecycle: `../docs/engineering/AGENT_GOVERNANCE.md`.
- Shared modular rules: `../.claude/rules/`.
- Doctrine reconciliation matrix: `../docs/harness-doctrine-matrix.md`.
- Codex repo skill: `../.agents/skills/DeskcommCRM/SKILL.md`.

The Codex skill is a **bridge**, not an independent source of conventions. If it disagrees with `CLAUDE.md`, follow `CLAUDE.md`. If historical wording conflicts with current Spec/PRD/business-rule, use the repository precedence and the reconciliation matrix rather than reviving a frozen snapshot.

## Local/private configuration

Keep user credentials, private MCPs and machine-specific settings in `~/.codex/config.toml` or the appropriate local store. Do not commit secrets to this repository.

## Multi-agent support

- `explorer` — read-only evidence gathering.
- `reviewer` — read-only correctness/security/regression review.
- `docs-researcher` — read-only API/documentation verification.

Use these roles for their narrow purpose; do not make them alternate sources of product doctrine.

## Workflow

Before writing code:

1. read `CLAUDE.md`;
2. read the relevant shared rule(s) — API, audit, LGPD, WAHA and data-modeling are separate domains, not generic security notes;
3. inspect existing code/specs/business rules;
4. use the appropriate process skill/workflow;
5. verify with evidence before declaring completion.

Run `pnpm harness:check` after changing harness/instruction files.

## CTO Engineering limits

Codex is CTO Engineering under Claude CEO and David Owner. Execute or independently review only the role assigned for the current task. Do not modify governance outside an explicitly Owner-authorized task, self-approve, bypass GitHub Actions, or claim completion from a different HEAD SHA. The gate and evidence format live in `../tooling/agent-governance/`.
