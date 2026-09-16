# Claude CEO, Codex Executor and MCG

This repository contains the reproducible MCG V1 source in
`tools/maestri-context-gateway`. Claude owns strategy and delegation; Codex
owns implementation and validation; Maestri remains the runtime transport.

MCG stores task state/evidence outside the conversation and exposes only
terminal `DONE` or `BLOCKED_OWNER` handoffs. It intentionally does not poll
terminal scrollback. The currently installed Maestri CLI was audited on
2026-09-16: it reports a healthy connection, but does not expose a documented
event feed or WebSocket command. Therefore the adapter boundary is explicit
and event-driven without claiming unsupported live integration.

Global configuration is installed from this source only after backup and
validation. Secrets and managed auth files remain outside Git.
