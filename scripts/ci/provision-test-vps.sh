#!/usr/bin/env bash

set -Eeuo pipefail

usage() {
  printf 'Usage: HCLOUD_TOKEN=... %s <branch>\n' "${0##*/}" >&2
  printf '\nOptional environment variables:\n' >&2
  printf '  HCLOUD_SERVER_TYPE  Hetzner type (default: cx33)\n' >&2
  printf '  HCLOUD_LOCATION     Hetzner location (default: fsn1)\n' >&2
  printf '  LOG_DIR             Local log directory (default: /tmp/lumenva-test-vps)\n' >&2
}

if [[ $# -ne 1 ]]; then
  usage
  exit 2
fi

: "${HCLOUD_TOKEN:?HCLOUD_TOKEN is required}"

for command in git hcloud jq ssh ssh-keygen ssh-keyscan tee; do
  command -v "$command" >/dev/null 2>&1 || {
    printf 'Missing required command: %s\n' "$command" >&2
    exit 127
  }
done

BRANCH=$1
SERVER_TYPE=${HCLOUD_SERVER_TYPE:-cx33}
LOCATION=${HCLOUD_LOCATION:-fsn1}
REPO_URL=$(git remote get-url origin)
RUN_ID=$(date -u +%Y%m%dT%H%M%SZ)-$$
SERVER_NAME="lumenva-test-${RUN_ID}"
SSH_KEY_NAME="${SERVER_NAME}-key"
LOG_DIR=${LOG_DIR:-/tmp/lumenva-test-vps}
LOG_FILE="${LOG_DIR}/${SERVER_NAME}.log"
SSH_DIR=$(mktemp -d "${TMPDIR:-/tmp}/lumenva-test-ssh.XXXXXX")
SSH_PRIVATE_KEY="${SSH_DIR}/id_ed25519"
KNOWN_HOSTS="${SSH_DIR}/known_hosts"
SERVER_CREATED=0
SSH_KEY_CREATED=0

mkdir -p "$LOG_DIR"
exec > >(tee -a "$LOG_FILE") 2>&1

cleanup() {
  local exit_code=$?
  set +e
  printf '\nCleanup: exit_code=%s server=%s ssh_key=%s\n' "$exit_code" "$SERVER_NAME" "$SSH_KEY_NAME"
  if [[ "$SERVER_CREATED" -eq 1 ]]; then
    hcloud server delete "$SERVER_NAME" || printf 'WARNING: failed to delete server %s\n' "$SERVER_NAME" >&2
  fi
  if [[ "$SSH_KEY_CREATED" -eq 1 ]]; then
    hcloud ssh-key delete "$SSH_KEY_NAME" || printf 'WARNING: failed to delete SSH key %s\n' "$SSH_KEY_NAME" >&2
  fi
  rm -rf "$SSH_DIR"
  printf 'Local log preserved at %s\n' "$LOG_FILE"
  exit "$exit_code"
}
trap cleanup EXIT

printf 'Preparing disposable test VPS\n'
printf 'branch=%s type=%s location=%s repo=%s\n' "$BRANCH" "$SERVER_TYPE" "$LOCATION" "$REPO_URL"
printf 'log=%s\n' "$LOG_FILE"

ssh-keygen -q -t ed25519 -N '' -C "$SERVER_NAME" -f "$SSH_PRIVATE_KEY"
hcloud ssh-key create \
  --name "$SSH_KEY_NAME" \
  --public-key-from-file "$SSH_PRIVATE_KEY.pub" >/dev/null
SSH_KEY_CREATED=1

hcloud server create \
  --name "$SERVER_NAME" \
  --type "$SERVER_TYPE" \
  --image ubuntu-24.04 \
  --location "$LOCATION" \
  --ssh-key "$SSH_KEY_NAME" \
  --start-after-create
SERVER_CREATED=1

SERVER_IP=''
for attempt in $(seq 1 60); do
  SERVER_IP=$(hcloud server describe "$SERVER_NAME" -o json | jq -er '.public_net.ipv4.ip' 2>/dev/null || true)
  if [[ -n "$SERVER_IP" ]]; then
    printf 'Server IP discovered on attempt %s: %s\n' "$attempt" "$SERVER_IP"
    break
  fi
  sleep 5
done
if [[ -z "$SERVER_IP" ]]; then
  printf 'Timed out waiting for a public IPv4 address\n' >&2
  exit 1
fi

printf 'Waiting for SSH host key\n'
for attempt in $(seq 1 60); do
  if ssh-keyscan -T 5 -H "$SERVER_IP" >>"$KNOWN_HOSTS" 2>/dev/null; then
    break
  fi
  if [[ "$attempt" -eq 60 ]]; then
    printf 'Timed out waiting for SSH on %s\n' "$SERVER_IP" >&2
    exit 1
  fi
  sleep 5
done

ssh -i "$SSH_PRIVATE_KEY" \
  -o BatchMode=yes \
  -o ConnectTimeout=10 \
  -o StrictHostKeyChecking=yes \
  -o UserKnownHostsFile="$KNOWN_HOSTS" \
  root@"$SERVER_IP" \
  env LUMENVA_BRANCH="$BRANCH" LUMENVA_REPO_URL="$REPO_URL" bash -s <<'REMOTE_SCRIPT'
set -Eeuo pipefail

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
corepack enable
corepack prepare pnpm@12.3.4 --activate

rm -rf /opt/lumenva-test
git clone --depth 1 --branch "$LUMENVA_BRANCH" "$LUMENVA_REPO_URL" /opt/lumenva-test
cd /opt/lumenva-test
pnpm install --frozen-lockfile

pnpm --filter lumenva-crm exec vitest run \
  --config ../../apps/crm/vitest.config.ts \
  lib/agent-engine/persistence/supabase-approval-store.test.ts \
  tests/unit/tenant-rls-hardening-contract.test.ts
pnpm --filter lumenva-crm test:db
REMOTE_SCRIPT

printf 'Remote test gates completed\n'
