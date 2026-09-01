#!/usr/bin/env bash
set -euo pipefail

pnpm typecheck
NODE_ENV=test pnpm vitest run \
  lib/agent-engine/customer-memory/types.test.ts \
  lib/agent-engine/customer-memory/authority.test.ts \
  lib/agent-engine/customer-memory/repository.test.ts \
  lib/agent-engine/customer-memory/render.test.ts \
  lib/agent-engine/customer-memory/history-tools.test.ts \
  tests/unit/customer-memory-migration-contract.test.ts \
  tests/unit/capacidade-alcancavel-pelo-agente.test.ts \
  tests/unit/waha-ingest-media.test.ts \
  tests/unit/waha-media-send.test.ts \
  lib/channels/channel-seam.contract.test.ts \
  lib/channels/gateway/contracts.test.ts \
  lib/channels/engines/existing-engines.test.ts \
  lib/channels/gateway/session-supervisor.test.ts \
  lib/channels/gateway/identity-resolver.test.ts \
  lib/channels/gateway/security.test.ts
pnpm lint:channels
pnpm lint:tenant-filter
pnpm next build
