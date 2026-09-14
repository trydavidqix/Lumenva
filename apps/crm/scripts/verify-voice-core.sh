#!/usr/bin/env bash
set -euo pipefail

pnpm typecheck
NODE_ENV=test pnpm vitest run \
  lib/agent-engine/product-agents/conversation-style.test.ts \
  lib/voice/contracts.test.ts \
  lib/voice/repository.test.ts \
  lib/voice/config.test.ts \
  lib/voice/engine/contracts.test.ts \
  lib/voice/engine/factory.test.ts \
  lib/voice/engine/voice-profile-schema.test.ts \
  lib/voice/engine/voice-profile-version.test.ts \
  lib/voice/tts/fallback-chain.test.ts \
  lib/voice/tts/language-matrix.test.ts \
  lib/voice/patter/adapter.test.ts \
  lib/voice/patter/media.test.ts \
  lib/voice/patter/telemetry.test.ts \
  lib/voice/pipecat/adapter.test.ts \
  lib/voice/sip/asterisk-adapter.test.ts \
  lib/voice/sip/asterisk-ari-client.test.ts \
  lib/voice/sip/asterisk-listener.test.ts \
  lib/voice/sip/brain-client.test.ts \
  lib/voice/sip/event-forwarder.test.ts \
  lib/voice/stt/faster-whisper-adapter.test.ts \
  lib/voice/tts/voice-catalog.test.ts \
  lib/voice/tts/piper-adapter.test.ts \
  lib/voice/tts/kokoro-adapter.test.ts \
  lib/voice/clone/openvoice-adapter.test.ts \
  lib/voice/clone/clone-profile-registry.test.ts \
  lib/voice/runtime/agent-os-adapter.test.ts \
  lib/voice/runtime/agent-resolver.test.ts \
  lib/voice/runtime/delivery-policy.test.ts \
  lib/voice/runtime/delivery-style.test.ts \
  lib/voice/runtime/voice-humanizer.test.ts \
  lib/voice/runtime/voice-output-policy.test.ts \
  lib/voice/runtime/context-service.test.ts \
  lib/voice/runtime/turn-service.test.ts \
  lib/voice/runtime/session.test.ts \
  lib/voice/runtime/barge-in.test.ts \
  lib/voice/runtime/ports.test.ts \
  lib/voice/outbound/service.test.ts \
  lib/voice/human-browser/adapter.test.ts \
  lib/voice/livekit/session.test.ts \
  lib/voice/telnyx/webhook.test.ts \
  lib/voice/telnyx/orchestrator.test.ts \
  lib/voice/identity/resolve-organization.test.ts \
  lib/voice/identity/resolve-caller.test.ts \
  lib/voice/transfer/adapter.test.ts \
  lib/voice/transfer/engine-transport.test.ts \
  lib/voice/testing/simulator.test.ts \
  lib/voice/testing/evals.test.ts \
  app/api/internal/voice/context/route.test.ts \
  app/api/internal/voice/turn/route.test.ts \
  app/api/internal/voice/event/route.test.ts \
  tests/unit/voice-migration-contract.test.ts \
  tests/unit/voice-hardening-migration-contract.test.ts \
  tests/unit/voice-phone-number-migration-contract.test.ts \
  tests/unit/voice-config-surface-contract.test.ts \
  tests/unit/voice-worker-deploy-contract.test.ts \
  tests/unit/voice-worker-tenant-binding-contract.test.ts \
  tests/unit/voice-outbound-route-contract.test.ts \
  tests/unit/lumenva-voice-engine-e2e-contract.test.ts \
  tests/unit/voice-personality-patter-contract.test.ts \
  tests/unit/voice-local-free-contract.test.ts
node --check ../../workers/voice-worker/main.mjs
node --check ../../workers/voice-worker/brain-client.mjs
node --check ../../workers/voice-worker/call-context.mjs
node --check ../../workers/voice-worker/control-server.mjs
node --check ../../workers/voice-worker/delivery-context.mjs
node --check ../../workers/voice-worker/delivery-log.mjs
node --check ../../workers/voice-worker/pending-outbound.mjs
node --check ../../workers/voice-worker/speaches-health.mjs
node --check ../../workers/voice-worker/speaches-stt.mjs
node --check ../../workers/voice-worker/speaches-tts.mjs
node --test ../../workers/voice-worker/brain-client.test.mjs
node --test ../../workers/voice-worker/control-server.test.mjs
node --test ../../workers/voice-worker/delivery-context.contract.test.mjs
node --test ../../workers/voice-worker/delivery-context.test.mjs
node --test ../../workers/voice-worker/delivery-log.test.mjs
node --test ../../workers/voice-worker/pending-outbound.test.mjs
node --test ../../workers/voice-worker/speaches-health.test.mjs
node --test ../../workers/voice-worker/speaches-stt.test.mjs
node --test ../../workers/voice-worker/speaches-tts.test.mjs
node --check workers/voice-pipecat-runtime/main.mjs
node --test workers/voice-pipecat-runtime/main.test.mjs
node --check workers/voice-sip-worker/ari-listener.smoke.mjs
npx tsx workers/voice-sip-worker/ari-listener.smoke.mjs
node --check workers/voice-sip-worker/main.mjs
node --check workers/voice-sip-worker/main.smoke.mjs
# Skips itself (exit 0) when SUPABASE_DB_URL is unset — needs a real local Postgres.
npx tsx workers/voice-sip-worker/main.smoke.mjs
pnpm lint:tenant-filter
pnpm next build
