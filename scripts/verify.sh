#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
PNPM_BIN="${PNPM_BIN:-pnpm}"

run_check() {
  local name="$1"
  shift
  printf '\n== %s ==\n' "$name"
  "$@"
  printf 'PASS %s\n' "$name"
}

run_check lint "$PNPM_BIN" --filter lumenva-crm lint
run_check typecheck "$PNPM_BIN" --filter lumenva-crm typecheck
run_check test "$PNPM_BIN" --filter lumenva-crm test:unit
run_check build "$PNPM_BIN" --filter lumenva-crm build

printf '\nVERIFY PASS\n'
