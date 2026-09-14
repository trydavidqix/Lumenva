# Codex adapter — Lumenva

This file supplements the root [`AGENTS.md`](../AGENTS.md) for Codex-specific behavior.

## Authority

- Canonical doctrine: `../CLAUDE.md`.
- Portable contract: `../AGENTS.md`.
- Shared modular rules: `../.claude/rules/`.
- Doctrine reconciliation matrix: `../docs/harness-doctrine-matrix.md`.
- Codex repo skill: `../.agents/skills/Lumenva/SKILL.md`.

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
