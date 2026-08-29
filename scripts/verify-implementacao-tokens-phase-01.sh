#!/usr/bin/env bash
set -euo pipefail

pnpm typecheck
NODE_ENV=test pnpm vitest run \
  lib/agent-engine/contracts/agent-os.convergence.test.ts \
  lib/agent-engine/kernel/agent-kernel.convergence.test.ts \
  tests/unit/agent-product-convergence.test.ts \
  tests/unit/agent-policy-tool-gateway-convergence.test.ts \
  tests/unit/agent-shadow-evals-convergence.test.ts \
  tests/unit/escalacao-retomada.test.ts \
  tests/unit/mcp-escalacao-tools.test.ts \
  tests/unit/capacidade-alcancavel-pelo-agente.test.ts \
  tests/unit/mcp-attachment-consent.test.ts \
  tests/unit/waha-ingest-media.test.ts \
  tests/unit/waha-media-send.test.ts \
  tests/unit/media-derive.test.ts \
  tests/unit/media-video-derive.test.ts
pnpm lint:tenant-filter
pnpm lint:channels
pnpm next build
