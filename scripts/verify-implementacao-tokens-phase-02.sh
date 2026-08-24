#!/usr/bin/env bash
set -euo pipefail

pnpm typecheck
NODE_ENV=test pnpm vitest run \
  lib/agent-engine/customer-memory/types.test.ts \
  lib/agent-engine/customer-memory/authority.test.ts \
  tests/unit/capacidade-alcancavel-pelo-agente.test.ts \
  tests/unit/waha-ingest-media.test.ts \
  tests/unit/waha-media-send.test.ts
pnpm lint:tenant-filter
pnpm next build
