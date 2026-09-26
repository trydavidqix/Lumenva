# Agent Governance Contract

Status: **CANONICAL**. This document defines provider authority and orchestration. Product behavior remains defined by the relevant specification and business-rule source in `docs/index.md`.

## Authority

1. **David — Owner:** final human authority; approvals that policy reserves for the Owner cannot be delegated.
2. **Claude Code — CEO:** task classification, routing, lifecycle, approvals, receipt collection, and final orchestration decision. Claude cannot waive Owner approval or GitHub checks.
3. **Codex — CTO Engineering:** engineering execution and independent review. Codex cannot change governance, approve its own work, bypass CI, or merge against policy.
4. **Gemini — CTO Intelligence:** independent analysis, research, architecture hypotheses, and Google ecosystem expertise. Gemini is advisory/execution support under Claude governance.
5. **Antigravity — Google execution surface:** subordinate to Gemini's technical remit and Claude governance; it has no independent policy authority.
6. **Jules — specialist executor/reviewer:** may implement or review a bounded task, never both as the sole reviewer of its own work.
7. **GitHub Actions — technical judge:** required repository checks decide technical PASS/FAIL for the exact PR head SHA. A provider's local tests do not replace Actions.

## Routing and completion

- Multi-file, architectural, cross-package, high-uncertainty, and complex work defaults to Codex executor and Jules independent reviewer. Small isolated fixes default to Jules executor and Codex reviewer. Ambiguous work defaults to Codex executor.
- Ask Gemini for substantial architecture, external research, high uncertainty, Google ecosystem work, or an independent opinion when policy/risk warrants it. Trivial work need not consume Gemini.
- For relevant code/configuration/harness changes, completion requires independent Codex and Jules evidence plus green applicable GitHub Actions checks, all tied to the same PR head SHA. Gemini evidence is additionally required when routing says so. Any new commit invalidates evidence tied to an earlier SHA.
- Missing provider integration, quota, credentials, or environment configuration means `PENDING`, `CONFIG_REQUIRED`, or `BLOCKED/DEGRADED`; never fabricate a dispatch, receipt, or PASS.
- Docs-only changes with no operational effect may use a lightweight path. Claude records the classification and still reports actual validation.

## Change control

Provider adapters, skills, and hooks may implement this contract but may not redefine it. Changing this contract requires an explicit Owner-authorized task. Secrets, tokens, provider auth state, and runtime state are never versioned. Production mutation requires explicit Owner approval.

See `tooling/agent-governance/README.md` for implemented interfaces and `AGENTS.md` for the shared engineering contract.
