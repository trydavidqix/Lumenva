#!/usr/bin/env bash
set -euo pipefail

pnpm typecheck
NODE_ENV=test pnpm vitest run \
  lib/voice/contracts.test.ts \
  lib/voice/repository.test.ts \
  lib/voice/config.test.ts \
  lib/voice/runtime/session.test.ts \
  lib/voice/runtime/barge-in.test.ts \
  lib/voice/runtime/ports.test.ts \
  lib/voice/livekit/session.test.ts \
  tests/unit/voice-migration-contract.test.ts \
  tests/unit/voice-hardening-migration-contract.test.ts \
  tests/unit/voice-config-surface-contract.test.ts
pnpm lint:tenant-filter
pnpm next build
