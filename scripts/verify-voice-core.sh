#!/usr/bin/env bash
set -euo pipefail

pnpm typecheck
NODE_ENV=test pnpm vitest run \
  lib/voice/contracts.test.ts \
  lib/voice/repository.test.ts \
  lib/voice/config.test.ts \
  lib/voice/engine/contracts.test.ts \
  lib/voice/engine/factory.test.ts \
  lib/voice/patter/adapter.test.ts \
  lib/voice/patter/media.test.ts \
  lib/voice/runtime/agent-os-adapter.test.ts \
  lib/voice/runtime/agent-resolver.test.ts \
  lib/voice/runtime/session.test.ts \
  lib/voice/runtime/barge-in.test.ts \
  lib/voice/runtime/ports.test.ts \
  lib/voice/livekit/session.test.ts \
  lib/voice/telnyx/webhook.test.ts \
  lib/voice/telnyx/orchestrator.test.ts \
  lib/voice/identity/resolve-caller.test.ts \
  lib/voice/transfer/adapter.test.ts \
  lib/voice/transfer/engine-transport.test.ts \
  tests/unit/voice-migration-contract.test.ts \
  tests/unit/voice-hardening-migration-contract.test.ts \
  tests/unit/voice-config-surface-contract.test.ts
pnpm lint:tenant-filter
pnpm next build
