# Maestri Context Gateway

Versioned source package for the local Lumenva Context Gateway (MCG).

## Runtime data

MCG stores runtime data outside Git. Set `MCG_ROOT` to a local state directory before running the CLI. The repository excludes `state/`, `tasks/`, `logs/`, event inbox data, PID files, Wire credentials, and backup files.

## CLI

```powershell
$env:MCG_ROOT = Join-Path (Get-Location) '.mcg-state'
node packages/maestri-context-gateway/bin/mcg.mjs doctor
node packages/maestri-context-gateway/bin/mcg.mjs status --json
```

Wire integration requires a local `config/wire.json`. Copy `config/wire.example.json` and provide local credentials outside Git.

The dashboard can expose persisted Core execution evidence through the read-only `Executions` view. Start the Core API on loopback and set `LUMENVA_CORE_URL` (for example, `http://127.0.0.1:0` with the actual port) before `mcg dashboard`. Non-loopback URLs are rejected; when the variable is absent, the view reports `UNAVAILABLE` instead of fabricating data.

## Tests

```powershell
node --test packages/maestri-context-gateway/test/*.test.mjs
```
