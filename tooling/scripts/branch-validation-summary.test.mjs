import assert from 'node:assert/strict'
import test from 'node:test'
import { reconstructToolchainSummary } from './branch-validation-summary.mjs'

const unifiedUnit = {
  branch: 'unified',
  ref: 'implementation/unified',
  commit: '4f5808bf1c27225aa8ca28c23ce7d9a16444d877',
  suite: 'unit',
  node: 'v22.23.3',
  pnpm: '9.15.9',
  packageManager: 'pnpm@9.15.9+sha512.example',
  versionOk: true,
}

test('reconstructs a missing toolchain summary from successful frozen install and repo check logs', () => {
  const artifacts = new Map([
    ['unified-toolchain-gate.log', 'repo:check passed — Node 22.23.3, pnpm 9.15.9.'],
    ['unified-toolchain-install.log', 'Done in 34.2s using pnpm v9.15.9'],
  ])

  assert.deepEqual(reconstructToolchainSummary([unifiedUnit], (name) => artifacts.get(name)), {
    branch: 'unified',
    ref: 'implementation/unified',
    commit: '4f5808bf1c27225aa8ca28c23ce7d9a16444d877',
    suite: 'toolchain',
    node: 'v22.23.3',
    pnpm: '9.15.9',
    packageManager: 'pnpm@9.15.9+sha512.example',
    versionOk: true,
    installExitCode: 0,
    gateExitCode: 0,
    suiteExitCode: 0,
    installDurationMs: 34200,
    suiteDurationMs: null,
    totalDurationMs: null,
    failures: [],
    testFiles: null,
    tests: null,
    passedTests: 0,
    failedTests: 0,
    skippedTests: 0,
    timeouts: 0,
    workerErrors: 0,
    reconstructedFromArtifacts: true,
  })
})

test('does not invent a toolchain pass without both gate and install evidence', () => {
  assert.equal(reconstructToolchainSummary([unifiedUnit], () => ''), null)
})
