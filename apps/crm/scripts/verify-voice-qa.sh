#!/usr/bin/env bash
set -uo pipefail

# Voice QA gate. Default is provider-free and safe to run on a laptop.
# This script never claims live proof.
MODE="${1:-provider-free}"

case "$MODE" in
  provider-free) ;;
  vps|live)
    echo "[voice-qa] NOT_EXECUTED: $MODE mode requires an operator-run external procedure; this harness never claims live proof."
    if [[ "${VOICE_QA_ALLOW_LIVE:-}" != "1" ]]; then
      echo "[voice-qa] Set VOICE_QA_ALLOW_LIVE=1 only after reviewing docs/runbooks/voice-qa.md and obtaining authorization."
      exit 2
    fi
    echo "[voice-qa] NOT_PROVEN: authorization marker is present, but this repository harness does not execute VPS/live calls."
    exit 3
    ;;
  *)
    echo "usage: $0 [provider-free|vps|live]" >&2
    exit 2
    ;;
esac

failures=0
run_gate() {
  local name="$1"
  shift
  echo "[voice-qa] RUN $name"
  if "$@"; then
    echo "[voice-qa] PASS $name (VERIFIED PROVIDER-FREE)"
  else
    echo "[voice-qa] NOT_PROVEN $name"
    failures=$((failures + 1))
  fi
}

run_gate "voice-contract-tests" pnpm vitest run \
  lib/voice/sip/asterisk-adapter.test.ts \
  lib/voice/sip/asterisk-ari-client.test.ts \
  lib/voice/sip/asterisk-listener.test.ts \
  lib/voice/sip/brain-client.test.ts \
  lib/voice/sip/event-forwarder.test.ts \
  tests/unit/voice-qa-harness-contract.test.ts
run_gate "worker-syntax" node --check workers/voice-sip-worker/main.mjs
run_gate "smoke-syntax" node --check workers/voice-sip-worker/ari-listener.smoke.mjs
run_gate "entrypoint-smoke-syntax" node --check workers/voice-sip-worker/main.smoke.mjs
run_gate "ari-listener-smoke" npx tsx workers/voice-sip-worker/ari-listener.smoke.mjs
echo "[voice-qa] RUN main-entrypoint-smoke"
main_smoke_log="$(mktemp)"
if npx tsx workers/voice-sip-worker/main.smoke.mjs >"$main_smoke_log" 2>&1; then
  if grep -q "skipping main.smoke.mjs" "$main_smoke_log"; then
    echo "[voice-qa] NOT_EXECUTED main-entrypoint-smoke (SUPABASE_DB_URL absent; Postgres proof unavailable)"
  else
    echo "[voice-qa] PASS main-entrypoint-smoke (VERIFIED PROVIDER-FREE)"
  fi
else
  cat "$main_smoke_log"
  echo "[voice-qa] NOT_PROVEN main-entrypoint-smoke"
  failures=$((failures + 1))
fi
rm -f "$main_smoke_log"

if [[ "$failures" -gt 0 ]]; then
  echo "[voice-qa] NOT_PROVEN: $failures provider-free gate(s) failed."
  exit 1
fi

echo "[voice-qa] VERIFIED PROVIDER-FREE: SIP event bridge, forwarding, and harness contracts."
echo "[voice-qa] NOT_PROVEN: real Asterisk/SIP/PSTN, RTP, Pipecat, STT/TTS audio, transfer, and production rollback."
