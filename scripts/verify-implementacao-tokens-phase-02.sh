#!/usr/bin/env bash
set -euo pipefail

NODE_ENV=test pnpm vitest run \
  lib/agent-engine/customer-memory/repository.test.ts \
  tests/unit/customer-memory-migration-contract.test.ts
