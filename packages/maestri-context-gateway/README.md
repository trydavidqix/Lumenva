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

## Tests

```powershell
node --test packages/maestri-context-gateway/test/*.test.mjs
```
