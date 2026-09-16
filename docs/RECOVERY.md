# Recovery

MCG state is stored per task under `~/.lumenva/maestri-context-gateway/tasks`.
Writes use temporary files followed by rename, and events are retained in
`events.jsonl`. Restart `mcg daemon` to recover; unconsumed JSON events remain
in the inbox. The machine configuration backup for this migration is
`~/.lumenva/backups/ARCH-MIGRATION-001-20260916`.
