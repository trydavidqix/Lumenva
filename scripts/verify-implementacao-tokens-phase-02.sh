#!/usr/bin/env bash
set -euo pipefail

NODE_ENV=test pnpm vitest run \
  lib/agent-engine/customer-memory/types.test.ts \
  lib/agent-engine/customer-memory/authority.test.ts
