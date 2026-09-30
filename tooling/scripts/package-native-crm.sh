#!/usr/bin/env bash
# Package the Next.js standalone CRM for a native Node.js host. Dry-run ONLY.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
OUT="${NATIVE_BUNDLE_OUTPUT:-${RUNNER_TEMP:-$ROOT/.native-build}/lumenva-native-crm}"
mkdir -p "$(dirname "$OUT")"
if [ -e "$OUT" ]; then
  echo "FATAL: output path already exists; refusing to overwrite: $OUT" >&2
  exit 1
fi
: "${NEXT_PUBLIC_SITE_URL:=https://lumenva-ci.invalid}"
: "${SENTRY_DSN:=off}"
export NEXT_PUBLIC_SITE_URL SENTRY_DSN
pnpm --dir apps/crm run build

STANDALONE="$ROOT/apps/crm/.next/standalone"
test -d "$STANDALONE"
test -d "$ROOT/apps/crm/.next/static"
test -d "$ROOT/apps/crm/public"
mkdir -p "$OUT"
cp -a "$STANDALONE"/. "$OUT"/
# outputFileTracingRoot is the workspace root; server.js is in apps/crm.
if [ -f "$OUT/apps/crm/server.js" ]; then
  APP="$OUT/apps/crm"
elif [ -f "$OUT/server.js" ]; then
  APP="$OUT"
else
  echo "FATAL: Next standalone output has no CRM server.js." >&2
  exit 1
fi
mkdir -p "$APP/.next"
cp -a "$ROOT/apps/crm/.next/static" "$APP/.next/static"
cp -a "$ROOT/apps/crm/public" "$APP/public"
printf '%s\n' "node $([[ "$APP" == "$OUT" ]] && echo server.js || echo apps/crm/server.js)" > "$OUT/START-COMMAND.txt"
tar -C "$OUT" -czf "$OUT.tar.gz" .
test -s "$OUT.tar.gz"
tar -tzf "$OUT.tar.gz" >/dev/null
echo "Native CRM package validated: $OUT.tar.gz (NOT deployed)."
