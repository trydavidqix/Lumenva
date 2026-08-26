#!/usr/bin/env bash
set -euo pipefail

pnpm typecheck
NODE_ENV=test pnpm vitest run lib/voice/contracts.test.ts
pnpm next build
