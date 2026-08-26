#!/usr/bin/env bash
set -euo pipefail

pnpm typecheck
NODE_ENV=test pnpm vitest run \
  lib/voice/contracts.test.ts \
  lib/voice/repository.test.ts \
  tests/unit/voice-migration-contract.test.ts
pnpm lint:tenant-filter
pnpm next build
