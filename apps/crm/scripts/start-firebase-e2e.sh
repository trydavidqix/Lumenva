#!/usr/bin/env bash
set -euo pipefail
npm install --global firebase-tools@14.12.0
firebase emulators:start --only auth \
  --project demo-lumenva-e2e \
  --config apps/crm/firebase.e2e.json \
  > /tmp/lumenva-firebase-emulator.log 2>&1 < /dev/null &
echo $! > /tmp/lumenva-firebase-emulator.pid
for n in $(seq 1 60); do
  if curl --fail --silent http://127.0.0.1:9099/emulator/v1/projects/demo-lumenva-e2e/config >/dev/null; then
    echo "Firebase DEMO Auth emulator ready on loopback."
    exit 0
  fi
  sleep 2
done
cat /tmp/lumenva-firebase-emulator.log >&2
echo "FATAL: Firebase demo emulator did not start." >&2
exit 1
