# Maestri Context Gateway (MCG)

Local, dependency-free context firewall between Claude CEO and Maestri/Codex.

MCG persists structured task state and high-volume evidence under
`~/.lumenva/maestri-context-gateway`. Normal execution is silent: `mcg wait`
returns only a terminal `DONE` or `BLOCKED_OWNER` handoff. Raw terminal output is
never a task status source. The installed Maestri CLI was audited and exposes
no feed/WebSocket command, so V1 accepts explicit structured events through the
inbox/`mcg ingest`; it does not invent or poll an unavailable endpoint.

## Commands

```text
mcg doctor
mcg dispatch --file task.json
mcg daemon
mcg status [task-id] [--json]
mcg wait <task-id>
mcg result <task-id>
mcg evidence <task-id> --type validation|tests|ci --lines 40
mcg cancel <task-id>
mcg ingest --file event.json
```

The implementation uses only Node built-ins and requires Node 22 or newer.
